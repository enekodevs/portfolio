/*
 * enekodevs — banner de consentimiento (RGPD) para Microsoft Clarity.
 * Autocontenido: inyecta su propio CSS, no depende de ningún otro fichero.
 * Lee `localStorage.eneko.consent`: 'yes' -> carga Clarity ahora mismo,
 * 'no' -> no hace nada, sin valor -> muestra el banner y espera decisión.
 * Se adapta al idioma por ruta (/ca/, /en/, resto castellano) y al tema
 * claro/oscuro del sitio (variables CSS existentes si las hay).
 *
 * Además, FUERA del consentimiento porque no usa cookies, ni identificadores,
 * ni guarda nada en el navegador, lleva el contador de /api/m
 * (functions/api/m.js): llegadas desde un enlace propio (utm_source) y clics
 * en correo, teléfono, WhatsApp y agenda. Solo en las páginas en castellano:
 * el aviso legal que lo explica aún no existe en catalán ni en inglés.
 * La familia del origen vive en una variable de esta carga de página y nada
 * más: ni sessionStorage ni localStorage. Al pasar a otra página se pierde.
 * Tráfico propio: `?yo=1` marca este navegador (`localStorage.eneko.yo`) y
 * `?yo=0` lo desmarca. Con la marca, o en cualquier host que no sea
 * enekodevs.com (localhost, *.pages.dev), no hay banner, ni Clarity, ni
 * contador.
 */
(function () {
  "use strict";

  var CONSENT_KEY = "eneko.consent";
  var CLARITY_ID = "xzb1omaf7o";
  var STYLE_ID = "eneko-consent-style";
  var ROOT_ID = "eneko-consent";

  var YO_KEY = "eneko.yo";
  var CONTADOR_URL = "/api/m";
  var HOSTS_REALES = { "enekodevs.com": 1, "www.enekodevs.com": 1 };

  // ---- Medición sin cookies ----

  // Familia del utm_source con el que se cargó ESTA página, o "" si no traía.
  // Solo en memoria, a propósito: no se guarda en ningún almacén.
  var FUENTE = "";

  // utm_source -> familia cerrada. La Function rechaza cualquier otro valor.
  function familiaDeFuente(valor) {
    var v = String(valor || "")
      .replace(/^\s+|\s+$/g, "")
      .toLowerCase()
      .replace("í", "i");
    if (v === "envio") return "envio";
    if (v === "malt") return "malt";
    if (v === "linkedin" || v === "lnkd" || v === "linkedin.com" || v === "lnkd.in") return "linkedin";
    return "otra";
  }

  // Lee ?utm_source (a FUENTE, en memoria) y ?yo, y los quita de la barra sin
  // recargar (el hash y el resto de la query se conservan). Así la URL que se
  // copia o se comparte ya no lleva la etiqueta, Clarity, si se acepta,
  // tampoco la ve, y al recargar la página ya no vuelve a contar.
  function leerYLimpiarUrl() {
    var params;
    try {
      params = new URLSearchParams(location.search);
    } catch (e) {
      return;
    }
    if (params.has("utm_source")) {
      FUENTE = familiaDeFuente(params.get("utm_source"));
    }
    var yo = params.get("yo");
    try {
      if (yo === "1") localStorage.setItem(YO_KEY, "1");
      if (yo === "0") localStorage.removeItem(YO_KEY);
    } catch (e) {}

    var quitar = [];
    params.forEach(function (_, clave) {
      if (clave === "yo" || clave.indexOf("utm_") === 0) quitar.push(clave);
    });
    if (!quitar.length) return;
    for (var i = 0; i < quitar.length; i++) params["delete"](quitar[i]);
    var resto = params.toString();
    try {
      history.replaceState(
        history.state,
        "",
        location.pathname + (resto ? "?" + resto : "") + location.hash
      );
    } catch (e) {}
  }

  function esPropio() {
    if (!HOSTS_REALES[location.hostname]) return true;
    try {
      return localStorage.getItem(YO_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  leerYLimpiarUrl();
  var PROPIO = esPropio();
  // El contador solo avisa desde las páginas en castellano (la misma regla de
  // idioma que el banner). Clarity no depende de esto: va por consentimiento.
  var CUENTA = !PROPIO && currentLang() === "es";

  // Nunca rompe la navegación ni lanza: si no se puede avisar, no se avisa.
  function avisar(datos) {
    if (!CUENTA) return;
    try {
      var cuerpo = JSON.stringify(datos);
      if (navigator.sendBeacon && navigator.sendBeacon(CONTADOR_URL, cuerpo)) return;
      if (window.fetch) {
        window
          .fetch(CONTADOR_URL, {
            method: "POST",
            body: cuerpo,
            keepalive: true,
            credentials: "omit",
            headers: { "Content-Type": "text/plain;charset=UTF-8" }
          })
          ["catch"](function () {});
      }
    } catch (e) {}
  }

  // Llegada: una vez por carga de página, solo si esta página se cargó con
  // utm_source, y solo tras la primera señal de persona (tocar, teclear,
  // desplazarse de verdad o 5 s seguidos con la página visible). Los
  // escáneres de enlaces del correo abren la página pero no hacen nada de
  // eso, así que no cuentan como llegada.
  function armarLlegada() {
    var EVENTOS = ["pointerdown", "keydown", "wheel", "touchstart"];
    var hecho = false;
    var reloj = null;
    var y0 = window.scrollY || 0;

    function quitar() {
      for (var i = 0; i < EVENTOS.length; i++) {
        window.removeEventListener(EVENTOS[i], disparar, true);
      }
      window.removeEventListener("scroll", alDesplazar, true);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      clearTimeout(reloj);
    }

    function disparar() {
      if (hecho) return;
      hecho = true;
      quitar();
      avisar({ t: "llegada", p: location.pathname, f: FUENTE });
    }

    // Un scroll programático (ancla, restaurar posición) mueve poco o nada;
    // uno de persona pasa enseguida de 64 px.
    function alDesplazar() {
      if (Math.abs((window.scrollY || 0) - y0) >= 64) disparar();
    }

    // 5 s SEGUIDOS visible: si la pestaña se oculta, la cuenta vuelve a cero.
    function alCambiarVisibilidad() {
      clearTimeout(reloj);
      reloj = null;
      if (document.visibilityState === "visible") reloj = setTimeout(disparar, 5000);
    }

    for (var i = 0; i < EVENTOS.length; i++) {
      window.addEventListener(EVENTOS[i], disparar, { capture: true, passive: true });
    }
    window.addEventListener("scroll", alDesplazar, { capture: true, passive: true });
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    alCambiarVisibilidad();
  }

  if (CUENTA && FUENTE) armarLlegada();

  function destinoDeEnlace(href) {
    var h = String(href || "")
      .replace(/^\s+/, "")
      .toLowerCase();
    if (h.indexOf("mailto:") === 0) return "mailto";
    if (h.indexOf("tel:") === 0) return "tel";
    if (h.indexOf("whatsapp:") === 0) return "whatsapp";
    if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)([\/?#]|$)/.test(h)) return "whatsapp";
    if (/^https?:\/\/(app\.)?cal\.com([\/?#]|$)/.test(h)) return "cal";
    return "";
  }

  // Clics de contacto: delegado en document y en captura, así vale para
  // todas las páginas y se oye aunque otro guion pare la propagación.
  // Cuentan se llegue como se llegue (dentro de CUENTA); llevan la fuente solo
  // si esta página se cargó con ella, y si no, «sin».
  document.addEventListener(
    "click",
    function (ev) {
      try {
        var el = ev.target;
        if (el && el.nodeType !== 1) el = el.parentElement;
        var a = el && el.closest ? el.closest("a[href]") : null;
        if (!a) return;
        var destino = destinoDeEnlace(a.getAttribute("href"));
        if (!destino) return;
        avisar({ t: "clic", p: location.pathname, f: FUENTE || "sin", d: destino });
        // En Clarity, solo si ya está cargado (es decir, si se aceptó).
        if (!PROPIO && typeof window.clarity === "function") {
          window.clarity("event", "contacto_" + destino);
        }
      } catch (e) {}
    },
    true
  );

  // ---- Consentimiento y Clarity ----

  function getConsent() {
    try {
      return localStorage.getItem(CONSENT_KEY);
    } catch (e) {
      return null;
    }
  }

  function setConsent(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch (e) {}
  }

  function injectClarity() {
    if (PROPIO) return;
    if (window.clarity || document.getElementById("eneko-clarity-tag")) return;
    (function (c, l, a, r, i, t, y) {
      c[a] =
        c[a] ||
        function () {
          (c[a].q = c[a].q || []).push(arguments);
        };
      t = l.createElement(r);
      t.id = "eneko-clarity-tag";
      t.async = 1;
      t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", CLARITY_ID);
  }

  // Solo se llega aquí tras «Aceptar» o con eneko.consent = 'yes'.
  // Desde el 31-oct-2025 Clarity exige en la UE la señal de consentimiento
  // (consentv2); sin ella da un id por página vista y no hay sesiones de
  // varias páginas. El banner pregunta por analítica, no por publicidad, así
  // que ad_Storage va denegado. Sintaxis literal de Microsoft:
  // https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2
  // Se manda en cada activación, no solo al inyectar: si en la misma página
  // se rechaza y luego se vuelve a aceptar, Clarity ya está y hay que avisarle.
  function activarClarity() {
    if (PROPIO) return;
    injectClarity();
    if (typeof window.clarity !== "function") return;
    window.clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });
    if (FUENTE) window.clarity("set", "fuente", FUENTE);
  }

  // Rechazar con Clarity ya cargado en esta página (se aceptó antes): borra
  // sus cookies y deja de grabar hasta un nuevo consentimiento. Misma página
  // de Microsoft, apartado «Erase cookies».
  function retirarClarity() {
    if (typeof window.clarity === "function") window.clarity("consent", false);
  }

  function currentLang() {
    var p = location.pathname;
    if (p === "/ca" || p.indexOf("/ca/") === 0) return "ca";
    if (p === "/en" || p.indexOf("/en/") === 0) return "en";
    return "es";
  }

  var TEXT = {
    es: {
      label: "Aviso de cookies y analítica",
      msg:
        "Usamos Microsoft Clarity para entender cómo se usa la web (mapas de calor y grabaciones anónimas). ¿Lo aceptas?",
      link: "Más información",
      accept: "Aceptar",
      reject: "Rechazar"
    },
    ca: {
      label: "Avís de cookies i analítica",
      msg:
        "Fem servir Microsoft Clarity per entendre com s'usa la web (mapes de calor i gravacions anònimes). Ho acceptes?",
      link: "Més informació",
      accept: "Acceptar",
      reject: "Rebutjar"
    },
    en: {
      label: "Cookie and analytics notice",
      msg:
        "We use Microsoft Clarity to understand how the site is used (heatmaps and anonymous session recordings). Do you accept?",
      link: "Learn more",
      accept: "Accept",
      reject: "Reject"
    }
  };

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    // Paleta: primero las variables de la home (--card/--ink/--amber/--plum),
    // luego las de /negocios/ y sus nichos (--fondo-2/--tinta/--amarillo...),
    // y de ultimo un color literal. Asi el banner sigue el tema claro/oscuro
    // de cualquiera de las dos familias de paginas.
    var BG = "var(--card,var(--fondo-2,#26222b))";
    var FG = "var(--ink,var(--tinta,#efece4))";
    var LINE = "var(--line,var(--filete,rgba(242,240,234,.14)))";
    var LINE2 = "var(--line-2,var(--filete-2,rgba(242,240,234,.32)))";
    var AMBER = "var(--amber,var(--amarillo,#e6a92e))";
    var AMBER_TXT = "var(--amber,var(--amarillo-texto,#e6a92e))";
    var ON_AMBER = "var(--plum,var(--sobre-amarillo,#26202b))";
    // El ancho se ata al viewport, no al bloque contenedor: si alguna pagina
    // desborda en horizontal, el navegador movil ensancha el viewport de
    // maquetacion y un `left/right` a secas dejaria los botones fuera de
    // pantalla. Con min(...,100vw) el banner nunca puede pasarse.
    // z-index al maximo posible: la burbuja del chatbot (widget.js, que viene
    // de fuera y no se toca) va a 2147483000 y en movil tapaba el lado derecho
    // de «Rechazar». Mientras el banner esta, queda por encima de ella; al
    // quitarse el banner la burbuja sigue donde estaba, sin tocar nada mas.
    var css =
      "#" +
      ROOT_ID +
      "{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483647;" +
      "width:auto;max-width:min(420px,calc(100vw - 32px));margin:0;font-family:inherit;" +
      "background:" + BG + ";color:" + FG + ";" +
      "border:1px solid " + LINE + ";" +
      "border-radius:16px;padding:20px 22px;" +
      "box-shadow:var(--shadow,0 30px 60px -30px rgba(0,0,0,.55));" +
      "animation:eneko-consent-in .32s cubic-bezier(.2,.7,.2,1)}" +
      "#" +
      ROOT_ID +
      ",#" +
      ROOT_ID +
      " *{box-sizing:border-box}" +
      "@keyframes eneko-consent-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}" +
      "#" +
      ROOT_ID +
      " .ec-msg{margin:0 0 14px;font-size:.92rem;line-height:1.55;color:" + FG + ";" +
      "overflow-wrap:break-word}" +
      "#" +
      ROOT_ID +
      " .ec-msg a{color:" + AMBER_TXT + ";text-decoration:underline;text-underline-offset:2px}" +
      "#" +
      ROOT_ID +
      " .ec-actions{display:flex;gap:10px;flex-wrap:wrap;max-width:100%}" +
      "#" +
      ROOT_ID +
      " button{font-family:inherit;font-size:.86rem;font-weight:600;line-height:1;" +
      "padding:11px 18px;border-radius:999px;cursor:pointer;flex:1 1 auto;" +
      "min-width:110px;max-width:100%;" +
      "transition:transform .18s cubic-bezier(.2,.7,.2,1),opacity .18s}" +
      "#" +
      ROOT_ID +
      " button:hover{transform:translateY(-1px)}" +
      "#" +
      ROOT_ID +
      " button:focus-visible{outline:2.5px solid " + AMBER_TXT + ";outline-offset:2px}" +
      "#" +
      ROOT_ID +
      " .ec-accept{background:" + AMBER + ";color:" + ON_AMBER + ";border:1px solid transparent}" +
      "#" +
      ROOT_ID +
      " .ec-reject{background:transparent;color:" + FG + ";border:1px solid " + LINE2 + "}" +
      "@media(max-width:480px){#" +
      ROOT_ID +
      "{left:12px;right:12px;bottom:12px;max-width:calc(100vw - 24px);padding:18px}}" +
      // Movil estrecho (iPhone SE y por debajo): los dos botones a linea completa.
      "@media(max-width:359px){#" +
      ROOT_ID +
      " button{flex:1 1 100%}}" +
      "@media(prefers-reduced-motion:reduce){#" +
      ROOT_ID +
      "{animation:none}#" +
      ROOT_ID +
      " button{transition:none}#" +
      ROOT_ID +
      " button:hover{transform:none}}";
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function removeBanner() {
    var el = document.getElementById(ROOT_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function showBanner() {
    if (document.getElementById(ROOT_ID)) return;
    injectStyles();

    var t = TEXT[currentLang()];
    var el = document.createElement("div");
    el.id = ROOT_ID;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", t.label);
    el.setAttribute("aria-live", "polite");

    var msg = document.createElement("p");
    msg.className = "ec-msg";
    msg.textContent = t.msg + " ";
    var link = document.createElement("a");
    link.href = "/aviso-legal.html";
    link.textContent = t.link;
    msg.appendChild(link);

    var actions = document.createElement("div");
    actions.className = "ec-actions";

    var accept = document.createElement("button");
    accept.type = "button";
    accept.className = "ec-accept";
    accept.textContent = t.accept;
    accept.addEventListener("click", function () {
      setConsent("yes");
      activarClarity();
      removeBanner();
    });

    var reject = document.createElement("button");
    reject.type = "button";
    reject.className = "ec-reject";
    reject.textContent = t.reject;
    reject.addEventListener("click", function () {
      setConsent("no");
      retirarClarity();
      removeBanner();
    });

    actions.appendChild(accept);
    actions.appendChild(reject);
    el.appendChild(msg);
    el.appendChild(actions);
    document.body.appendChild(el);
  }

  // API pública mínima: permite revocar/revisar la elección desde otra
  // página (p.ej. un botón en /aviso-legal.html).
  window.enekoConsent = {
    get: getConsent,
    accept: function () {
      setConsent("yes");
      activarClarity();
      removeBanner();
    },
    reject: function () {
      setConsent("no");
      retirarClarity();
      removeBanner();
    },
    reset: function () {
      try {
        localStorage.removeItem(CONSENT_KEY);
      } catch (e) {}
      removeBanner();
      showBanner();
    }
  };

  var consent = getConsent();
  if (PROPIO) {
    // Navegador de Eneko o host que no es el de verdad: ni banner ni Clarity.
    // enekoConsent.reset() sí enseña el banner (lo pide la persona), pero
    // aceptar no carga Clarity: activarClarity() también mira PROPIO.
  } else if (consent === "yes") {
    activarClarity();
  } else if (consent !== "no") {
    showBanner();
  }
})();
