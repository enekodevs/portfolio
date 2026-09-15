/*
 * enekodevs — contador sin cookies (Pages Function en /api/m).
 *
 * Cuenta dos cosas, por página: llegadas desde un enlace propio y clics en
 * los enlaces de contacto (correo, teléfono, WhatsApp y agenda). Lo manda
 * vendor/consent.js con sendBeacon, solo desde las páginas en castellano, y
 * aquí se suma +1 a un total del día en D1: binding CONTADOR_DB, base
 * enekodevs-contador (cuenta de Lasaifusta).
 *
 * Lo que SÍ se guarda, y nada más: una fila por combinación de
 *   dia      YYYY-MM-DD en Europe/Madrid, sin hora
 *   ruta     la página (≤ 96 bytes, sin query ni hash)
 *   tipo     llegada | clic
 *   fuente   envio | malt | linkedin | otra | sin
 *   destino  mailto | tel | whatsapp | cal | —   («—» en llegadas)
 *   n        cuántas llegadas o clics ha habido ese día con esa combinación
 * y en la misma escritura se borra todo lo que tenga más de 90 días. D1 no
 * caduca filas por sí mismo: el borrado va con cada suma, así que si un día
 * no llega ninguna, lo viejo espera a la siguiente.
 *
 * Lo que NO se guarda, a propósito: ni la hora, ni IP, ni user-agent, ni
 * dispositivo, ni país, ni campaña. El user-agent solo se mira aquí dentro
 * para descartar bots y no sale de la petición. Tampoco se leen cookies ni
 * se pone ninguna. Una fila dice cuántos, nunca cuándo ni quién.
 *
 * El lector (el motor, con un token de solo lectura de D1) solo puede leer
 * esos totales por día: no hay nada más fino que consultar. La tabla es el
 * contrato con el motor y con el aviso legal; no cambiarla sin los dos.
 */

const ORIGENES = new Set(["https://enekodevs.com", "https://www.enekodevs.com"]);
const TIPOS = new Set(["llegada", "clic"]);
const FUENTES = new Set(["envio", "malt", "linkedin", "otra", "sin"]);
const DESTINOS_CLIC = new Set(["mailto", "tel", "whatsapp", "cal"]);
// El cuerpo es cerrado: cualquier otro campo (una hora, un dispositivo...) es
// 400, para que nadie crea que se guarda algo que aquí se tira.
const CAMPOS = new Set(["t", "p", "f", "d"]);
export const SIN_DESTINO = "—";
export const MAX_CUERPO = 512; // bytes
const MAX_RUTA = 96; // bytes: tope de la clave, para no llenar la tabla de rutas largas
export const DIAS_CONSERVADOS = 90;

// Rutas del sitio: ASCII, sin query ni hash. Todo lo demás se rechaza.
const RUTA_VALIDA = /^\/[A-Za-z0-9._~\/-]*$/;

// Solo páginas en castellano: el aviso legal que lo explica aún no está en
// catalán ni en inglés. Misma regla de idioma que currentLang() en consent.js.
const RUTA_OTRO_IDIOMA = /^\/(ca|en)(\/|$)/;

// Bots y clientes que no son un navegador de persona. No pretende ser una
// lista completa: los escáneres de enlaces del correo que se hacen pasar por
// Chrome ya los frena consent.js, que no avisa hasta la primera interacción.
const UA_BOT =
  /bot|crawl|spider|slurp|scrap|preview|headless|lighthouse|pagespeed|pingdom|uptime|monitor|scan|curl|wget|python|httpclient|okhttp|axios|node-fetch|undici|go-http|java\/|libwww|facebookexternalhit|embedly|whatsapp|telegram|skype|discord/i;

// SQL fijo: los valores van siempre por bind(), nunca pegados al texto.
const SQL_TABLA =
  "CREATE TABLE IF NOT EXISTS contador (dia TEXT NOT NULL, ruta TEXT NOT NULL, tipo TEXT NOT NULL, fuente TEXT NOT NULL, destino TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (dia, ruta, tipo, fuente, destino))";
const SQL_SUMAR =
  "INSERT INTO contador (dia, ruta, tipo, fuente, destino, n) VALUES (?, ?, ?, ?, ?, 1) ON CONFLICT (dia, ruta, tipo, fuente, destino) DO UPDATE SET n = n + 1";
const SQL_PODAR = "DELETE FROM contador WHERE dia < ?";

// Día natural en Madrid (cambia de hora sola en verano e invierno).
const FORMATO_MADRID = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// 204 sin cuerpo, sin cookies y sin caché. Es la respuesta normal.
function respuesta(estado, extra) {
  const h = new Headers({ "Cache-Control": "no-store" });
  if (extra) for (const k in extra) h.set(k, extra[k]);
  return new Response(null, { status: estado, headers: h });
}

export function origenPermitido(origen) {
  return typeof origen === "string" && ORIGENES.has(origen);
}

export function esBot(ua) {
  return !ua || UA_BOT.test(ua);
}

// Fecha -> "YYYY-MM-DD" del día que es en Madrid en ese instante.
export function diaMadrid(fecha) {
  const partes = {};
  for (const p of FORMATO_MADRID.formatToParts(fecha)) partes[p.type] = p.value;
  return partes.year + "-" + partes.month + "-" + partes.day;
}

// "YYYY-MM-DD" -> el mismo formato, `dias` días antes. Aritmética de
// calendario en UTC, sin horas de por medio. Lo anterior a esto se borra.
export function diaLimite(dia, dias = DIAS_CONSERVADOS) {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d) - dias * 86400000).toISOString().slice(0, 10);
}

// Valida el cuerpo contra las listas cerradas. Devuelve la fila sin el día
// (ruta, tipo, fuente, destino), o null si algo no cuadra.
export function validar(texto) {
  if (typeof texto !== "string" || texto.length === 0) return null;
  if (new TextEncoder().encode(texto).length > MAX_CUERPO) return null;
  let d;
  try {
    d = JSON.parse(texto);
  } catch (e) {
    return null;
  }
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  for (const k of Object.keys(d)) if (!CAMPOS.has(k)) return null;

  const tipo = d.t;
  const ruta = d.p;
  const fuente = d.f;
  const destino = d.d === undefined ? SIN_DESTINO : d.d;

  if (!TIPOS.has(tipo)) return null;
  if (!FUENTES.has(fuente)) return null;
  if (typeof ruta !== "string" || !RUTA_VALIDA.test(ruta)) return null;
  if (new TextEncoder().encode(ruta).length > MAX_RUTA) return null;
  if (RUTA_OTRO_IDIOMA.test(ruta)) return null;
  if (tipo === "clic" && !DESTINOS_CLIC.has(destino)) return null;
  if (tipo === "llegada" && destino !== SIN_DESTINO) return null;

  return { ruta, tipo, fuente, destino };
}

// Lee como mucho MAX_CUERPO + 1 bytes: lo que pase de ahí ya no vale y no
// hace falta seguir leyéndolo.
async function leerCuerpo(request) {
  if (!request.body) return "";
  const lector = request.body.getReader();
  const trozos = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_CUERPO) {
      try {
        await lector.cancel();
      } catch (e) {}
      return null;
    }
    trozos.push(value);
  }
  const todo = new Uint8Array(total);
  let pos = 0;
  for (const t of trozos) {
    todo.set(t, pos);
    pos += t.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(todo);
}

// `ahora` solo existe para las pruebas; en producción es el instante de la
// petición.
export async function contar(request, env, ahora = new Date()) {
  if (request.method !== "POST") return respuesta(405, { Allow: "POST" });
  if (!origenPermitido(request.headers.get("Origin"))) return respuesta(403);

  const tipoContenido = (request.headers.get("Content-Type") || "").toLowerCase();
  if (!tipoContenido.startsWith("text/plain")) return respuesta(415);

  const largo = Number(request.headers.get("Content-Length"));
  if (largo > MAX_CUERPO) return respuesta(413);

  let texto;
  try {
    texto = await leerCuerpo(request);
  } catch (e) {
    return respuesta(400);
  }
  if (texto === null) return respuesta(413);

  const fila = validar(texto);
  if (!fila) return respuesta(400);

  // Un bot con cuerpo válido no es un error: se descarta en silencio.
  if (esBot(request.headers.get("User-Agent") || "")) return respuesta(204);

  // Sin binding (previews, wrangler sin --d1) se responde igual y no se
  // apunta nada.
  const db = env && env.CONTADOR_DB;
  if (!db || typeof db.prepare !== "function" || typeof db.batch !== "function") return respuesta(204);

  // Una sola ida a D1, en transacción: la tabla si no está, +1 a la fila del
  // día y fuera lo de más de 90 días.
  try {
    const dia = diaMadrid(ahora);
    await db.batch([
      db.prepare(SQL_TABLA),
      db.prepare(SQL_SUMAR).bind(dia, fila.ruta, fila.tipo, fila.fuente, fila.destino),
      db.prepare(SQL_PODAR).bind(diaLimite(dia)),
    ]);
  } catch (e) {
    // D1 caído o lleno: esa visita no cuenta y la página no se entera.
  }
  return respuesta(204);
}

export function onRequest(context) {
  return contar(context.request, context.env);
}
