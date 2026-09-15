/*
 * enekodevs — contador sin cookies (Pages Function en /api/m).
 *
 * Cuenta dos cosas, por página: llegadas desde un enlace propio y clics en
 * los botones de contacto (correo, teléfono, WhatsApp y agenda). Lo manda
 * vendor/consent.js con sendBeacon y aquí se apunta en Workers Analytics
 * Engine: binding CONTADOR, dataset enekodevs_contador.
 *
 * Lo que NO se guarda, a propósito: ni IP, ni user-agent, ni país, ni
 * campaña. El user-agent solo se mira aquí dentro para descartar bots y para
 * decir «movil» o «escritorio», y no sale de la petición. Tampoco se leen
 * cookies ni se pone ninguna.
 *
 * Lo que SÍ queda aunque no lo mandemos: la hora. Analytics Engine guarda
 * cada punto por separado, uno por petición, con su marca de tiempo exacta;
 * aquí no hay nada que agregue por día ni forma de quitarla. Con unos 6
 * correos al día a páginas de nicho, ruta + fuente «envio» + minuto puede
 * señalar a una persona. Por eso el lector (el motor, cuando exista) lleva
 * dos reglas que el aviso legal promete, y cada una con su prueba:
 *   1. consulta siempre truncada a día, nunca por hora ni por minuto;
 *   2. nunca une estos puntos con el ledger de envíos, ni por hora ni por
 *      lead: solo compara totales.
 *
 * Forma del punto (el motor lo lee en este orden, no cambiarlo sin él):
 *   index1 = ruta (≤ 96 bytes)
 *   blob1  = tipo        llegada | clic
 *   blob2  = fuente      envio | malt | linkedin | otra | sin
 *   blob3  = destino     mailto | tel | whatsapp | cal | —   («—» en llegadas)
 *   blob4  = dispositivo movil | escritorio
 */

const ORIGENES = new Set(["https://enekodevs.com", "https://www.enekodevs.com"]);
const TIPOS = new Set(["llegada", "clic"]);
const FUENTES = new Set(["envio", "malt", "linkedin", "otra", "sin"]);
const DESTINOS_CLIC = new Set(["mailto", "tel", "whatsapp", "cal"]);
export const SIN_DESTINO = "—";
export const MAX_CUERPO = 512; // bytes
const MAX_RUTA = 96; // bytes: el máximo de un index en Analytics Engine

// Rutas del sitio: ASCII, sin query ni hash. Todo lo demás se rechaza.
const RUTA_VALIDA = /^\/[A-Za-z0-9._~\/-]*$/;

// Bots y clientes que no son un navegador de persona. No pretende ser una
// lista completa: los escáneres de enlaces del correo que se hacen pasar por
// Chrome ya los frena consent.js, que no avisa hasta la primera interacción.
const UA_BOT =
  /bot|crawl|spider|slurp|scrap|preview|headless|lighthouse|pagespeed|pingdom|uptime|monitor|scan|curl|wget|python|httpclient|okhttp|axios|node-fetch|undici|go-http|java\/|libwww|facebookexternalhit|embedly|whatsapp|telegram|skype|discord/i;

const UA_MOVIL = /Mobi|Android|iPhone|iPod|iPad|Windows Phone/i;

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

export function dispositivo(ua, chMovil) {
  // Sec-CH-UA-Mobile (Chromium) manda sobre el user-agent cuando viene.
  if (chMovil === "?1") return "movil";
  if (chMovil === "?0") return "escritorio";
  return UA_MOVIL.test(ua || "") ? "movil" : "escritorio";
}

// Valida el cuerpo contra las listas cerradas. Devuelve el punto listo para
// writeDataPoint, o null si algo no cuadra.
export function validar(texto, disp) {
  if (typeof texto !== "string" || texto.length === 0) return null;
  if (new TextEncoder().encode(texto).length > MAX_CUERPO) return null;
  let d;
  try {
    d = JSON.parse(texto);
  } catch (e) {
    return null;
  }
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;

  const tipo = d.t;
  const ruta = d.p;
  const fuente = d.f;
  const destino = d.d === undefined ? SIN_DESTINO : d.d;

  if (!TIPOS.has(tipo)) return null;
  if (!FUENTES.has(fuente)) return null;
  if (typeof ruta !== "string" || !RUTA_VALIDA.test(ruta)) return null;
  if (new TextEncoder().encode(ruta).length > MAX_RUTA) return null;
  if (tipo === "clic" && !DESTINOS_CLIC.has(destino)) return null;
  if (tipo === "llegada" && destino !== SIN_DESTINO) return null;
  if (disp !== "movil" && disp !== "escritorio") return null;

  return { indexes: [ruta], blobs: [tipo, fuente, destino, disp] };
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

export async function contar(request, env) {
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

  const ua = request.headers.get("User-Agent") || "";
  const punto = validar(texto, dispositivo(ua, request.headers.get("Sec-CH-UA-Mobile")));
  if (!punto) return respuesta(400);

  // Un bot con cuerpo válido no es un error: se descarta en silencio.
  if (esBot(ua)) return respuesta(204);

  // Sin binding (previews, wrangler en local) se responde igual y no se
  // apunta nada. writeDataPoint no devuelve promesa: no hay que esperarla.
  try {
    if (env && env.CONTADOR && typeof env.CONTADOR.writeDataPoint === "function") {
      env.CONTADOR.writeDataPoint(punto);
    }
  } catch (e) {}
  return respuesta(204);
}

export function onRequest(context) {
  return contar(context.request, context.env);
}
