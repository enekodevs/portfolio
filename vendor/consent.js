/*
 * enekodevs — banner de consentimiento (RGPD) para Microsoft Clarity.
 * Autocontenido: inyecta su propio CSS, no depende de ningún otro fichero.
 * Lee `localStorage.eneko.consent`: 'yes' -> carga Clarity ahora mismo,
 * 'no' -> no hace nada, sin valor -> muestra el banner y espera decisión.
 * Se adapta al idioma por ruta (/ca/, /en/, resto castellano) y al tema
 * claro/oscuro del sitio (variables CSS existentes si las hay).
 */
(function () {
  "use strict";

  var CONSENT_KEY = "eneko.consent";
  var CLARITY_ID = "xzb1omaf7o";
  var STYLE_ID = "eneko-consent-style";
  var ROOT_ID = "eneko-consent";

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
    var css =
      "#" +
      ROOT_ID +
      "{position:fixed;left:16px;right:16px;bottom:16px;z-index:999999;" +
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
      injectClarity();
      removeBanner();
    });

    var reject = document.createElement("button");
    reject.type = "button";
    reject.className = "ec-reject";
    reject.textContent = t.reject;
    reject.addEventListener("click", function () {
      setConsent("no");
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
      injectClarity();
      removeBanner();
    },
    reject: function () {
      setConsent("no");
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
  if (consent === "yes") {
    injectClarity();
  } else if (consent !== "no") {
    showBanner();
  }
})();
