/* Secuencia visual obligatoria de cada alternativa (Three.js, sin archivos de modelo externos). Sistema reutilizable:
     1) objeto protagonista (sin personaje)  →  2) primer plano de las manos usándolo  →  3) personaje completo usándolo  →  4) cuadro educativo.
   Este archivo es el motor común: cámara, línea de tiempo, entorno (suelo, fondo, personaje), luces, cuadro, controles y progreso.
   Cada alternativa es un "módulo" (js/seq-modules.js: teléfono, radio, linterna) que aporta su modelo 3D, sus manos, su demostración y sus poses.

   Reglas que implementa el motor:
   · el mismo modelo 3D se usa en las tres etapas; las poses se mezclan sin cortes (el objeto nunca desaparece);
   · la secuencia completa se ve la primera vez; si el usuario vuelve a la alternativa se muestra directamente el plano completo con el cuadro,
     y puede repetir el acercamiento (botón del cuadro) o la secuencia entera (botón «Repetir secuencia» o los pasos de la barra de progreso);
   · nunca cambia de pantalla por sí sola: solo el botón «Finalizar recorrido» muestra la despedida;
   · con «reducir movimiento» no hay transiciones: los pasos son planos fijos que el usuario elige.

   Alcance real: el personaje completo es la ilustración de referencia (imagen plana en un plano 3D, con un ligero movimiento del cuerpo entero), no un modelo
   articulado. Las manos y los antebrazos del primer plano son piezas 3D estilizadas hechas con geometría simple; en el plano completo se ve la mano que sostiene
   el objeto a la altura de la muñeca de la ilustración. La luz de la linterna es un foco sencillo sin sombras. */
window.FFSeq = (function () {
  "use strict";
  var clamp01 = function (t) { return Math.max(0, Math.min(1, t)); };
  var smooth = function (t) { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var step = function (t) { return t > 0 ? 1 : 0; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  /* personajes y fondos de cada contexto. wrist = punto (en el plano del personaje) donde la ilustración tiene la mano. */
  var CTX3D = {
    rural: { img: "assets/characters/cauca.png", bg: "assets/scenes/cauca-back.svg", w: 2.85, wrist: [0.39, 1.48, 0.12], skin: 0xe0a578, sleeve: "plaid", bracelet: false, ground: 0x5d7547 },
    urbano: { img: "assets/characters/cali.png", bg: "assets/scenes/cali-back.svg", w: 2.7, wrist: [0.62, 1.19, 0.12], skin: 0xd9996a, sleeve: "floral", bracelet: true, ground: 0x6c6877 }
  };
  var TIMES = { hero: 2.6, toClose: 1.2, toWide: 2.0, cardAfter: 1.6 };
  var modules = {};

  function markup(J, SQ, nav, QT) {
    var prog = nav.items.map(function (it) { return '<li class="' + (it.on ? "on" : it.done ? "done" : "") + '"' + (it.on ? ' aria-current="step"' : "") + '><a data-nav href="' + it.href + '">' + esc(it.label) + "</a></li>"; }).join("");
    return '<div class="seq-stage"><canvas class="seq-canvas" aria-hidden="true"></canvas></div>' +
      '<p class="sr-only" role="status" aria-live="polite" id="seq-status"></p>' +
      '<div class="seq-hud"><ol class="seq-steps" aria-label="Progreso de la secuencia">' + SQ.steps.map(function (s, i) {
        return '<li data-i="' + (i + 1) + '"><button type="button" class="seq-step" aria-label="Ir al paso ' + (i + 1) + ": " + esc(s) + '"><i></i><span>' + esc(s) + "</span></button></li>";
      }).join("") + '</ol><button type="button" class="seq-skip">' + esc(SQ.skip) + "</button></div>" +
      '<button type="button" class="seq-hot" role="switch" aria-checked="false" hidden><span class="ring"></span><span class="lbl">Interruptor</span></button>' +
      '<section class="seq-card" aria-label="Información de la alternativa" hidden></section>' +
      '<section class="seq-bye" role="dialog" aria-labelledby="seq-bye-title" hidden><h2 id="seq-bye-title">Gracias por recorrer esta escena</h2><p>' + esc(J.bye) + "</p>" +
      '<div class="seq-actions"><a class="seq-next-btn" data-nav href="' + nav.next.href + '">Seguir: ' + esc(nav.next.label) + ' <span aria-hidden="true">→</span></a><a class="seq-menu" data-nav href="' + nav.menuHref + '">Volver al menú de la zona</a><button type="button" class="seq-repeat">Repetir secuencia</button></div></section>' +
      '<nav class="seq-nav" aria-label="Recorrido de ' + esc(nav.zoneName) + '"><a class="seq-home" data-nav href="' + nav.menuHref + '">Menú</a><a class="seq-prev" data-nav href="' + nav.prev.href + '"><span aria-hidden="true">←</span> ' + esc(nav.prev.label) + '</a>' +
      '<div class="seq-progress"><span class="seq-zname">' + esc(nav.zoneName) + '</span><ol>' + prog + '</ol></div>' +
      '<a class="seq-next" data-nav href="' + nav.next.href + '">' + esc(nav.next.label) + ' <span aria-hidden="true">→</span></a></nav>' +
      '<section class="seq-quake" role="status" aria-live="polite" hidden><p class="seq-qk"></p><p class="seq-qt"></p><div class="seq-qbtns"><button type="button" class="seq-qgo" hidden>' + esc(QT.cont) + '</button><button type="button" class="seq-qskip">' + esc(QT.skip) + '</button></div></section>' +
      '<aside class="seq-lead" aria-label="Qué es y cómo se usa" hidden></aside>' +
      '<section class="seq-prac" aria-label="Práctica con el objeto" hidden></section>' +
      '<section class="seq-story" aria-label="Historia" hidden></section><div class="st-fly" aria-hidden="true" hidden></div>' +
      '<div class="seq-think" aria-hidden="true" hidden><p></p><i class="t1"></i><i class="t2"></i></div>' +
      '<div class="seq-walk" aria-hidden="true" hidden><p class="sw-bubble"></p></div>' +
      '<div class="sw-signal" aria-hidden="true" hidden><span class="sw-bars"><i></i><i></i><i></i><i></i></span><span class="sw-txt"><b></b><small>Simulación educativa</small></span></div>';
  }

  function start(root, cfg) {
    var J = cfg.journey, Zn = cfg.zone, SQ = cfg.seq, NAV = cfg.nav, reduce = !!cfg.reduce, topics = J.objects;
    var NOSIG = !Zn.quake && !!Zn.nosignal, QTX = NOSIG && window.FF.nosignal ? window.FF.nosignal : cfg.quakeText;   // zona rural: en vez del sismo, Mateo descubre que no tiene señal
    var ctxId = Zn.id, topicId = cfg.topic || topics[0].id;
    root.innerHTML = markup(J, SQ, NAV, QTX);
    var $ = function (s) { return root.querySelector(s); };
    var journeyNext = NAV.next, journeyPrev = NAV.prev;
    function updateTopicNav() {
      var i = topics.findIndex(function (o) { return o.id === topicId; });
      function destination(o) { return { href: "#" + Zn.id + "/" + J.id, label: o.label, topic: o.id }; }
      NAV.next = i >= 0 && i < topics.length - 1 ? destination(topics[i + 1]) : journeyNext;
      NAV.prev = i > 0 ? destination(topics[i - 1]) : journeyPrev;
      [[".seq-next", NAV.next, ""], [".seq-next-btn", NAV.next, "Seguir: "], [".seq-prev", NAV.prev, "← "]].forEach(function (entry) {
        var el = $(entry[0]), dest = entry[1];
        el.setAttribute("href", dest.href);
        if (dest.topic) el.setAttribute("data-nav-topic", dest.topic); else el.removeAttribute("data-nav-topic");
        el.textContent = entry[2] + dest.label + (entry[0] === ".seq-prev" ? "" : " →");
        if (entry[0] === ".seq-prev") el.classList.toggle("is-menu", dest.href === NAV.menuHref && !dest.topic);   // en la primera alternativa no hay una anterior
      });
    }
    updateTopicNav();
    var canvas = $(".seq-canvas"), statusEl = $("#seq-status"), skipBtn = $(".seq-skip"), hot = $(".seq-hot"), card = $(".seq-card"), bye = $(".seq-bye"), prac = $(".seq-prac"), think = $(".seq-think"), storyEl = $(".seq-story"), fly = $(".st-fly");
    var stepLis = [].slice.call(root.querySelectorAll(".seq-steps li"));
    var alive = true, live = { light: false, airplane: false, kick: -1e9, sms: window.FFSms.fresh(), net: 0, netAt: -1e9, searchAt: -1e9, recAt: -1e9, voice: window.FFVoice.fresh(), walk: { sig: "none", bars: 0 } }, shown = { card: false, stage: 0 };
    var unmountTuner = null, miniCtx = null, miniAt = 0;
    /* El antiguo recorrido guiado de la linterna (cuadro de la derecha, pasos 1–5) quedó reemplazado por la práctica centrada en el objeto (ver «práctica»).
       G queda en null: el código de la guía no se ejecuta. */
    var G = null;
    var APAGON = false;
    /* linterna: entrada más fluida — se presenta un momento y se desliza al centro en 3 s (las demás alternativas conservan sus tiempos) */
    var TORCH = J.module === "torch", T_HERO = TORCH ? 0.6 : TIMES.hero, T_CLOSE = TORCH ? 3.0 : TIMES.toClose;
    var FLAT = false;   // versión plana (sin WebGL): conserva los controles en el cuadro

    function topic() { return topics.filter(function (o) { return o.id === topicId; })[0] || topics[0]; }
    function say(m) { statusEl.textContent = m; }
    /* explicación breve desde el inicio (pasos 1 a 3): qué es el objeto y cómo se usa, antes de que aparezca el cuadro completo */
    function updateLead() {
      var o = topic(), el = $(".seq-lead");
      var scene = o.walk || hasStory() || (mod && mod.cardAt && mod.cardAt() != null);   // escenas con el personaje: caminata, historias y la antena de la radio rural
      if (!o.lead || G || shown.stage === 4 || shown.card || (scene && shown.stage >= 3)) { el.hidden = true; return; }   // se oculta cuando empieza la escena con el personaje (lo taparía)
      el.innerHTML = '<b>' + esc(o.name) + '</b><span>' + esc(o.lead) + "</span>"; el.hidden = false;
    }
    function setStep(n) {
      if (n === shown.stage) return; shown.stage = n; updateLead();
      stepLis.forEach(function (li, i) { li.classList.toggle("done", i + 1 < n); li.classList.toggle("active", i + 1 === n); });
      say("Paso " + n + " de 4: " + stepNames()[n - 1]);
    }
    /* nombres de los pasos: con historia, «Personaje» e «Información» pasan a ser «Historia» y «Lo aprendido» */
    function stepNames() { return hasStory() && SQ.storySteps ? SQ.storySteps : SQ.steps; }
    function relabelSteps() {
      var L = stepNames();
      stepLis.forEach(function (li, i) { var sp = li.querySelector(".seq-step span"); if (sp.textContent !== tr(L[i])) sp.textContent = L[i]; li.querySelector(".seq-step").setAttribute("aria-label", "Ir al paso " + (i + 1) + ": " + L[i]); });
    }

    /* ---------- cuadro educativo (etapa 4) ---------- */
    function netHTML(o) {
      if (!o.net) return "";
      var row = function (label, v) { return '<div class="' + (v[0] ? "yes" : "no") + '"><dt>' + label + "</dt><dd>" + esc(v[1]) + "</dd></div>"; };
      return '<dl class="seq-net">' + row("Internet", o.net.internet) + row("Red celular", o.net.cellular) + "</dl>";
    }
    var ICON_SMS = '<svg class="ico-sms" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 3.5h16a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2H10l-5 4v-4H4a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2z"/><circle cx="7.5" cy="10.3" r="1.35"/><circle cx="12" cy="10.3" r="1.35"/><circle cx="16.5" cy="10.3" r="1.35"/></svg>';
    function tunerHTML() {
      var D = window.FF.tuner;
      return '<section class="seq-tuner tuner" data-tuner><h3>' + esc(D.title) + '</h3><p class="tn-help">1) Enciende la radio. 2) Elige AM o FM. 3) Arrastra la barra oscura o la barra de abajo hasta oír una emisora.</p>' +
        '<div class="tn-row"><button type="button" class="tn-power" role="switch" aria-checked="false"><span class="knob" aria-hidden="true"></span><span class="lbl">Encender la radio</span></button>' +
        '<div class="tn-bands" role="group" aria-label="Banda"><button type="button" data-band="AM" aria-pressed="true">AM</button><button type="button" data-band="FM" aria-pressed="false">FM</button></div></div>' +
        '<div class="tn-dial" aria-hidden="true"><span class="tn-scale"></span><i class="tn-needle"></i></div>' +
        '<input class="tn-range" type="range" min="0" max="100" step="1" value="8" aria-label="Dial de sintonía" disabled>' +
        '<div class="tn-meter" aria-hidden="true"><i></i></div>' +
        '<p class="tn-out" role="status" aria-live="polite"></p><p class="tn-note">' + esc(D.note) + "</p></section>";
    }
    /* tutorial paso a paso del SMS simulado: la lista marca lo ya hecho y el paso en curso a medida que el usuario escribe y envía */
    function smsHTML(o) {
      window.FFSms.example = o && o.exampleMsg ? tr(o.exampleMsg) : window.FFSms.EXAMPLE_MSG;   // mensaje de ejemplo de la alternativa (también sin 3D)
      return '<section class="seq-tut"><h3>' + esc(o.tutorial.title) + '</h3><ol class="tut-steps">' + o.tutorial.steps.map(function (st, i) { return '<li data-s="' + i + '">' + esc(st) + "</li>"; }).join("") + "</ol></section>" +
        '<div class="seq-sms"><p class="sms-note">Teléfono de práctica: es una simulación, el número es ficticio y no se envía ningún mensaje real.</p>' + window.FFSms.html(live.sms) + "</div>";
    }
    function tutState() {
      var s = live.sms, sent = s.sent, d = [s.screen !== "home" || sent, s.screen !== "home" || sent, s.num.length >= 10 || sent, s.text.length >= 8 || sent, sent, sent], cur = d.indexOf(false);
      [].forEach.call(card.querySelectorAll(".tut-steps li"), function (li, i) { li.classList.toggle("done", d[i]); li.classList.toggle("cur", i === cur); });
    }
    /* ---------- marcar 119 (simulado; Cali) ----------
       Los botones cambian según el paso (live.voice.step) y el teléfono 3D dibuja la misma etapa. No se llama a ningún número. */
    var VZ_BTN = { 0: [["vz-open", "Abrir «Teléfono»", 1]], 1: [["vz-dial", "Marcar 119", 1]], 2: [["vz-call", "Pulsar llamar (simulado)", 1]],
      3: [["vz-stop", "Colgar", 1]], 4: [["vz-reset", "Practicar de nuevo", 0]] };
    var VZ_STATE = ["Listo para empezar", "Teclado abierto", "119 marcado", "Llamada en curso (simulada)", "Llamada finalizada · SIMULACIÓN"];
    var vzTimer = 0;
    function voiceHTML(o) {
      return '<section class="seq-tut"><h3>' + esc(o.voiceTut.title) + '</h3><ol class="tut-steps">' + o.voiceTut.steps.map(function (st, i) { return '<li data-s="' + i + '">' + esc(st) + "</li>"; }).join("") + "</ol></section>" +
        '<div class="seq-voice" data-voice></div>';
    }
    function voiceSync(focus) {
      var box = card.querySelector("[data-voice]"); if (!box) return;
      var o = topic(), v = live.voice, st = v.step, VO = window.FFVoice;
      var h = '<p class="sms-note">Simulación: no se llama a ningún número.</p>' +
        '<div class="vz-status s' + st + '"><i aria-hidden="true"></i><span>' + esc(VZ_STATE[st]) + "</span>" + (st >= 3 ? '<b class="vz-time">' + VO.fmt(VO.elapsed(v)) + "</b>" : "") + "</div>";
      if (st === 3) h += '<p class="vz-msg">' + esc(o.voiceSay) + "</p>";
      if (st === 4) h += '<p class="vz-ok"><b>Llamada finalizada · SIMULACIÓN.</b> No se llamó a ningún número.</p>';
      h += '<div class="vz-btns">' + VZ_BTN[st].map(function (b) { return '<button type="button" class="' + (b[2] ? "seq-finish" : "seq-again") + '" data-act="' + b[0] + '">' + esc(b[1]) + "</button>"; }).join("") + "</div>";
      box.innerHTML = h; voiceSteps();
      if (focus) { var f = box.querySelector(".vz-btns button"); if (f) f.focus({ preventScroll: true }); }
    }
    /* lista de pasos: marca lo hecho y el paso en curso (el 4 se completa tras unos segundos de llamada) */
    function voiceSteps() {
      var v = live.voice, st = v.step, d = [st >= 1, st >= 2, st >= 3, st >= 4 || window.FFVoice.elapsed(v) >= 3, st >= 4], cur = d.indexOf(false);
      [].forEach.call(card.querySelectorAll(".tut-steps li"), function (el, i) { el.classList.toggle("done", d[i]); el.classList.toggle("cur", i === cur); });
    }
    /* reloj de la llamada simulada: actualiza el tiempo del cuadro y cuelga sola al llegar al máximo */
    function voiceTick() {
      clearInterval(vzTimer); vzTimer = 0; if (live.voice.step !== 3) return;
      vzTimer = setInterval(function () {
        var VO = window.FFVoice, el = VO.elapsed(live.voice), tEl = card.querySelector(".vz-time"); if (tEl) tEl.textContent = VO.fmt(el); voiceSteps();
        if (el >= VO.MAX) { voiceAct("vz-stop"); say("Se alcanzó el tiempo máximo de la simulación. Llamada finalizada (simulación)"); }
      }, 200);
    }
    function voiceAct(a) {
      var v = live.voice, now = performance.now(), VO = window.FFVoice, A = window.FFAudio;
      if (a === "vz-open") v.step = 1;
      else if (a === "vz-dial") v.step = 2;
      else if (a === "vz-call") { v.step = 3; v.rec = 0; v.recAt = now; }
      else if (a === "vz-stop") { v.rec = VO.elapsed(v, now); v.step = 4; }
      else if (a === "vz-reset") live.voice = VO.fresh();
      live.kick = now; voiceTick(); voiceSync(true);
      say(VZ_STATE[live.voice.step]);
      if (A) { if (a === "vz-call") A.click(true); else if (a === "vz-stop") A.click(false); else A.key("x"); }
    }
    /* ---------- «Buscar un lugar con mejor señal» (Cauca): Mateo camina hasta un lugar abierto y seguro y consulta la señal ----------
       La caminata se ve en el plano completo (ver WALK y walkState más abajo); aquí, el cuadro con lo que hizo, el resultado y los botones. */
    var ICON_PHONE = '<svg class="ico-phone" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6.5" y="2.5" width="11" height="19" rx="2.4"/><circle cx="12" cy="18.2" r="1.15"/></svg>';
    var walkTry = 0;
    function walkResult(o) { var r = (o || topic()).results; return r ? r[walkTry % r.length] : { bars: 0, title: "", text: "" }; }
    function barsHTML(n) { return '<span class="sw-bars" aria-hidden="true">' + [0, 1, 2, 3].map(function (i) { return "<i" + (i < n ? ' class="on"' : "") + "></i>"; }).join("") + "</span>"; }
    function walkHTML(o) {
      var r = walkResult(o);
      return '<h3>' + esc(o.walkTitle) + '</h3><ol class="sw-steps">' + o.walkSteps.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" +
        '<div class="sw-result b' + r.bars + '">' + barsHTML(r.bars) + "<p><b>Resultado de este intento:</b> <b>" + esc(r.title) + "</b><br>" + esc(r.text) + ' <small>Simulación educativa: no es una conexión real.</small></p></div>';
    }
    /* «Volver a las alternativas del celular»: lleva al selector de temas del teléfono (arriba del cuadro) y lo resalta */
    function walkTopics() {
      card.scrollTop = 0; var pk = card.querySelector(".seq-pick"); if (!pk) return;
      pk.classList.remove("flash"); void pk.offsetWidth; pk.classList.add("flash");
      var b = pk.querySelector('button[aria-pressed="true"]') || pk.querySelector("button"); if (b) b.focus({ preventScroll: true });
      say("Alternativas del celular: elige un tema");
    }
    function controlsHTML(o) {
      var h = "";
      if (o.walk) h += '<button type="button" class="seq-finish" data-act="walk-again">Volver a intentar</button>';
      if (o.toggle) h += '<button type="button" class="seq-toggle" data-act="light" role="switch" aria-checked="' + live.light + '"><span class="knob" aria-hidden="true"></span><span class="lbl">' + (live.light ? "Apagar la linterna" : "Encender la linterna") + "</span></button>";
      if (o.airplane) h += '<button type="button" class="seq-toggle" data-act="air" role="switch" aria-checked="' + live.airplane + '"><span class="knob" aria-hidden="true"></span><span class="lbl">' + (live.airplane ? "Desactivar el modo avión" : "Activar el modo avión") + "</span></button>";
      if (o.network) h += '<button type="button" class="seq-toggle" data-act="net" role="switch" aria-checked="' + !!live.net + '"><span class="knob" aria-hidden="true"></span><span class="lbl">' + (live.net ? "Volver a la red automática (5G)" : "Cambiar a una red más básica (simulado)") + "</span></button>";
      if (o.search) h += '<button type="button" class="seq-again" data-act="search">Buscar señal (simulado)</button>';
      return h;
    }
    /* un texto o varios párrafos (lista) */
    function paras(x) { return (Array.isArray(x) ? x : [x]).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join(""); }
    function introTitle(o) { return o.introTitle ? o.introTitle : J.module === "torch" ? "¿Qué es el código Morse?" : o.sms ? "¿Qué es un SMS?" : o.airplane ? "¿Qué es el modo avión?" : o.search ? "¿Qué es la cobertura?" : o.call ? "¿Qué es una llamada breve?" : o.network ? "¿Qué significa probar otra red?" : o.tuner ? "¿Qué es una radio AM/FM?" : "¿Qué es?"; }
    var folded = true;    // cuadro de información plegado (solo queda la barra con el nombre del tema); empieza cerrado y el usuario lo abre
    function setFold(v) { folded = !!v; card.classList.toggle('is-folded', folded); var b = card.querySelector('.seq-fold'); if (b) { b.setAttribute('aria-expanded', String(!folded)); b.querySelector('.sf-lbl').textContent = folded ? 'Ver información' : 'Ocultar información'; } card.scrollTop = 0; say(folded ? 'Información plegada' : 'Información desplegada'); }
    function renderCard(focusAct) {
      updateTopicNav();
      var o = topic(), pick = "";
      /* con historia: tarjeta corta «Lo aprendido» (frase clave, mensaje, tres fichas y «Saber más» con el texto completo) */
      card.classList.toggle("seq-learned", hasStory());
      if (hasStory()) {
        card.classList.remove("is-folded"); card.innerHTML = learnedHTML(o); card.setAttribute("aria-labelledby", "seq-title"); miniCtx = null;
        if (unmountTuner) { unmountTuner(); unmountTuner = null; }
        if (focusAct) { var lf = card.querySelector('[data-act="' + focusAct.act + '"]'); if (lf) lf.focus({ preventScroll: true }); }
        return;
      }
      /* sin «Elige un tema para explorar»: se avanza con el botón amarillo (siguiente) y se vuelve con el botón de abajo a la izquierda (anterior) */
      /* botón para plegar o desplegar el cuadro (se mantiene al cambiar de tema) */
      var fold = '<button type="button" class="seq-fold" data-act="fold" aria-expanded="' + !folded + '"><span><span class="sf-lbl">' + (folded ? 'Ver información' : 'Ocultar información') + '</span><br>' + esc(o.name) + '</span><span class="sf-chev" aria-hidden="true"></span></button>';
      card.classList.toggle('is-folded', folded);
      card.innerHTML = fold + pick + '<h2 id="seq-title">' + (o.icon === "sms" ? ICON_SMS : o.icon === "phone" ? ICON_PHONE : "") + esc(o.name) + "</h2>" +
        (o.tuner && FLAT ? tunerHTML() : "") +
        (o.intro ? "<h3>" + esc(introTitle(o)) + "</h3><p>" + esc(o.intro) + "</p>" : "") + (o.walk ? walkHTML(o) : "") +
        (J.guide && J.guide.s3 ? "<h3>" + esc(J.guide.s3.title) + "</h3><p>" + esc(J.guide.s3.text) + "</p>" + seqHTML() + "<p>" + esc(J.guide.s3.zone) + "</p>" : "") +
        "<h3>" + esc(o.whatTitle || "Cómo ayuda") + "</h3>" + paras(o.what) +
        (o.safety ? '<div class="seq-safety"><h3>' + esc(o.safetyTitle) + "</h3><p>" + esc(o.safety) + "</p></div>" : "") +
        (o.why ? "<h3>¿Por qué es útil cuando hay problemas de conectividad?</h3><p>" + esc(o.why) + "</p>" : "") +
        netHTML(o) + (o.limit ? "<h3>Condiciones y límites</h3>" + paras(o.limit) : "") +
        (FLAT && o.hint ? '<p class="seq-hint"><b>Interacción:</b> ' + esc(o.hint) + "</p>" : "") +
        (FLAT && o.tutorial ? smsHTML(o) : "") + (FLAT && o.voice ? voiceHTML(o) : "") +
        '<div class="seq-actions">' + (FLAT ? controlsHTML(o) : o.walk ? controlsHTML(o) : "") +
        (FLAT ? "" : '<button type="button" class="seq-again" data-act="again">Repetir práctica</button>') +
        /* en vez de «Finalizar recorrido»: el mismo destino que el botón amarillo de abajo (siguiente alternativa) */
        '<a class="seq-finish seq-card-next" data-nav href="' + esc(NAV.next.href) + '"' + (NAV.next.topic ? ' data-nav-topic="' + esc(NAV.next.topic) + '"' : "") + ">" + esc(NAV.next.label) + ' <span aria-hidden="true">→</span></a></div>';
      card.setAttribute("aria-labelledby", "seq-title");
      var mc = card.querySelector(".seq-mini"); miniCtx = mc ? mc.getContext("2d") : null; miniAt = 0;
      if (o.tutorial) tutState();
      if (o.voice) voiceSync(false);
      if (unmountTuner) { unmountTuner(); unmountTuner = null; }
      if (o.tuner && window.FFTuner) unmountTuner = window.FFTuner.mount(card);
      if (focusAct) { var f = card.querySelector('[data-act="' + focusAct.act + '"]' + (focusAct.v ? '[data-v="' + focusAct.v + '"]' : "")); if (f) f.focus({ preventScroll: true }); }
    }

    /* ---------- sin WebGL: versión plana (mismo cuadro y mismos controles) ---------- */
    var renderer = null;
    try {
      if (!window.THREE || !window.FFHub || !window.FFHub.models || !modules[J.module]) throw new Error("sin three");
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
      if (!renderer.getContext()) throw new Error("sin webgl");
    } catch (e) { renderer = null; }

    if (!renderer) return startFlat();

    function startFlat() {
      function selectFlatTopic(id) {
        topicId = id; bye.hidden = true; card.hidden = false; card.scrollTop = 0;
        renderCard({ act: "topic", v: id });
        if (cfg.onTopic) cfg.onTopic(id);
      }
      FLAT = true;
      var flat = document.createElement("div"); flat.className = "seq-flat" + (J.module === "torch" ? " dark" : "");
      flat.innerHTML = '<img class="sf-bg" alt="" src="' + Zn.img + '"><img class="sf-char" alt="' + esc(Zn.who + ", " + Zn.role) + '" src="' + Zn.char + '"><img class="sf-obj" alt="" src="' + J.flatImg + '"><div class="sf-dark"></div>';
      root.querySelector(".seq-stage").appendChild(flat); root.classList.add("seq-flatmode");
      $(".seq-hud").hidden = true;
      card.hidden = false; renderCard(); setStep(4);
      if (cfg.onTopic) cfg.onTopic(topicId);
      card.addEventListener("click", function (e) {
        var b = e.target.closest("[data-act]"); if (!b) return; var a = b.getAttribute("data-act");
        if (a === "topic") { selectFlatTopic(b.getAttribute("data-v")); }
        else if (a === "light") { live.light = !live.light; root.classList.toggle("seq-on", live.light); renderCard({ act: "light" }); }
        else if (a === "air") { live.airplane = !live.airplane; renderCard({ act: "air" }); }
        else if (a === "net") { live.net = live.net ? 0 : 1; renderCard({ act: "net" }); }
        else if (a.indexOf("vz-") === 0) voiceAct(a);
        else if (a === "walk-again") { walkTry++; renderCard({ act: "walk-again" }); }
        else if (a === "walk-topics") walkTopics();
        else if (a === "fold") setFold(!folded);
        else if (a === "finish") { card.hidden = true; bye.hidden = false; var m = bye.querySelector(".seq-menu"); if (m) m.focus(); }
      });
      window.FFSms.attach(card, live, { changed: function () { tutState(); } });
      var ag = $('[data-act="again"]'); if (ag) ag.hidden = true;
      bye.querySelector(".seq-repeat").addEventListener("click", function () { bye.hidden = true; card.hidden = false; });
      return { stop: function () { clearInterval(vzTimer); root.innerHTML = ""; root.classList.remove("seq-flatmode", "seq-on"); }, flat: true, nav: NAV, setTopic: selectFlatTopic, interacting: function () { return false; } };
    }

    /* ---------- 3D: escena común ---------- */
    var M = window.FFHub.models, toon = M.toon, basic = M.basic, rbox = M.rbox, canvasTex = M.canvasTex;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
    var ambient = new THREE.AmbientLight(0x8fa0cc, 0.2); scene.add(ambient);
    var heroKey = new THREE.DirectionalLight(0xffe2b0, 1.1); heroKey.position.set(3, 5, 6); scene.add(heroKey);
    heroKey.castShadow = true; heroKey.shadow.mapSize.set(innerWidth < 720 ? 1024 : 2048, innerWidth < 720 ? 1024 : 2048);
    Object.assign(heroKey.shadow.camera, { left: -5, right: 5, top: 6, bottom: -3, near: .1, far: 25 });
    heroKey.shadow.bias = -.0003; heroKey.shadow.normalBias = .035; heroKey.shadow.radius = 3;
    var heroFill = new THREE.HemisphereLight(0xcfe0ff, 0x2a2230, 0.75); scene.add(heroFill);
    var V = function (x, y, z) { return new THREE.Vector3(x, y, z); };

    /* materiales compartidos de las manos (el color de piel y la manga cambian con el contexto) */
    var skin = toon(0xd9996a), gold = toon(0xd9a441);
    var plaid = canvasTex(256, 256, function (x, w, h) {
      x.fillStyle = "#ece6d8"; x.fillRect(0, 0, w, h);
      x.fillStyle = "rgba(120,108,100,.5)"; for (var i = 0; i < 4; i++) { x.fillRect(i * 64 + 6, 0, 22, h); x.fillRect(0, i * 64 + 6, w, 22); }
      x.fillStyle = "rgba(70,60,56,.45)"; for (var j = 0; j < 4; j++) { x.fillRect(j * 64 + 14, 0, 6, h); x.fillRect(0, j * 64 + 14, w, 6); }
    });
    plaid.wrapS = plaid.wrapT = THREE.RepeatWrapping; plaid.repeat.set(2, 2);
    var floral = canvasTex(256, 160, function (x, w, h) {
      x.fillStyle = "#2a1f2e"; x.fillRect(0, 0, w, h);
      var cols = ["#e85d8c", "#8a5cc2", "#f08a4b", "#f5b335", "#4b7bd6", "#d7342a", "#3fa76a"];
      for (var i = 0; i < 46; i++) { var cx = (i * 53) % w, cy = (i * 37) % h, r = 7 + (i % 4) * 3, c = cols[i % cols.length];
        for (var k = 0; k < 5; k++) { var a = k * 1.2566; x.fillStyle = c; x.beginPath(); x.arc(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9, r * 0.62, 0, 6.3); x.fill(); }
        x.fillStyle = "#f6e6a8"; x.beginPath(); x.arc(cx, cy, r * 0.4, 0, 6.3); x.fill(); }
    });
    var sleeveMat = toon(0xffffff, { map: floral });
    var armVariants = { plaid: [], floral: [] }, bracelets = [];
    function limb(a, b, r, mat) {
      var dir = b.clone().sub(a), len = dir.length();
      var m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(len - 2 * r, 0.01), 6, 12), mat);
      m.position.copy(a).addScaledVector(dir, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize()); return m;
    }
    /* antebrazo desde la muñeca `w` hacia `dir`: manga de cuadros (zona rural) o antebrazo con brazalete y manga floral (zona urbana) */
    function makeArm(w, dir, parent) {
      var d = dir.clone().normalize(), E = w.clone().addScaledVector(d, 1.6), g = new THREE.Group(); parent.add(g);
      var wristSkin = limb(w, w.clone().addScaledVector(d, 0.5), 0.2, skin); g.add(wristSkin);
      var tube = limb(w.clone().addScaledVector(d, 0.38), E, 0.27, sleeveMat); armVariants.plaid.push(tube); g.add(tube);
      var fore = limb(w.clone().addScaledVector(d, 0.45), E, 0.2, skin); armVariants.floral.push(fore); g.add(fore);
      var br = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 24), gold); br.position.copy(w).addScaledVector(d, 0.42); br.quaternion.setFromUnitVectors(V(0, 0, 1), d); bracelets.push(br); g.add(br);
      var puff = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 14), sleeveMat); puff.scale.set(1, 0.85, 1); puff.position.copy(E).addScaledVector(d, 0.1); armVariants.floral.push(puff); g.add(puff);
      return g;
    }
    /* dedo "elástico": un cilindro entre dos puntos (base y punta) con la punta redondeada; sirve para pulgares que tocan la pantalla o giran una perilla */
    function digit(r) {
      var g = new THREE.Group(), cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, 1, 12), skin), tip = new THREE.Mesh(new THREE.SphereGeometry(r * 1.12, 14, 12), skin), base = new THREE.Mesh(new THREE.SphereGeometry(r * 1.08, 12, 10), skin);
      g.add(cyl); g.add(tip); g.add(base); g.userData = { cyl: cyl, tip: tip, base: base, up: V(0, 1, 0), q: new THREE.Quaternion(), d: V(0, 0, 0) };
      return g;
    }
    function aim(g, a, b) {
      var u = g.userData; u.d.copy(b).sub(a); var len = Math.max(u.d.length(), 0.001);
      u.cyl.position.copy(a).addScaledVector(u.d, 0.5); u.cyl.scale.set(1, len, 1); u.cyl.quaternion.setFromUnitVectors(u.up, u.d.clone().normalize());
      u.tip.position.copy(b); u.base.position.copy(a);
    }

    /* entorno: suelo, fondo, personaje (aparece solo en el plano completo) */
    var env = new THREE.Group(); scene.add(env); var envMats = [];
    function envMat(m) { m.transparent = true; m.opacity = 0; envMats.push(m); return m; }
    var groundMat = envMat(new THREE.MeshLambertMaterial({ color: 0x3a3440 }));
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.z = 6; env.add(ground); ground.receiveShadow = true;
    var bgMat = envMat(new THREE.MeshBasicMaterial({ color: 0xffffff }));   // cielo (degradado)
    var bg = new THREE.Mesh(new THREE.PlaneGeometry(110, 60), bgMat); bg.position.set(0, 14, -30); env.add(bg);
    var charGroup = new THREE.Group(); env.add(charGroup);
    /* sombra de contacto: una mancha suave justo bajo los pies, para que el personaje se vea apoyado en el suelo
       (la sombra de la luz principal cae hacia atrás y a un lado y no toca las botas) */
    var footMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      map: M.canvasTex(128, 128, function (x, w, h) { var g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, "rgba(20,24,16,.75)"); g.addColorStop(0.55, "rgba(20,24,16,.35)"); g.addColorStop(1, "rgba(20,24,16,0)"); x.fillStyle = g; x.fillRect(0, 0, w, h); }) });
    var footShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.85), footMat); footShadow.rotation.x = -Math.PI / 2; footShadow.renderOrder = 1; env.add(footShadow);
    function footFrame(a) { footShadow.scale.set(CK, CK, 1); footShadow.position.set(charGroup.position.x, 0.006, charGroup.position.z + 0.05); footShadow.rotation.z = -charGroup.rotation.y; footMat.opacity = 0.55 * a; footShadow.visible = !!character && a > 0.01; }
    // Compatibility lighting handle for close-up modules; the character itself
    // retains its original emissive maps/colors and uses the shared scene lights.
    var charMat = { emissiveIntensity: 0 }, character = null, characterRequest = 0;
    env.visible = false;
    root.removeAttribute("data-scenery-status");
    var CK;   // tamaño del personaje en esta zona (1 = 4,4 unidades); lo define el escenario (scenery.charScale), justo abajo
    var scenery = window.FFScenery.build({ THREE: THREE, M: M, env: env, envMat: envMat, V: V, bg: bg, ground: ground, camera: camera,
      status: function (s) { if (!alive) return; root.setAttribute("data-scenery-status", s); if (s === "error") frameWide(); } }, ctxId);   // con la ciudad de respaldo, la cámara vuelve a su encuadre de siempre
    bgMat.map = scenery.sky; CK = scenery.charScale || 1;
    if (scenery.far) camera.far = scenery.far;   // el escenario urbano de Blender es más profundo que el plano lejano por defecto
    function loadCharacter() {
      var request = ++characterRequest;
      root.setAttribute("data-character-status", "loading");
      window.FFCharacters.load(ctxId, charGroup).then(function (loaded) {
        if (!alive || request !== characterRequest) { loaded.dispose(); return; }
        if (character) character.dispose(); character = loaded;
        root.setAttribute("data-character-status", "ready");
        root.setAttribute("data-character-model", ctxId);
        root.setAttribute("data-character-materials", String(loaded.materials.length));
        // Match the original skin and cloth also in the close-up hands.
        if (loaded.skin) { skin.color.copy(loaded.skin.color); skin.userData.base.copy(loaded.skin.color); skin.map = loaded.skin.map; skin.needsUpdate = true; }
        if (loaded.shirt) { sleeveMat.color.copy(loaded.shirt.color); sleeveMat.map = loaded.shirt.map; sleeveMat.needsUpdate = true; }
      }).catch(function (error) {
        if (!alive || request !== characterRequest) return;
        root.setAttribute("data-character-status", "error");
        say("No se pudo cargar el personaje 3D. Recarga la página para volver a intentarlo."); console.error("Personaje 3D:", error);
      });
    }

    /* módulo de la alternativa */
    var ctx3d = { THREE: THREE, M: M, scene: scene, env: env, envMat: envMat, skin: skin, gold: gold, sleeveMat: sleeveMat, limb: limb, makeArm: makeArm, digit: digit, aim: aim, V: V, camera: camera,
      toon: toon, basic: basic, rbox: rbox, canvasTex: canvasTex, reduce: reduce, charGroup: charGroup, charMat: charMat, root: root, guided: !!G,
      act: function (a, v) { practiceAct(a, v); },
      setLight: function (v) { setLight(v, true); }, setAirplane: function (v) { setAirplane(v); } };
    var mod = modules[J.module](ctx3d);
    mod.onReady = function () { if (alive && camHero) pickCams(); };   // un modelo de Blender que llega después (radio de Cali): se vuelve a encuadrar
    if (mod.setApagon) mod.setApagon(APAGON);   // linterna en Cali: luz más visible (cono, círculo en el suelo); en Cauca queda como antes
    var dark = !!mod.dark;
    if (scenery.setNight) scenery.setNight(dark);
    var rig = new THREE.Group(); rig.add(mod.root); scene.add(rig); mod.root.traverse(function(o) { if(o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    renderer.setClearColor(dark ? 0x0a0d16 : 0x14303a, 1);
    if (dark) scene.fog = new THREE.Fog(0x0a0d16, scenery.fog ? scenery.fog[0] : 14, scenery.fog ? scenery.fog[1] : 30);
    var LIGHT = dark ? { key: 0.12, fill: 0.22, amb: 0.16, emi: 0.5 } : { key: 1.0, fill: 0.35, amb: 0.12, emi: 0 };
    var HEROL = dark ? { key: 1.1, fill: 0.75, amb: 0.2 } : { key: 0.62, fill: 0.42, amb: 0.2 };

    var C3 = CTX3D[ctxId], wristLocal = V(0, 0, 0);
    function applyContext() {
      C3 = CTX3D[ctxId]; wristLocal.set(C3.wrist[0], C3.wrist[1], C3.wrist[2]);
      skin.color.setHex(C3.skin); skin.userData.base.setHex(C3.skin);
      sleeveMat.map = C3.sleeve === "plaid" ? plaid : floral; sleeveMat.needsUpdate = true;
      armVariants.plaid.forEach(function (m) { m.visible = C3.sleeve === "plaid"; }); armVariants.floral.forEach(function (m) { m.visible = C3.sleeve !== "plaid"; });
      bracelets.forEach(function (m) { m.visible = C3.bracelet; });

      groundMat.color.setHex(dark ? 0x3a3440 : C3.ground);
      bgMat.color.setHex(dark ? 0x2c2c40 : 0xffffff);
      loadCharacter();
      frameWide(); if (mod.setContext) mod.setContext(ctxId, C3);
    }

    /* ---------- cámaras ---------- */
    var camWide = { p: V(0, 2.7, 11.4), l: V(0, 2.1, 0) }, aspect = 1, portrait = false, camHero = null, camClose = null;
    function pickCams() { var c = mod.cams(portrait, aspect, Math.tan(camera.fov * Math.PI / 360)); camHero = c.hero; camClose = practiceCam() || c.close; }
    function frameWide() {
      portrait = aspect < 0.9; var fov = portrait ? 42 : 30; camera.fov = fov; camera.updateProjectionMatrix();
      var tn = Math.tan(fov * Math.PI / 360);
      var fill = (scenery.wide && scenery.wide.fill) || [0.34, 0.74];   // fracción del alto que ocupa el personaje [vertical, horizontal]; la zona rural la reduce para ver más paisaje
      if (portrait) { var Hv = 4.4 / fill[0], D = Hv / (2 * tn); camWide.l.set(0.5, 2.2 - (0.5 - 0.31) * Hv, 0); camWide.p.set(0.5, camWide.l.y + 1.8, D); }
      else { var Hv2 = 4.4 / fill[1], D2 = Hv2 / (2 * tn), Wv = Hv2 * aspect, shift = aspect > 1.15 ? (0.5 - 0.33) * Wv : 0, lift = scenery.wide || { dy: 0, dl: 0 }; camWide.l.set(0.3 + shift, 2.05 + lift.dl, 0); camWide.p.set(0.3 + shift, 2.7 + lift.dy, D2); }   // zona urbana: cámara un poco más baja y mirando levemente hacia arriba para que se vean los edificios
      if (scenery.fit) scenery.fit(camWide, fov, aspect);   // zona rural: el paisaje pintado se encuadra con esta cámara (js/scenery.js)
      pickCams();
    }
    function resize() {
      var w = root.clientWidth || 1, h = root.clientHeight || 1; renderer.setSize(w, h, false); aspect = w / h;
      frameWide(); camera.aspect = aspect; camera.updateProjectionMatrix();
    }
    var ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null; if (ro) ro.observe(root); else window.addEventListener("resize", resize);

    /* ---------- línea de tiempo ---------- */
    var E = reduce ? step : smooth, t = 0, tl = null, holdT = false;
    /* etapa 2 = práctica: la cámara llega al objeto (c0) y el tiempo se detiene en c0 + PHOLD hasta que el usuario pulsa «Continuar».
       A (duración de la antigua demostración con manos) solo se conserva como «estado final» de la pantalla del objeto (info.A). */
    var PHOLD = 0.3;
    function plan(skipHero) {
      var H = skipHero ? 0 : T_HERO, A = mod.duration(topicId), c0 = H + T_CLOSE, c1 = c0 + PHOLD + 0.05, w1 = c1 + TIMES.toWide;
      tl = { H: H, c0: c0, c1: c1, w1: w1, card: c1 + TIMES.cardAfter, A: A, fromWide: !!skipHero };
      if (topic().walk) tl.card = w1 + WALK.card;   // «Buscar un lugar con mejor señal»: el cuadro llega después de caminar y consultar la señal
      if (mod.cardAt && mod.cardAt() != null) tl.card = w1 + mod.cardAt();   // radio en la zona rural: después de la escena de la antena
      if (hasStory()) tl.card = Infinity;           // historia: la tarjeta llega después de que el usuario envía el mensaje (ver storySend)
    }
    function resetLive() { live.walk.sig = "none"; live.walk.bars = 0; live.voice = window.FFVoice.fresh(); live.voice.n = 0; clearInterval(vzTimer); vzTimer = 0; live.light = false; live.airplane = false; live.sms = window.FFSms.fresh(); live.net = 0; live.netAt = live.searchAt = live.recAt = -1e9; live.call = { step: 0, at: 0, end: 0 }; live.tapAt = -1e9; live.tapCh = ""; if (mod.reset) mod.reset(); }
    function hideCard() { card.hidden = true; hot.hidden = true; root.classList.remove("seq-done"); }
    function restart(skipHero) {
      if (camHero) pickCams();
      window.FFSms.example = topic().exampleMsg ? tr(topic().exampleMsg) : window.FFSms.EXAMPLE_MSG;   // mensaje de ejemplo de la práctica: el de la alternativa (Cauca: un saludo)
      storyReset(); relabelSteps(); bodyReset();
      bye.hidden = true; hideCard(); shown.card = false; plan(skipHero); resetLive(); practiceOff(); P.released = false; t = 0; skipBtn.hidden = false; setStep(skipHero ? 2 : 1);
      holdT = false;
      if (reduce) { holdT = true; t = skipHero ? tl.c0 + PHOLD : Math.max(0.05, tl.H * 0.8); setStep(skipHero ? 2 : 1); }
    }
    var pendingFocus = null;
    function toEnd() { /* plano completo con el cuadro ya visible (visita repetida o «saltar») */
      practiceOff(); P.released = true; bodyReset();
      plan(true); resetLive(); if (mod.finish) mod.finish();
      if (hasStory()) { storyFinish(); tl.card = tl.w1 + composeAt(); }
      t = tl.card + 0.01; bye.hidden = true; holdT = reduce; skipBtn.hidden = true;
      if (G) { stopPlay(); G.n = 5; G.gate = Infinity; mod.slow = false; mod.sos = !APAGON; mod.mode = null; setHotMode("toggle"); }
    }
    function goStep(n) {
      if (G) { if (n === 1) restart(false); else if (n === 2 || n === 3) guideJump(n); else toEnd(); return; }
      if (n === 1) restart(false);
      else if (n === 2) restart(true);
      else if (n === 3) { practiceOff(); P.released = true; bodyReset(); if (hasStory()) { storyReset(); tl.card = Infinity; } t = tl.c1 + (reduce ? 0.25 : 0.0); bye.hidden = true; hideCard(); shown.card = false; skipBtn.hidden = false; holdT = reduce; if (mod.finish) mod.finish(); setStep(3); }
      else { toEnd(); }
    }
    function showCard() {
      if (shown.card || !bye.hidden) return; shown.card = true;
      card.classList.remove("seq-guided"); setHotMode("toggle"); card.hidden = false; renderCard(pendingFocus); pendingFocus = null; skipBtn.hidden = true; setStep(4);
      hot.hidden = true;   // la interacción ya se hizo en la práctica: el cuadro final solo informa
      root.classList.add("seq-done");   // al terminar la alternativa aparece, abajo a la izquierda, el botón de la alternativa anterior
      if (cfg.onTopic) cfg.onTopic(topicId);
      if (cfg.onIntro) cfg.onIntro();
    }

    /* ---------- controles ---------- */
    function setLight(v, silent) { var chg = live.light !== !!v; live.light = !!v; live.kick = performance.now(); if (chg && !silent && window.FFAudio) window.FFAudio.click(live.light); root.classList.toggle("seq-on", live.light); syncHot();
      if (G && !shown.card) { var gb = card.querySelector('[data-g="light"]'); if (gb) { gb.setAttribute("aria-checked", live.light); gb.querySelector(".lbl").textContent = live.light ? "Apagar la linterna" : "Encender la linterna"; } }   // el botón de la guía refleja el estado real de la luz
      if (shown.card) { var b = card.querySelector('[data-act="light"]'); if (b) { b.setAttribute("aria-checked", live.light); b.querySelector(".lbl").textContent = live.light ? "Apagar la linterna" : "Encender la linterna"; } } }
    function setAirplane(v) {
      var was = live.airplane; live.airplane = !!v; live.kick = performance.now(); if (was && !live.airplane) live.recAt = live.kick;
      var b = card.querySelector('[data-act="air"]'); if (b) { b.setAttribute("aria-checked", live.airplane); b.querySelector(".lbl").textContent = live.airplane ? "Desactivar el modo avión" : "Activar el modo avión"; }
      say(live.airplane ? "Modo avión activado (simulado)" : "Modo avión desactivado: reconexión ilustrativa");
      var A = window.FFAudio; if (A) { A.cancelLater(); A.airplane(live.airplane); if (!live.airplane) A.after(2800, function () { A.blip(); }); }   // el aviso coincide con el cambio visual «Reconexión ilustrativa»
    }
    function setNet(v) {
      live.net = v ? 1 : 0; live.kick = live.netAt = performance.now();
      var b = card.querySelector('[data-act="net"]'); if (b) { b.setAttribute("aria-checked", !!live.net); b.querySelector(".lbl").textContent = live.net ? "Volver a la red automática (5G)" : "Cambiar a una red más básica (simulado)"; }
      say(live.net ? "Tipo de red: 3G (simulado). Internet más lento; llamadas y SMS pueden funcionar. No garantiza conexión" : "Tipo de red: automático, 5G (simulado)");
      var A = window.FFAudio; if (A) { A.cancelLater(); A.airplane(!!live.net); if (live.net) A.after(2400, function () { A.blip(); }); }
    }
    function doSearch() { live.searchAt = live.kick = performance.now(); say("Buscando señal (simulado)"); var A = window.FFAudio; if (A) { A.cancelLater(); A.click(true); A.after(3200, function () { A.blip(); }); } }
    function syncHot() { hot.setAttribute("aria-checked", live.light ? "true" : "false"); hot.setAttribute("aria-label", "Interruptor de la linterna: " + (live.light ? "encendida. Púlsalo para apagar" : "apagada. Púlsalo para encender")); }
    skipBtn.addEventListener("click", function () { toEnd(); });
    stepLis.forEach(function (li) { li.querySelector("button").addEventListener("click", function () { goStep(+li.getAttribute("data-i")); }); });
    bye.querySelector(".seq-repeat").addEventListener("click", function () { restart(false); });
    function swapTopic(id) { topicId = id; updateTopicNav(); card.scrollTop = 0; pendingFocus = { act: "topic", v: id }; if (mod.setTopic) mod.setTopic(id); restart(true); say("Tema: " + topic().name); }
    card.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return; var a = b.getAttribute("data-act"), v = b.getAttribute("data-v");
      if (a === "topic" && v !== topicId) { swapTopic(v); }
      else if (a === "light") setLight(!live.light);
      else if (a === "air") setAirplane(!live.airplane);
      else if (a === "net") setNet(!live.net);
      else if (a === "search") doSearch();
      else if (a.indexOf("vz-") === 0) voiceAct(a);
      else if (a === "walk-again") walkAgain();
      else if (a === "walk-topics") walkTopics();
      else if (a === "story-again") goStep(3);
      else if (a === "again") { pendingFocus = { act: "again" }; if (G) guideJump(4); else restart(true); }
      else if (a === "fold") setFold(!folded);
      else if (a === "finish") { hideCard(); bye.hidden = false; say("Despedida"); var m = bye.querySelector(".seq-menu"); if (m) m.focus(); }
    });
    window.FFSms.attach(card, live, { say: say, changed: function (snd) {
      live.kick = performance.now(); tutState(); var A = window.FFAudio; if (!A || !snd) return;
      if (snd === "send") { A.send(); say("Envío simulado"); } else if (snd === "del") A.del(); else if (snd === "click") A.click(true); else A.key(snd);
    } });

    /* objetos 3D que el usuario puede tocar (la radio: perillas y selector de banda). Solo en el plano completo y con el cuadro visible. */
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), pick = null, hoverAt = 0;
    function toNdc(e) { var r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
    /* posición en pantalla (px del cliente) del centro de un objeto 3D: la usa la radio para girar la perilla siguiendo el ángulo del cursor */
    var scrV = new THREE.Vector3();
    function toScreen(obj) { var r = canvas.getBoundingClientRect(); obj.getWorldPosition(scrV).project(camera); return { x: r.left + (scrV.x + 1) / 2 * r.width, y: r.top + (1 - scrV.y) / 2 * r.height }; }
    function pickable() { return mod.pickables && P.on && info.stage === "close" && bye.hidden; }   // solo durante la práctica, con el objeto en el centro
    canvas.addEventListener("pointerdown", function (e) {
      if (!pickable()) return; toNdc(e); var hits = ray.intersectObjects(mod.pickables, false); if (!hits.length) return;
      pick = { hit: hits[0], x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY, moved: false, toScreen: toScreen }; try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
      if (mod.onPick) mod.onPick("down", pick, 0, 0); e.preventDefault();
    });
    canvas.addEventListener("pointermove", function (e) {
      if (pick) { var dx = e.clientX - pick.x, dy = e.clientY - pick.y; pick.cx = e.clientX; pick.cy = e.clientY; if (Math.abs(dx) + Math.abs(dy) > 6) pick.moved = true; if (mod.onPick) mod.onPick("move", pick, dx, dy); return; }
      if (e.pointerType === "mouse" && pickable() && performance.now() - hoverAt > 60) { hoverAt = performance.now(); toNdc(e); canvas.style.cursor = ray.intersectObjects(mod.pickables, false).length ? "pointer" : ""; }
    });
    canvas.addEventListener("pointerup", function (e) { if (!pick) return; var p = pick; pick = null; if (mod.onPick) mod.onPick("up", p, e.clientX - p.x, e.clientY - p.y); });
    canvas.addEventListener("pointercancel", function () { pick = null; });

    /* ---------- simulación del sismo (solo zona urbana, al entrar) ----------
       Movimientos suaves y acotados: cámara ±3 cm y 0,3° de giro, edificios y postes oscilan ~1°, luces que parpadean y objetos de la calle que vibran.
       Durante el movimiento la chica (modelo 3D) muestra un «!», cierra los ojos en «> <», flexiona un poco las piernas, inclina tronco y cabeza y sube
       los brazos con las manos abiertas. Cuando el movimiento termina recupera su postura y expresión normales, con las manos abiertas (sin el agarre del objeto). */
    var qk = $(".seq-quake"), qState = null, QDUR = 5.0, surprise = null;
    /* zona rural: «Sin señal». Mateo mira a su alrededor, se angustia (se lleva las manos a la cabeza) y aparece una nube de pensamiento
       «¡No tengo señal!». Sin temblor ni sonido. Con «reducir movimiento» se ve la postura quieta y la nube. */
    var NSDUR = 4.6;
    function startNoSignal() {
      qState = { t: 0, phase: "during", kind: "nosignal" }; rig.visible = false; hideCard(); root.classList.add("seq-quaking"); qk.hidden = false; qk.classList.remove("after");
      qk.querySelector(".seq-qk").textContent = QTX.during; qk.querySelector(".seq-qt").textContent = QTX.duringText;
      qk.querySelector(".seq-qgo").hidden = true; qk.querySelector(".seq-qskip").hidden = false; say(QTX.during + ": " + QTX.duringText);
      think.querySelector("p").textContent = tr(QTX.bubble || "¡No tengo señal!");
      if (reduce) { qState.t = NSDUR + 0.1; quakeAfter(); }
    }
    function noSignalFrame(dt) {
      qState.t += dt; var qt = qState.t;
      if (qState.phase === "during" && qt >= NSDUR) quakeAfter();
      env.visible = true; envMats.forEach(function (m) { m.opacity = 1; });
      camera.position.copy(camWide.p); camera.lookAt(camWide.l);
      heroKey.intensity = LIGHT.key; heroFill.intensity = LIGHT.fill; ambient.intensity = LIGHT.amb; charMat.emissiveIntensity = LIGHT.emi;
      scenery.update(qt, 0);
      /* 0–1 s: mira a los lados buscando señal · desde 1 s: angustia (manos a la cabeza, ojos cerrados) y la nube · al final se calma un poco */
      var ang = reduce ? 0.55 : 0.6 * smooth((qt - 0.9) / 0.9) * (qState.phase === "after" ? 1 - 0.35 * smooth((qt - NSDUR) / 1.2) : 1);
      var look = reduce ? 0 : Math.sin(qt * 2.1) * 0.32 * (1 - smooth((qt - 1.2) / 0.6)) + Math.sin(qt * 7.5) * 0.05 * ang;
      charGroup.scale.setScalar(CK); charGroup.position.set(0, 0, 0); charGroup.rotation.set(0, look, 0);
      if (character) {
        if (qt >= 0.9) bodyOnce("nosig", function (c) { c.gesture("shake"); });   // «¡No tengo señal!»: niega con la cabeza
        character.pose = "worry"; character.lookAt = null; character.talking = false;
        character.fear = ang; character.update(qt, topicId, "quake", reduce, false, 1);
      }
      var showT = reduce || qt >= 1.1;
      think.hidden = !showT;
      if (showT) {   // la nube va arriba de la cabeza de Mateo, a su izquierda en pantalla (a la derecha queda el recuadro con el texto)
        u3.set(-0.25 * CK, 4.85 * CK, 0).project(camera); var w = root.clientWidth, h = root.clientHeight, bw = think.offsetWidth, bh = think.offsetHeight;
        var sx = (u3.x + 1) / 2 * w - bw, sy = (1 - u3.y) / 2 * h - bh;
        think.style.left = Math.max(10, Math.min(w - bw - 10, sx)) + "px"; think.style.top = Math.max(64, sy) + "px";
      }
      footFrame(env.visible ? groundMat.opacity : 0); renderer.render(scene, camera);
    }
    function startQuake() {
      if (NOSIG) { startNoSignal(); return; }
      surprise =new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, function (x) { x.fillStyle = "#fff4d6"; x.beginPath(); x.arc(64, 64, 56, 0, 6.3); x.fill(); x.strokeStyle = "#d7342a"; x.lineWidth = 8; x.stroke(); x.fillStyle = "#d7342a"; x.font = "bold 84px Arial"; x.textAlign = "center"; x.fillText("!", 64, 92); }), transparent: true, opacity: 0, depthTest: false }));
      surprise.scale.set(0.9, 0.9, 1); surprise.position.set(1.15, 4.05, 0.5); scene.add(surprise);
      bodyReset(); qState = { t: 0, phase: "during" }; rig.visible = false; hideCard(); root.classList.add("seq-quaking"); qk.hidden = false; qk.classList.remove("after");
      qk.querySelector(".seq-qk").textContent = QTX.during; qk.querySelector(".seq-qt").textContent = QTX.duringText + (reduce ? " " + QTX.still : "");
      qk.querySelector(".seq-qgo").hidden = true; qk.querySelector(".seq-qskip").hidden = false; say(QTX.during + ": " + QTX.duringText);
      if (!reduce && window.FFAudio) window.FFAudio.quake(true);
      if (reduce) { qState.t = QDUR + 0.7; qState.phase = "after"; quakeAfter(); }
    }
    function quakeAfter() {
      qState.phase = "after"; if (window.FFAudio) window.FFAudio.quake(false); qk.classList.add("after"); qk.querySelector(".seq-qk").textContent = reduce ? QTX.during + " · " + QTX.after : QTX.after; qk.querySelector(".seq-qt").textContent = reduce ? QTX.duringText + " " + QTX.still + " " + QTX.afterText : QTX.afterText;
      var go = qk.querySelector(".seq-qgo"); go.hidden = false; qk.querySelector(".seq-qskip").hidden = true; go.focus({ preventScroll: true }); say(QTX.after + ". " + QTX.afterText);
    }
    function endQuake() {
      if (!qState) return; if (window.FFAudio) window.FFAudio.quake(false); qState = null; qk.hidden = true; think.hidden = true; rig.visible = true; root.classList.remove("seq-quaking"); if (surprise) surprise.material.opacity = 0;
      if (character) { character.fear = 0; character.pose = null; } charGroup.rotation.set(0, 0, 0);
      if (cfg.onQuakeDone) cfg.onQuakeDone(); heroKey.intensity = LIGHT.key;
      restart(false);
    }
    qk.querySelector(".seq-qgo").addEventListener("click", endQuake);
    qk.querySelector(".seq-qskip").addEventListener("click", function () { if (qState && qState.phase === "during") { qState.t = qState.kind === "nosignal" ? NSDUR : QDUR + 0.7; quakeAfter(); } });
    function quakeFrame(dt) {
      if (qState.kind === "nosignal") { noSignalFrame(dt); return; }
      qState.t += dt; var qt = qState.t;
      var a = reduce ? 0 : smooth(qt / 1.2) * (1 - smooth((qt - 3.6) / 1.4)), pr = reduce ? 1 : smooth(qt / 0.45) * (1 - smooth((qt - 4.6) / 1.0));
      if (qState.phase === "during" && qt >= QDUR + 0.7) quakeAfter();
      env.visible = true; envMats.forEach(function (m) { m.opacity = 1; });
      camera.position.copy(camWide.p); camera.lookAt(camWide.l);
      camera.position.x += (Math.sin(qt * 13.1) * 0.028 + Math.sin(qt * 7.7) * 0.02) * a; camera.position.y += Math.sin(qt * 17.3) * 0.015 * a; camera.rotateZ(Math.sin(qt * 5.3) * 0.005 * a);
      heroKey.intensity = LIGHT.key * (1 - 0.3 * a * Math.abs(Math.sin(qt * 21))); heroFill.intensity = LIGHT.fill; ambient.intensity = LIGHT.amb; charMat.emissiveIntensity = LIGHT.emi;
      scenery.update(qt, a);
      /* la postura de miedo (rodillas, tronco, cabeza, brazos y ojos «> <») la hace el modelo con character.fear, solo en la fase «Durante el movimiento»;
         el cuerpo entero solo tiembla un poco con el suelo. En «El movimiento terminó» vuelve a su postura y expresión normales. */
      charGroup.scale.set(1, 1, 1); charGroup.position.y = 0; charGroup.rotation.set(0, 0, Math.sin(qt * 19) * 0.008 * a);
      surprise.material.opacity = pr > 0.1 && qt < 4.2 ? 1 : 0; surprise.scale.setScalar(0.9 + (reduce ? 0 : 0.12 * Math.sin(qt * 9)) * (qt < 1.5 ? 1 : 0));
      if (character) {
        /* lenguaje corporal: sobresalto al empezar (hombros arriba, tronco atrás) antes de protegerse; al terminar, preocupada, mira a su alrededor */
        if (qt < 0.6) bodyOnce("startle", function (c) { c.gesture("startle"); });
        if (qState.phase === "after") bodyOnce("qafter", function (c) { c.gesture("glance"); });
        character.pose = qState.phase === "after" ? "worry" : null; character.lookAt = null; character.talking = false;
        character.fear = qState.phase === "during" ? pr : 0; character.update(qt, topicId, "quake", reduce, false, 1);   // "quake": sin el agarre del objeto de la alternativa, manos abiertas
      }
      footFrame(env.visible ? groundMat.opacity : 0); renderer.render(scene, camera);
    }

    /* ---------- recorrido guiado de la linterna ----------
       Dos variantes, según los datos de la zona (J.guide.kind):
       · «apagon» (Cali): 1 cuando se va la luz (se ubica el interruptor y la luz sube poco a poco) → 2 encender y apagar (manos) → 3 iluminar el camino
         (el haz barre el suelo y deja ver los escombros) → 4 práctica con una lista de 5 pasos que se marcan al hacerlos → 5 cuadro. Sin código Morse.
       · código Morse (Cauca): 1 presentación → 2 destello corto/largo → 3 señal SOS → 4 práctica → 5 cuadro. Los destellos se reproducen con el reloj
         real (corto 0,2 s, largo 0,6 s, 0,2 s entre símbolos, 0,6 s entre letras) y cada punto o raya se ilumina en pantalla a la vez.
       Los pasos avanzan solos si el usuario no interactúa. Con «reducir movimiento» la linterna no parpadea. */
    var mp = { ev: null, start: 0, idx: -1, total: 0, done: null }, hold = null, hotMode = "toggle", DOT = 200, DASH = 600, GAP = 200, LGAP = 600;
    function sosEvents() {
      var out = [], tt = 0, n = 0;
      ["...", "---", "..."].forEach(function (L, li) { L.split("").forEach(function (ch, k) { var d = ch === "." ? DOT : DASH; out.push({ s: tt, e: tt + d, sym: ch, sel: '[data-mi="' + n + '"]' }); tt += d; n++; if (k < 2) tt += GAP; }); if (li < 2) tt += LGAP; });
      return { ev: out, total: tt + 500 };
    }
    function lamp(on) { if (!reduce && live.light !== on) setLight(on); }   // destellos de la demostración, del SOS y de la práctica: un clic por encendido y por apagado
    function hl(sel, on) { var el = sel && prac.querySelector(sel); if (el) el.classList.toggle("on", on); }
    function syncGuideButtons() { [].forEach.call(prac.querySelectorAll(".mo-act"), function (b) { b.disabled = !!mp.busy; b.setAttribute("aria-busy", mp.busy ? "true" : "false"); }); }
    function stopPlay() { if (!mp.ev) return; if (P) P.demo = false; if (mp.idx >= 0) hl(mp.ev[mp.idx].sel, false); mp.ev = null; mp.idx = -1; mp.busy = false; lamp(false); syncGuideButtons(); }
    function playEvents(p, onDone) { stopPlay(); mp.ev = p.ev; mp.total = p.total; mp.start = performance.now(); mp.idx = -1; mp.done = onDone || null; mp.busy = true; syncGuideButtons(); }
    function playerTick(now) {
      if (!mp.ev) return; var el = now - mp.start, act = -1, i;
      for (i = 0; i < mp.ev.length; i++) if (el >= mp.ev[i].s && el < mp.ev[i].e) { act = i; break; }
      if (act !== mp.idx) { if (mp.idx >= 0) hl(mp.ev[mp.idx].sel, false); mp.idx = act; if (act >= 0) hl(mp.ev[act].sel, true); lamp(act >= 0); }
      if (el >= mp.total) { var d = mp.done; mp.ev = null; mp.idx = -1; mp.busy = false; syncGuideButtons(); if (d) d(); }
    }
    function playSos() { say("Señal SOS: tres destellos cortos, tres largos y tres cortos"); playEvents(sosEvents()); }
    function playDemo() { playEvents({ ev: [{ s: 300, e: 300 + DOT, sym: ".", sel: ".mo-chip.dot" }, { s: 1400, e: 1400 + DASH, sym: "-", sel: ".mo-chip.dash" }], total: 2700 }); }
    function userFlash(sym) { var d = sym === "dot" ? DOT : DASH; playEvents({ ev: [{ s: 0, e: d, sym: sym === "dot" ? "." : "-", sel: null }], total: d + 150 }, function () { addSym(sym); }); }
    /* práctica: cada destello se compara con SOS (... --- ...). Al desviarse aparece el error; la secuencia sigue visible hasta que el aviso desaparece (o hasta el siguiente destello) */
    var SOS_STR = "...---...";
    function addSym(sym) {
      if (G.done || G.err) { G.user = []; G.done = false; G.err = false; clearTimeout(G.errT); }
      G.user.push(sym);
      var str = G.user.map(function (x) { return x === "dot" ? "." : "-"; }).join("");
      if (str !== SOS_STR.slice(0, str.length)) {
        G.err = true; renderLog();   // la secuencia (con el destello equivocado en rojo) se ve mientras dura el aviso de error
        clearTimeout(G.errT); G.errT = setTimeout(function () { if (G && G.err) { G.err = false; G.user = []; if (card) renderLog(); } }, 7000);
        return;
      }
      if (str.length === SOS_STR.length) G.done = true;
      renderLog();
    }
    function renderLog() {
      var el = card.querySelector(".mo-log"); if (!el) return;
      el.innerHTML = G.user.length ? G.user.map(function (x, i) { return '<i class="mo-sym ' + x + (G.err && i === G.user.length - 1 ? " bad" : "") + '"></i>'; }).join("") : '<span class="mo-empty">Aún no has enviado destellos.</span>';
      var fb = card.querySelector(".mo-fb");
      fb.classList.toggle("err", !!G.err);
      fb.textContent = G.err ? "Código incorrecto: el SOS son tres destellos cortos, tres largos y tres cortos (... --- ...). Inténtalo de nuevo." : G.done ? "¡Correcto! Tu secuencia coincide con SOS: ... --- ... (esta práctica no mide los tiempos exactos)." : "";
    }
    function seqHTML() {
      var h = '<div class="mo-seq" role="img" aria-label="SOS: tres destellos cortos, tres largos y tres cortos">', n = 0;
      ["S", "O", "S"].forEach(function (L, li) { h += '<span class="mo-letter"><span class="mo-syms">'; for (var k = 0; k < 3; k++) { h += '<i class="mo-sym ' + (li === 1 ? "dash" : "dot") + '" data-mi="' + n + '"></i>'; n++; } h += "</span><b>" + L + "</b></span>"; });
      return h + "</div>";
    }
    /* --- variante «apagón» --- */
    var NEXT = '<button type="button" class="seq-finish" data-g="next">Continuar <span aria-hidden="true">→</span></button>', BACK = '<button type="button" class="seq-again" data-g="back"><span aria-hidden="true">←</span> Atrás</button>';
    function lightBtn() { return '<button type="button" class="seq-toggle g-act" data-g="light" role="switch" aria-checked="' + live.light + '"><span class="knob" aria-hidden="true"></span><span class="lbl">' + (live.light ? "Apagar la linterna" : "Encender la linterna") + "</span></button>"; }
    function apagonHTML() {
      var g = J.guide;
      if (G.n === 1) return "<h2>" + esc(g.s1.title) + "</h2><p>" + esc(g.s1.text) + '</p><p class="seq-hint">' + esc(g.s1.tip) + '</p><div class="seq-actions">' + NEXT + "</div>";
      if (G.n === 2) return "<h2>" + esc(g.s2.title) + "</h2><p>" + esc(g.s2.text) + '</p><p class="seq-hint">' + esc(g.s2.note) + '</p><div class="seq-actions">' + BACK + lightBtn() + NEXT + "</div>";
      if (G.n === 3) return "<h2>" + esc(g.s3.title) + "</h2><p>" + esc(g.s3.text) + '</p><p class="seq-hint">' + esc(g.s3.note) + '</p><div class="seq-actions">' + BACK +
        '<button type="button" class="seq-again g-act" data-g="scan">Iluminar el camino</button><button type="button" class="seq-finish" data-g="practice">Practicar <span aria-hidden="true">→</span></button></div>';
      return "<h2>" + esc(g.p.title) + "</h2><p>" + esc(g.p.text) + '</p><section class="seq-tut"><ol class="tut-steps">' + g.p.steps.map(function (s, i) { return '<li data-s="' + i + '">' + esc(s) + "</li>"; }).join("") + "</ol></section>" +
        '<div class="seq-actions g-pad">' + lightBtn() + '<button type="button" class="seq-again g-act" data-g="scan">Orienta la luz hacia el suelo</button><button type="button" class="seq-again g-act" data-g="signal">Hacer una señal visible</button></div>' +
        '<p class="g-fb" role="status" aria-live="polite"></p><div class="seq-actions">' + BACK + '<button type="button" class="seq-again" data-g="reset">Practicar de nuevo</button><button type="button" class="seq-finish" data-g="finish">Continuar <span aria-hidden="true">→</span></button></div>';
    }
    /* lista de la práctica: cada paso se marca al hacerlo (no hay un orden obligatorio ni respuestas incorrectas) */
    function renderChecklist() {
      var lis = card.querySelectorAll(".tut-steps li"); if (!lis.length) return; var cur = G.pr.indexOf(false);
      [].forEach.call(lis, function (li, i) { li.classList.toggle("done", !!G.pr[i]); li.classList.toggle("cur", i === cur); });
      var fb = card.querySelector(".g-fb"); if (fb) fb.textContent = cur < 0 ? "¡Muy bien! Ya sabes encender la linterna, orientar su luz, hacerte visible y apagarla para ahorrar batería." : "";
    }
    function practice(i) { if (!APAGON || G.n !== 4) return; G.autoAt = 0; G.pr[i] = true; if (live.light) G.pr[1] = true; renderChecklist(); }   // si practica, ya no se avanza solo
    /* el usuario enciende o apaga (botón del cuadro o interruptor sobre la linterna) */
    function userLight() {
      if (G && G.busy) return; var on = !live.light; setLight(on);
      if (APAGON && G.n === 4) { G.autoAt = 0; G.pr[0] = true; if (on) G.pr[1] = true; else if (G.pr[1]) G.pr[4] = true; renderChecklist(); }
    }
    /* iluminar el camino: el haz barre el suelo cercano (escombros) */
    function doScan() { mod.mode = "scan"; if (!live.light) setLight(true); practice(2); say("Luz orientada hacia el suelo: se ven los obstáculos"); }
    /* señal visible: la linterna apunta hacia arriba y se enciende y apaga tres veces, despacio (una señal sencilla, sin código); al final queda encendida */
    function doSignal() {
      if (G.busy) return; mod.mode = "signal"; G.autoAt = 0; say("Señal luminosa hacia un lugar visible");
      playEvents({ ev: [{ s: 250, e: 950, sel: null }, { s: 1450, e: 2150, sel: null }, { s: 2650, e: 3350, sel: null }], total: 3600 }, function () { lamp(true); practice(3); });
    }
    /* desplegable dentro de la guía Morse: empieza cerrado y se abre o cierra con clic (vuelve a cerrarse al cambiar de paso).
       Abiertos solo «Destello corto y destello largo», «La señal SOS» hasta «Secuencia: ... --- ...» y «Practica la señal». */
    function moMore(inner) {
      return '<details class="mo-more"><summary><span class="mm-open">Ver más</span><span class="mm-close">Ver menos</span><span class="mm-chev" aria-hidden="true"></span></summary>' + inner + "</details>";
    }
    function guideHTML() {
      if (APAGON) return apagonHTML();
      var g = J.guide, h = "";   // sin la línea «objeto · zona» encima del título (menos texto en el cuadro)
      if (G.n === 1) h += "<h2>" + esc(g.s1.title) + "</h2>" + moMore("<p>" + esc(g.s1.text) + '</p><p class="seq-hint"><b>¿Qué es el código Morse?</b> ' + esc(g.s1.morse) + "</p>") + '<div class="seq-actions"><button type="button" class="seq-finish" data-g="next">Continuar <span aria-hidden="true">→</span></button></div>';
      else if (G.n === 2) h += "<h2>" + esc(g.s2.title) + '</h2><div class="mo-chips"><span class="mo-chip dot"><i class="mo-sym dot"></i> Destello corto = punto (≈ 0,2 s)</span><span class="mo-chip dash"><i class="mo-sym dash"></i> Destello largo = raya (≈ 0,6 s)</span></div><p>' + esc(g.s2.text) + '</p><div class="seq-actions"><button type="button" class="seq-again" data-g="back"><span aria-hidden="true">←</span> Atrás</button><button type="button" class="seq-again mo-act" data-g="demo">Ver de nuevo</button><button type="button" class="seq-finish" data-g="next">Continuar <span aria-hidden="true">→</span></button></div>';
      else if (G.n === 3) h += "<h2>" + esc(g.s3.title) + "</h2><p>" + esc(g.s3.text) + "</p>" + seqHTML() + '<p class="mo-code"><b>Secuencia: <code>... --- ...</code></b></p>' + moMore("<p>" + esc(g.s3.msg) + '</p><p class="seq-hint">' + esc(g.s3.note) + "</p><p>" + esc(g.s3.zone) + "</p>") + '<div class="seq-actions"><button type="button" class="seq-again" data-g="back"><span aria-hidden="true">←</span> Atrás</button><button type="button" class="seq-again mo-act" data-g="sos">Ver la señal SOS</button><button type="button" class="seq-finish" data-g="practice">Practicar <span aria-hidden="true">→</span></button></div>';
      else h += "<h2>" + esc(g.p.title) + "</h2><p>" + esc(g.p.text) + "</p>" + seqHTML() + '<div class="mo-pad"><button type="button" class="mo-btn mo-act" data-g="dot"><i class="mo-sym dot"></i> Destello corto</button><button type="button" class="mo-btn mo-act" data-g="dash"><i class="mo-sym dash"></i> Destello largo</button><button type="button" class="mo-btn mo-act" data-g="sos">Reproducir SOS</button><button type="button" class="mo-btn mo-act" data-g="repeat">Repetir</button></div><p class="mo-lbl">Tu práctica:</p><div class="mo-log" aria-live="polite"></div><p class="mo-fb" role="status"></p><div class="seq-actions"><button type="button" class="seq-again" data-g="back"><span aria-hidden="true">←</span> Atrás</button><button type="button" class="seq-again" data-g="clear">Borrar práctica</button><button type="button" class="seq-finish" data-g="finish">Continuar <span aria-hidden="true">→</span></button></div>';
      return h;
    }
    function setHotMode(m) {
      hotMode = m; var lbl = hot.querySelector(".lbl");
      if (m === "hold") { hot.setAttribute("role", "button"); hot.removeAttribute("aria-checked"); hot.setAttribute("aria-label", "Interruptor de la linterna: mantén presionado para encender y suelta para apagar"); if (lbl) lbl.textContent = "Mantén presionado"; }
      else { hot.setAttribute("role", "switch"); if (lbl) lbl.textContent = "Interruptor"; syncHot(); }
    }
    function guideShow(n) {
      G.n = n;
      if (APAGON) { mod.mode = n === 3 ? "scan" : null; if (n === 4) setLight(false, true); }   // paso 3: el haz barre el suelo; la práctica empieza con la luz apagada
      card.classList.add("seq-guided"); card.classList.remove("is-folded"); card.hidden = false; card.innerHTML = guideHTML(); card.removeAttribute("aria-labelledby"); card.setAttribute("aria-label", (APAGON ? "Guía de la linterna, paso " : "Guía del código Morse, paso ") + n);
      setStep(n === 1 ? 1 : n === 2 ? 2 : 3); skipBtn.hidden = false; setHotMode(n === 4 && !APAGON ? "hold" : "toggle"); hot.hidden = APAGON ? n < 2 : n < 4;   // apagón: el interruptor se puede pulsar desde el primer plano de las manos
      if (n === 4) { if (APAGON) renderChecklist(); else renderLog(); } syncGuideButtons();
      /* el recorrido avanza solo, pero con tiempo para leer: ≈0,42 s por palabra del cuadro + 5 s (mínimo 14 s; la práctica, 30 s). Mientras el puntero
         o el foco están en el cuadro, la cuenta se detiene (ver guideFrame); si el usuario practica, ya no avanza solo */
      var words = (card.innerText.match(/\S+/g) || []).length;
      G.autoAt = performance.now() + Math.max(n === 4 ? 30000 : 14000, 5000 + words * 420);
      if (G.focus) { var f = card.querySelector("[data-g=next],[data-g=dot],[data-g=light]"); if (f) f.focus({ preventScroll: true }); } G.focus = false;
    }
    function guideBegin(skipHero) {
      stopPlay(); G.n = 1; G.user = []; G.err = false; G.done = false; clearTimeout(G.errT); G.busy = false; G.autoSos = false; G.demoDone = false; G.lit = false; G.t0 = performance.now(); mod.slow = true; mod.sos = false;
      G.pr = [false, false, false, false, false]; mod.mode = null;
      G.gate = skipHero ? tl.c1 - 0.02 : tl.H - 0.001; setHotMode("toggle"); guideShow(1);
      if (reduce) { G.lit = true; setLight(true, true); }
    }
    function guideJump(n) {
      restart(true); G.focus = false; mod.slow = false; setLight(false, true);
      if (n === 2) { G.gate = tl.c1 - 0.02; if (reduce) t = tl.c1 - 0.001; mod.sos = false; guideShow(2); }
      else { t = tl.c1 + TIMES.toWide + 1.9; G.gate = t; mod.sos = !APAGON; G.autoSos = !APAGON && n === 3; if (APAGON && n === 3) setLight(true, true); guideShow(n); }
    }
    function guideNext() {
      stopPlay(); G.focus = true; mod.slow = false;
      if (G.n === 1) { setLight(false, true); G.gate = tl.c1 - 0.02; if (reduce) t = tl.c1 - 0.001; guideShow(2); }
      else if (G.n === 2) { G.gate = tl.c1 + TIMES.toWide + 1.9; mod.sos = !APAGON; if (reduce) t = G.gate; G.autoSos = !APAGON; if (APAGON && !live.light) setLight(true); guideShow(3); }
    }
    function guideFinish() {
      stopPlay(); if (hold) hold = null; G.n = 5; G.gate = Infinity; mod.sos = !APAGON; mod.mode = null; card.hidden = true; card.classList.remove("seq-guided"); hot.hidden = true; setHotMode("toggle"); setStep(4); if (reduce) t = tl.card + 0.01;
    }
    function guideFrame(now) {
      if (G.n === 1 && !G.lit && now - G.t0 > 700) { G.lit = true; setLight(true); }   // se hunde el botón y la luz sube poco a poco
      if (G.n === 2 && !G.demoDone && info.stage === "close" && info.ta >= 0.4) { G.demoDone = true; if (APAGON) { if (!live.light) setLight(true); } else playDemo(); }   // apagón: el dedo presiona el interruptor y la linterna se enciende
      if (G.n === 3 && G.autoSos && t >= tl.c1 + TIMES.toWide - 0.2) { G.autoSos = false; playSos(); }
      var reading = !card.hidden && (card.matches(":hover") || card.contains(document.activeElement));   // leyendo: puntero sobre el cuadro o foco dentro
      if (G.autoAt && reading && G.prevNow) G.autoAt += now - G.prevNow;   // mientras lee, la cuenta se detiene
      G.prevNow = now;
      if (G.autoAt && now >= G.autoAt && !G.busy && !hold) { G.autoAt = 0; if (G.n === 4) guideFinish(); else if (G.n === 3) { stopPlay(); guideShow(4); } else guideNext(); }
      playerTick(now);
    }
    card.addEventListener("click", function (e) {
      var b = e.target.closest("[data-g]"); if (!b || !G) return; var a = b.getAttribute("data-g");
      if (a === "next") guideNext();
      else if (a === "back") { stopPlay(); G.focus = false; if (G.n === 2) restart(false); else guideJump(G.n - 1); }
      else if (a === "demo") { if (!G.busy) playDemo(); }
      else if (a === "sos" || a === "repeat") { if (!G.busy && !hold) playSos(); }
      else if (a === "practice") { stopPlay(); G.focus = true; guideShow(4); }
      else if (a === "dot" || a === "dash") { G.autoAt = 0; if (!G.busy && !hold) userFlash(a); }   // si practica, ya no se avanza solo
      else if (a === "clear") { G.user = []; G.err = false; G.done = false; clearTimeout(G.errT); renderLog(); }
      else if (a === "finish") guideFinish();
      else if (a === "light") { G.demoDone = true; userLight(); }
      else if (a === "scan") doScan();
      else if (a === "signal") doSignal();
      else if (a === "reset") { stopPlay(); G.pr = [false, false, false, false, false]; mod.mode = null; setLight(false, true); G.autoAt = 0; renderChecklist(); }
    });
    /* interruptor sobre la linterna: alternar (cuadro final) o mantener presionado para encender y soltar para apagar (práctica) */
    hot.addEventListener("click", function () { if (hotMode !== "toggle") return; setLight(!live.light); });
    /* práctica de la linterna: mantener presionado el interruptor enciende la luz; al soltar se apaga y se anota un punto (< 0,4 s) o una raya */
    function holdStart(e) { if (hotMode !== "hold" || !P.on || mp.busy || hold) return; hold = { at: performance.now() }; hot.classList.add("held"); setLight(true); }
    function holdEnd() { if (!hold) return; var d = performance.now() - hold.at; hold = null; hot.classList.remove("held"); setLight(false); pSym(d < 400 ? "dot" : "dash"); }
    hot.addEventListener("pointerdown", function (e) { if (hotMode !== "hold") return; e.preventDefault(); try { hot.setPointerCapture(e.pointerId); } catch (x) {} holdStart(e); });
    hot.addEventListener("pointerup", holdEnd); hot.addEventListener("pointercancel", holdEnd); hot.addEventListener("blur", holdEnd);
    hot.addEventListener("keydown", function (e) { if (hotMode === "hold" && (e.key === " " || e.key === "Enter")) { e.preventDefault(); if (!e.repeat) holdStart(e); } });
    hot.addEventListener("keyup", function (e) { if (hotMode === "hold" && (e.key === " " || e.key === "Enter")) { e.preventDefault(); holdEnd(); } });

    /* ---------- caminata: «Buscar un lugar con mejor señal» ----------
       Tiempos en segundos desde que la cámara llega al plano completo (tl.w1). Mateo parte por el camino de tierra, cerca de los árboles (from), y camina despacio hasta un claro
       abierto (to): una trayectoria corta, sin cruzar árboles, cerca ni casas (ver js/scenery.js). En pantallas verticales parte un poco más atrás y menos a un lado, para que se vea entero. Las piernas avanzan según la distancia recorrida
       (stride = distancia de un ciclo de dos pasos), así los pies no se deslizan. Al llegar gira hacia la cámara, levanta el celular y consulta la señal.
       Con «reducir movimiento» no camina: se muestra directamente el final (en el claro, con el celular en alto y el resultado). */
    /* «El mensaje en espera» (Cauca): Mateo empieza a la izquierda, bajo dos árboles, y camina hasta el claro (los mismos puntos que RURAL.walk en js/scenery.js) */
    var WALK = { from: [-1.6, -1.0], fromPortrait: [-1.0, -1.2], to: [2.2, 0.4], bubble: [-0.6, 2.4], go: [1.4, 5.9], turn: [5.9, 6.6], raise: [6.3, 7.1], search: [7.1, 8.9], card: 9.9, stride: 1.3 };
    var ws = { x: 0, z: 0, yaw: 0, phase: 0, k: 0, raise: 0, sig: "none", bubble: false };
    function sm(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
    /* base (opcional): momento desde el que se cuentan los tiempos de WALK; sin base, desde tl.w1. La historia «El mensaje en espera» la usa
       para que Mateo espere entre los árboles y empiece a caminar cuando el usuario lo decide (ver storyWalk). */
    function walkState(tt, base) {
      var W = WALK, f = portrait ? W.fromPortrait : W.from, dx = W.to[0] - f[0], dz = W.to[1] - f[1], dist = Math.hypot(dx, dz), head = Math.atan2(dx, dz), w = tt - (base == null ? tl.w1 : base);
      if (reduce && base == null) w = W.card + 1;
      var e = sm((w - W.go[0]) / (W.go[1] - W.go[0]));
      ws.x = f[0] + dx * e; ws.z = f[1] + dz * e;
      ws.phase = e * dist / (W.stride * CK) * Math.PI * 2;   // pasos más cortos si el personaje es más pequeño: los pies no se deslizan
      ws.k = clamp01(Math.min((w - W.go[0]) / 0.5, (W.go[1] - w) / 0.5));
      ws.yaw = head * sm((w - W.go[0] + 0.2) / 0.6) * (1 - sm((w - W.turn[0]) / (W.turn[1] - W.turn[0])));
      ws.raise = sm((w - W.raise[0]) / (W.raise[1] - W.raise[0]));
      ws.sig = w < W.search[0] ? "none" : w < W.search[1] ? "search" : "result";
      ws.bubble = reduce ? !shown.card : (w >= W.bubble[0] && w < W.bubble[1]);
      return ws;
    }
    /* «Volver a intentar»: repite la caminata desde el principio (el resultado cambia en cada intento) */
    function walkAgain() {
      walkTry++; bye.hidden = true; hideCard(); shown.card = false; hudKey = ""; bodyReset(); skipBtn.hidden = false; pendingFocus = { act: "walk-again" };
      if (reduce) { holdT = true; t = tl.card + 0.01; } else { holdT = false; t = tl.w1 - 0.8; setStep(3); }
      say("Volver a intentar: Mateo busca de nuevo un lugar con mejor señal");
    }
    var walkHud = $(".seq-walk"), bubbleEl = $(".sw-bubble"), sigEl = $(".sw-signal"), hudKey = "";
    /* botón de la música (radio en la zona rural): aparece cuando la emisora ya se oye clara y apaga o vuelve a encender la canción */
    var musicBtn = document.createElement("button"); musicBtn.type = "button"; musicBtn.className = "seq-music"; musicBtn.hidden = true; root.appendChild(musicBtn);
    var musicKey = "";
    function musicFrame() {
      var M = mod.antennaScene, show = !!(M && M.musicBtn) && bye.hidden && !P.on;
      if (musicBtn.hidden !== !show) musicBtn.hidden = !show;
      if (!show) return;
      var key = M.playing ? "on" : "off"; if (key === musicKey) return; musicKey = key;
      musicBtn.innerHTML = '<span class="sm-ico" aria-hidden="true">' + (M.playing ? "🔊" : "🔇") + "</span>" + esc(tr(M.playing ? "Apagar la música" : "Encender la música"));
      musicBtn.setAttribute("aria-pressed", M.playing ? "true" : "false");
    }
    musicBtn.addEventListener("click", function () { var M = mod.antennaScene; if (!M) return; M.toggleMusic(); musicKey = ""; musicFrame(); say(M.playing ? "Música encendida" : "Música apagada"); });
    /* escena de la antena (radio, zona rural; ver js/seq-modules.js): globo de Mateo sobre su cabeza e indicador de señal arriba */
    var antKey = "";
    function antennaHud(AS) {
      var c = AS.chip, key = c ? c.id + c.bars : "";
      if (key !== antKey) {
        antKey = key; sigEl.hidden = !c;
        if (c) {
          sigEl.className = "sw-signal st-sig " + c.cls;
          [].forEach.call(sigEl.querySelectorAll(".sw-bars i"), function (el, i) { el.classList.toggle("on", i < c.bars); });
          sigEl.querySelector("b").textContent = tr(c.b); sigEl.querySelector("small").textContent = tr(c.s); say(c.b + ": " + c.s);
        }
      }
      var showB = !!AS.bubble;
      if (walkHud.hidden !== !showB) walkHud.hidden = !showB;
      if (!showB) return;
      if (walkHud.getAttribute("data-t") !== AS.bubble) { walkHud.setAttribute("data-t", AS.bubble); bubbleEl.textContent = tr(AS.bubble); say(AS.bubble); }
      var w = root.clientWidth, h = root.clientHeight, cgx = charGroup.position.x, cgz = charGroup.position.z, top0 = sigEl.hidden ? 64 : Math.max(64, sigEl.offsetTop + sigEl.offsetHeight + 10);
      u3.set(cgx + 1.45 * CK, 3.75 * CK, cgz).project(camera); var bw = walkHud.offsetWidth, bh = walkHud.offsetHeight, bx = (u3.x + 1) / 2 * w, by = (1 - u3.y) / 2 * h;
      var side = bx + bw <= w - 10; walkHud.classList.toggle("above", !side);
      if (!side) { u3.set(cgx, 4.55 * CK, cgz).project(camera); bx = (u3.x + 1) / 2 * w - bw / 2; by = (1 - u3.y) / 2 * h - bh; } else by -= bh / 2;
      walkHud.style.left = Math.max(10, Math.min(w - bw - 10, bx)) + "px"; walkHud.style.top = Math.max(top0, Math.min(h - bh - 10, by)) + "px";
    }
    function walkHudFrame(wt) {
      var o = topic(), on = !!wt && info.stage === "wide" && bye.hidden, showB = on && wt.bubble && !shown.card, r = walkResult(o);
      live.walk.sig = wt ? wt.sig : "none"; live.walk.bars = r.bars;
      if (walkHud.hidden !== !showB) { walkHud.hidden = !showB; if (showB) { bubbleEl.textContent = window.FFi18n ? FFi18n.t(o.bubble) : o.bubble; say(o.bubble); } }
      if (showB) {   // el globo queda junto a la cabeza de Mateo (a su derecha, en pantalla) y lo sigue mientras camina; si ahí no cabe (pantallas angostas), va encima de la cabeza
        u3.set(wt.x + 1.45 * CK, 3.75 * CK, wt.z).project(camera); var w = root.clientWidth, h = root.clientHeight, bw = walkHud.offsetWidth, bh = walkHud.offsetHeight, sx = (u3.x + 1) / 2 * w, sy = (1 - u3.y) / 2 * h;
        var side = sx + bw <= w - 10; walkHud.classList.toggle("above", !side);
        if (!side) { u3.set(wt.x, 4.55 * CK, wt.z).project(camera); sx = (u3.x + 1) / 2 * w - bw / 2; sy = (1 - u3.y) / 2 * h - bh; }
        else sy -= bh / 2;
        walkHud.style.left = Math.max(10, Math.min(w - bw - 10, sx)) + "px"; walkHud.style.top = Math.max(64, Math.min(h - bh - 10, sy)) + "px";
      }
      var showS = on && wt.sig !== "none", key = showS ? wt.sig + r.bars + walkTry : "";
      sigEl.hidden = !showS;
      if (key !== hudKey) {
        hudKey = key; if (!showS) return;
        sigEl.className = "sw-signal " + wt.sig + " b" + r.bars;
        [].forEach.call(sigEl.querySelectorAll(".sw-bars i"), function (el, i) { el.classList.toggle("on", wt.sig === "result" && i < r.bars); });
        var tx = wt.sig === "search" ? "Buscando señal…" : r.title; sigEl.querySelector("b").textContent = window.FFi18n ? FFi18n.t(tx) : tx;
        say(wt.sig === "search" ? "Mateo consulta su celular: buscando señal (simulación)" : "Resultado: " + r.title + ". " + r.text);
        var A = window.FFAudio; if (A && wt.sig === "result") A.blip();
      }
    }

    /* ---------- historia (paso 3) y «Lo aprendido» (paso 4) ----------
       Las cuatro alternativas del celular en Cali (los objetos con «story» en js/data.js). En el plano completo, tres escenas con Valeria:
       1) inicio: una nube con lo que piensa, el indicador de arriba (p. ej. «Líneas ocupadas») y ojos de preocupación;
       2) desarrollo: un panel con una decisión del usuario (el tiempo espera, como en la práctica). Cada alternativa tiene la suya (story.kind):
          · "sms": arma el mensaje tocando solo lo esencial y lo envía (el mensaje sale volando del celular);
          · "call": con el celular en la oreja, Valeria dice lo esencial (globos) mientras corre el reloj de la llamada; luego cuelga;
          · "voice": marca el 119, se lleva el celular a la oreja y deja el mensaje manteniendo presionado el micrófono; luego cuelga;
          · "net": con el celular en alto, elige una red más básica (3G), espera a que se conecte y al final vuelve a la automática;
       3) cierre: indicador con el resultado (siempre «simulado» y sin garantía), un globo de Valeria con ojos felices y, al rato, la tarjeta corta.
       Orden del inicio: primero Valeria cuenta el problema (globo, el tiempo justo para leerlo) y aparece el indicador; solo después llegan el panel
       y los movimientos del celular (a la oreja, más alto). Así la interacción nunca se adelanta al problema.
       Tiempos en segundos desde que la cámara llega al plano completo (tl.w1). Con «reducir movimiento» no hay animaciones: se pasa directo al panel,
       que muestra arriba lo que dice Valeria. */
    var STORY = { think: 0.3, chip: 1.4, after: 3.6, piece: 1.4, slow: 8, search: 2.4 };
    /* cuándo empieza el desarrollo: cuando ya se pudo leer el comentario de Valeria (≈ 0,32 s por palabra, entre 3,5 y 6,5 s) */
    function composeAt() { var c = topic().story.comment || "", n = c.split(/\s+/).length; return STORY.think + Math.min(6.5, Math.max(3.5, 1.8 + 0.32 * n)); }
    var ST = { phase: "off", sub: "", picks: [], wrong: "", raise: 0, mood: null, ear: 0, key: "", at: 0, subAt: 0, doneAt: 0, slow: false, talk: 0, said: 0, holding: false, line: "", lineAt: 0, dur: 0, net: "", sec: -1, walkBase: 0 };
    /* «El mensaje en espera» (story.kind "wait", Mateo en el Cauca): el SMS se arma como en Cali, pero al enviarlo queda en espera (ST.sub "pending")
       porque no hay señal. El usuario elige qué hacer; con «Caminar a un claro» empieza la fase "walk": el tiempo corre, Mateo camina con la misma
       animación de «Buscar un lugar con mejor señal» (walkState con base = ST.walkBase) y, cuando el celular encuentra señal, el mensaje sale solo. */
    function storyWalk() {
      var p = ST.phase, base = p === "walk" || p === "sent" ? ST.walkBase : p === "done" ? t - 100 : t;   // antes de caminar: quieto entre los árboles (w = 0); al terminar: en el claro
      return walkState(t, base);
    }
    var SIG_NOTE = "Simulación educativa";
    function hasStory() { return !!(topic().story && !FLAT); }
    function storyKind() { return topic().story.kind || "sms"; }
    function storyParts() { return topic().story.parts || []; }
    function storyNeed() { return storyParts().filter(function (p) { return p[2]; }); }
    function storyPieces() { return storyNeed().filter(function (p) { return ST.picks.indexOf(p[0]) >= 0; }).map(function (p) { return p[2]; }); }
    function storySaid() { var S = topic().story; return S.say ? Math.min(S.say.length, Math.floor(ST.talk / STORY.piece + 1e-6)) : 0; }   // 119: frases ya dichas
    function storyComplete() {
      var k = storyKind();
      if (k === "voice") return storySaid() >= topic().story.say.length;
      if (k === "net") return ST.sub === "on";
      return storyNeed().every(function (p) { return ST.picks.indexOf(p[0]) >= 0; });
    }
    /* lo que queda escrito en el panel y en la tarjeta: el mensaje, lo que dijo en la llamada o dónde está el ajuste */
    function storyLines() { var S = topic().story, k = storyKind(); return k === "voice" ? S.say.slice(0, storySaid()) : k === "net" ? S.boxText : storyPieces(); }
    function clock(sec) { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 60) + ":" + (sec % 60 < 10 ? "0" : "") + (sec % 60); }
    function storyElapsed() { return (performance.now() - ST.at) / 1000; }
    function storyReset() {
      ST.phase = "off"; ST.sub = ""; ST.picks = []; ST.wrong = ""; ST.raise = 0; ST.mood = null; ST.ear = 0; ST.key = ""; ST.doneAt = 0; ST.slow = false; ST.talk = 0; ST.said = 0; ST.holding = false; ST.line = ""; ST.dur = 0; ST.net = ""; ST.sec = -1; ST.walkBase = 0;
      storyEl.hidden = true; storyEl.innerHTML = ""; fly.hidden = true; think.hidden = true; think.classList.remove("st-think");
      walkHud.hidden = true; walkHud.removeAttribute("data-t"); sigEl.hidden = true; sigEl.querySelector("small").textContent = SIG_NOTE; root.classList.remove("seq-storying");
    }
    /* «Saltar» o paso 4: la historia queda terminada (mensaje completo, llamada hecha, red de vuelta en automático) */
    function storyFinish() {
      storyReset(); var S = topic().story, k = storyKind();
      ST.picks = storyNeed().map(function (p) { return p[0]; }); if (S.say) ST.talk = S.say.length * STORY.piece;
      ST.phase = "done"; ST.mood = "happy";
      if (k === "sms" || k === "wait") { live.sms.text = storyPieces().join(" "); live.sms.sent = true; }
      if (k === "voice") { live.voice = window.FFVoice.fresh(); live.voice.step = 4; live.voice.n = 3; }
    }
    /* empieza el desarrollo: el panel aparece y cada tipo prepara su estado (y la pantalla del celular 3D) */
    function storyCompose() {
      var S = topic().story, k = storyKind();
      ST.phase = "compose"; ST.at = ST.subAt = performance.now(); ST.sub = k === "voice" ? "dial" : k === "net" ? "pick" : "";
      if (k === "sms" || k === "wait") live.sms.text = storyPieces().join(" ");
      if (k === "voice") { live.voice = window.FFVoice.fresh(); live.voice.step = 2; live.voice.n = 3; }   // la pantalla muestra «119» listo para llamar
      storyEl.hidden = false; root.classList.add("seq-storying"); storyPanel(); say(k === "voice" ? S.dialTask : S.task);
    }
    function sBtn(cls, s, label, dis) { return '<button type="button" class="' + cls + '" data-s="' + s + '"' + (dis ? " disabled" : "") + ">" + label + "</button>"; }
    function msgHTML(lines, empty) {
      return '<p class="st-msg' + (lines.length ? "" : " empty") + '">' + (lines.length ? lines.map(function (p) { return "<span>" + esc(p) + "</span>"; }).join(" ") : "<span>" + esc(empty) + "</span>") + "</p>";
    }
    function chipsHTML(label, toggle) {
      return '<div class="st-chips" role="group" aria-label="' + esc(label) + '">' + storyParts().map(function (p) {
        var on = ST.picks.indexOf(p[0]) >= 0, bad = ST.wrong === p[0];
        return '<button type="button" class="st-chip' + (on ? " on" : "") + (bad ? " bad" : "") + '" data-s="pick" data-v="' + p[0] + '" aria-pressed="' + on + '"' + (on && !toggle ? " disabled" : "") + ">" + esc(p[1]) + "</button>";
      }).join("") + "</div>";
    }
    function timeHTML(late) { return '<b class="st-time' + (late ? " late" : "") + '">' + clock(storyElapsed()) + "</b>"; }
    /* panel del desarrollo (se vuelve a dibujar cuando cambia algo; el reloj y el micrófono se actualizan aparte, en storyFrame) */
    function storyPanel(focusSel) {
      var S = topic().story, k = storyKind(), done = storyComplete(), task = S.task, cls = "", body = "", acts = "", extra = "";
      if (k === "wait" && ST.sub === "pending") {   // mensaje en espera: qué hace Mateo ahora
        task = ST.wrong ? S.wrongs[ST.wrong] : S.waitTask; cls = ST.wrong ? " err" : "";
        body = '<div class="st-phone"><span class="st-to">' + esc(tr("Para: Familia")) + ' · <b class="st-pend">⏳ ' + esc(S.pendingTag) + "</b></span>" + msgHTML(storyPieces(), "") + "</div>" +
          '<div class="st-opts" role="group" aria-label="' + esc(S.waitTask) + '">' + S.choices.map(function (o) {
            return '<button type="button" class="st-opt' + (ST.wrong === o[0] ? " bad" : "") + '" data-s="go" data-v="' + o[0] + '"><b>' + esc(o[1]) + "</b><small>" + esc(o[2]) + "</small></button>";
          }).join("") + "</div>";
      } else if (k === "sms" || k === "wait") {
        task = ST.wrong ? S.wrong : done ? S.ready : S.task; cls = ST.wrong ? " err" : done ? " ok" : "";
        body = '<div class="st-phone"><span class="st-to">' + esc(tr("Para: Familia")) + "</span>" + msgHTML(storyPieces(), tr("Toca las ideas de abajo…")) + "</div>" + chipsHTML(tr("Ideas para el mensaje"), true);
        acts = (ST.picks.length ? sBtn("seq-again", "clear", esc(tr("Borrar"))) : "") + sBtn("seq-finish", "send", esc(tr("Enviar (simulado)")) + ' <span aria-hidden="true">➤</span>', !done);
      } else if (k === "call") {
        task = ST.wrong ? S.wrong : ST.slow ? S.slow : done ? S.ready : S.task; cls = ST.wrong || ST.slow ? " err" : done ? " ok" : "";
        body = '<div class="st-phone st-call"><span class="st-to">' + esc(S.with) + " · " + timeHTML(ST.slow) + "</span>" + msgHTML(storyPieces(), S.empty) + "</div>" + chipsHTML(S.chipsLabel, false);
        acts = sBtn("seq-finish st-hang", "send", esc(S.action), !done);
      } else if (k === "voice") {
        if (ST.sub === "dial") {
          task = S.dialTask;
          body = '<div class="st-phone st-dial"><span class="st-to">' + esc(S.app) + '</span><p class="st-num" aria-label="119">1 1 9</p></div>';
          acts = sBtn("seq-finish st-callbtn", "call", esc(S.callBtn));
        } else {
          task = done ? S.ready : S.task; cls = done ? " ok" : "";
          body = '<div class="st-phone st-call"><span class="st-to">' + esc(S.with) + " · " + timeHTML(false) + "</span>" + msgHTML(storyLines(), S.empty) + "</div>" +
            '<button type="button" class="st-mic' + (ST.holding ? " on" : "") + '" data-s="mic"' + (done ? " disabled" : "") + '><span class="st-mic-i" aria-hidden="true"></span><span class="st-mic-l">' + esc(done ? S.micDone : S.mic) + '</span><i class="st-mic-p" style="width:' + Math.round(100 * ST.talk / (S.say.length * STORY.piece)) + '%"></i></button>';
          acts = sBtn("seq-finish st-hang", "send", esc(S.action), !done);
        }
      } else if (k === "net") {
        if (ST.sub === "on") { task = S.connected; cls = " ok"; extra = '<p class="st-note">' + esc(S.backTask) + "</p>"; acts = sBtn("seq-finish", "send", esc(S.action)); }
        else {
          task = ST.sub === "search" ? S.searching : ST.wrong ? S.wrongs[ST.wrong] : S.task; cls = ST.wrong && ST.sub !== "search" ? " err" : "";
          body = '<div class="st-phone"><span class="st-to">' + esc(S.path) + '</span><div class="st-opts" role="radiogroup" aria-label="' + esc(S.path) + '">' + S.options.map(function (o) {
            var sel = (ST.net || "5g") === o[0];
            return '<button type="button" class="st-opt' + (sel ? " on" : "") + (ST.wrong === o[0] ? " bad" : "") + '" role="radio" aria-checked="' + sel + '" data-s="opt" data-v="' + o[0] + '"' + (ST.sub === "search" ? " disabled" : "") + "><b>" + esc(o[1]) + "</b><small>" + esc(o[2]) + "</small></button>";
          }).join("") + "</div></div>";
        }
      }
      storyEl.innerHTML = '<p class="pr-kicker">' + esc(tr("Historia")) + " · " + esc(tr(topic().name)) + "</p>" +
        (reduce && S.comment ? '<p class="st-said">' + esc(S.comment) + "</p>" : "") +   // sin animaciones no hay globo: lo que cuenta Valeria va arriba del panel
        '<p class="pr-task' + cls + '">' + esc(task) + "</p>" + extra + body + (acts ? '<div class="pr-acts">' + acts + "</div>" : "");
      if (focusSel) { var f = storyEl.querySelector(focusSel); if (f) f.focus({ preventScroll: true }); }
    }
    function storyFocus(sel) { return storyEl.contains(document.activeElement) ? sel : null; }   // solo se mueve el foco si el usuario ya estaba en el panel
    /* cierre: según el tipo, el mensaje sale volando, se cuelga la llamada o la red vuelve a automático */
    function storyEnd() {
      var S = topic().story, k = storyKind(), A = window.FFAudio, now = performance.now();
      ST.dur = storyElapsed(); ST.phase = "sent"; ST.wrong = ""; ST.holding = false; ST.line = ""; live.kick = now;
      storyEl.hidden = true; root.classList.remove("seq-storying");
      tl.card = t + (reduce ? 0 : STORY.after); pendingFocus = { act: "next" };   // el foco pasa a la tarjeta (el botón del panel desaparece)
      if (k === "sms" || k === "wait") {
        live.sms.text = storyPieces().join(" "); live.sms.sent = true; if (A) A.send();
        if (!reduce) {   // el mensaje sale del celular (de Valeria, o de Mateo al encontrar señal) y sube
          rig.getWorldPosition(u3); u3.project(camera);
          fly.style.left = ((u3.x + 1) / 2 * root.clientWidth) + "px"; fly.style.top = ((1 - u3.y) / 2 * root.clientHeight) + "px";
          fly.innerHTML = ICON_SMS; fly.hidden = false; fly.classList.remove("go"); void fly.offsetWidth; fly.classList.add("go");
          setTimeout(function () { fly.hidden = true; }, 1900);
        }
      } else if (k === "net") setNet(false);
      else { if (A) A.click(false); if (k === "voice") { live.voice.rec = window.FFVoice.elapsed(live.voice, now); live.voice.step = 4; } }
      say(S.sent + ". " + S.sentNote);
    }
    storyEl.addEventListener("click", function (e) {
      var b = e.target.closest("[data-s]"); if (!b || ST.phase !== "compose") return;
      var a = b.getAttribute("data-s"), v = b.getAttribute("data-v"), A = window.FFAudio, S = topic().story, k = storyKind(), now = performance.now();
      if (k === "wait" && a === "send" && ST.sub !== "pending" && storyComplete()) {   // sin señal: el mensaje no sale, queda en espera
        ST.sub = "pending"; ST.subAt = now; ST.wrong = ""; live.sms.text = storyPieces().join(" "); live.kick = now; if (A) A.click(true);
        bodyG("tap"); bodyG("shake"); storyPanel('[data-s="go"]'); say(S.pending + ". " + S.pendingNote + ". " + S.waitTask); return;
      }
      if (k === "wait" && a === "go" && ST.sub === "pending") {
        if (v === "claro") {   // empieza a caminar: el panel se cierra y el tiempo vuelve a correr
          ST.wrong = ""; ST.phase = "walk"; ST.walkBase = reduce ? t - 100 : t - WALK.go[0]; storyEl.hidden = true; root.classList.remove("seq-storying");
          bodyG("nod"); say(S.walkBubble);
        } else { ST.wrong = v; if (A) A.del(); storyPanel('[data-s="go"][data-v="' + v + '"]'); say(S.wrongs[v]); bodyG(v === "reenviar" ? "tilt" : "shake"); }
        return;
      }
      if (a === "pick") {
        var part = storyParts().filter(function (p) { return p[0] === v; })[0]; if (!part) return;
        if (!part[2]) { ST.wrong = v; if (A) A.del(); say(S.wrong); bodyG("shake"); }   // «Contar todo…»: no es lo esencial (niega con la cabeza)
        else {
          ST.wrong = ""; var i = ST.picks.indexOf(v);
          if (k === "sms" || k === "wait") { if (i >= 0) ST.picks.splice(i, 1); else { ST.picks.push(v); bodyG("tap"); bodyG("nod"); } live.sms.text = storyPieces().join(" "); if (A) A.key("a"); }   // escribe con el pulgar y asiente
          else if (i < 0) { ST.picks.push(v); ST.line = part[2]; ST.lineAt = now; bodySay(part[2]); }   // llamada: Valeria lo dice (globo y gesto); lo dicho no se borra
          live.kick = now;
          if (storyComplete() && !ST.doneAt) ST.doneAt = now;
          say(storyComplete() ? S.ready : k === "sms" || k === "wait" ? storyPieces().join(" ") || S.task : part[2]);
        }
        storyPanel(storyComplete() ? '[data-s="send"]' : k === "sms" || k === "wait" ?'[data-s="pick"][data-v="' + v + '"]' : '[data-s="pick"]:not([disabled])');
      } else if (a === "clear") { ST.picks = []; ST.wrong = ""; live.sms.text = ""; if (A) A.del(); storyPanel('[data-s="pick"]'); say(S.task); }
      else if (a === "call" && ST.sub === "dial") {   // 119: llama y se lleva el celular a la oreja
        ST.sub = "talk"; ST.at = ST.subAt = now; live.voice.step = 3; live.voice.rec = 0; live.voice.recAt = now; if (A) A.click(true); bodyG("tap");
        storyPanel('[data-s="mic"]'); say(S.task);
      } else if (a === "opt" && ST.sub === "pick") {   // tipo de red: solo 3G avanza; 5G y 4G explican por qué no
        if (v === "3g") { ST.wrong = ""; ST.net = "3g"; ST.sub = "search"; ST.subAt = now; setNet(true); storyPanel(storyFocus('[data-s="opt"][data-v="3g"]')); say(S.searching); bodyG("tap"); }
        else { ST.wrong = v; if (A) A.del(); storyPanel('[data-s="opt"][data-v="' + v + '"]'); say(S.wrongs[v]); bodyG(v === "4g" ? "tilt" : "shake"); }   // 4G: duda; 5G: no
      } else if (a === "send" && storyComplete()) storyEnd();
    });
    /* 119: el micrófono se mantiene presionado (ratón, dedo o barra espaciadora / Enter). Un toque corto dice al menos una frase completa. */
    function micStart() { if (ST.phase !== "compose" || ST.sub !== "talk" || ST.holding || storyComplete()) return; ST.holding = true; ST.talk0 = ST.talk; var m = storyEl.querySelector(".st-mic"); if (m) m.classList.add("on"); if (window.FFAudio) window.FFAudio.click(true); }
    function micEnd() {
      if (!ST.holding) return; ST.holding = false;
      ST.talk = Math.min(topic().story.say.length, Math.max(Math.ceil(ST.talk / STORY.piece - 1e-6), Math.floor(ST.talk0 / STORY.piece + 1e-6) + 1)) * STORY.piece;
      var m = storyEl.querySelector(".st-mic"); if (m) m.classList.remove("on");
    }
    storyEl.addEventListener("pointerdown", function (e) { if (e.target.closest('[data-s="mic"]')) { e.preventDefault(); micStart(); } });
    window.addEventListener("pointerup", micEnd); window.addEventListener("pointercancel", micEnd); window.addEventListener("blur", micEnd);
    storyEl.addEventListener("keydown", function (e) { if ((e.key === " " || e.key === "Enter") && e.target.closest('[data-s="mic"]')) { e.preventDefault(); if (!e.repeat) micStart(); } });
    storyEl.addEventListener("keyup", function (e) { if ((e.key === " " || e.key === "Enter") && e.target.closest('[data-s="mic"]')) { e.preventDefault(); micEnd(); } });
    /* indicador de arriba en cada momento: { id (cambia → se vuelve a dibujar), cls, barras encendidas, título, nota } */
    function storyChip(S, begun) {
      var k = storyKind();
      if (!begun || ST.phase === "off" || ST.phase === "done") return null;
      var busy = { id: "busy", cls: "b0", bars: S.busyBars != null ? S.busyBars : 1, b: S.busy, s: S.busyNote };
      if (ST.phase === "intro") return busy;
      if (ST.phase === "sent") return { id: "ok", cls: "st-ok", bars: k === "wait" ? 1 : 0, b: S.sent, s: S.sentNote };   // mensaje en espera: salió con la barra que encontró en el claro
      if (k === "wait" && (ST.phase === "walk" || ST.sub === "pending")) {   // en espera mientras camina; al llegar, el celular busca señal
        if (ST.phase === "walk" && ws.sig === "search") return { id: "search", cls: "search", bars: 0, b: S.searching, s: SIG_NOTE };
        return { id: "pend", cls: "b0", bars: 0, b: "⏳ " + S.pending, s: S.pendingNote };
      }
      if (k === "call" || (k === "voice" && ST.sub === "talk")) { var c = clock(storyElapsed()); return { id: "live" + c, cls: "st-live", bars: 3, b: S.liveChip + " · " + c, s: S.liveNote }; }
      if (k === "net" && ST.sub === "search") return { id: "search", cls: "search", bars: 0, b: S.searching, s: SIG_NOTE };
      if (k === "net" && ST.sub === "on") return { id: "on", cls: "", bars: 3, b: S.netChip, s: S.netNote };
      return busy;
    }
    /* cada fotograma, antes de mover al personaje: fase, postura, ojos, nube, globo e indicador */
    function storyFrame(dt, stage) {
      var S = topic().story, s = t - tl.w1, w = root.clientWidth, h = root.clientHeight;
      var top0 = sigEl.hidden ? 64 : Math.max(64, sigEl.offsetTop + sigEl.offsetHeight + 10);   // la nube y el globo quedan debajo del indicador de arriba (en celulares se tocaban)
      if (stage !== "wide" || !bye.hidden) { if (ST.phase !== "off" && ST.phase !== "done") storyReset(); return; }
      var k = storyKind(), now = performance.now();
      if (ST.phase === "off") { ST.phase = "intro"; live.sms = window.FFSms.fresh(); live.net = 0; }
      if (ST.phase === "intro" && (reduce || s >= composeAt() - 1e-3)) storyCompose();   // margen: el tiempo se detiene justo en w1 + composeAt() y la resta puede quedar apenas por debajo
      if (ST.phase === "sent" && shown.card) ST.phase = "done";
      if (ST.phase === "compose") {
        /* llamada: si ya dijo lo esencial y no cuelga, el reloj se pone rojo y el panel lo avisa */
        if (k === "call" && ST.doneAt && !ST.slow && (now - ST.doneAt) / 1000 > STORY.slow) { ST.slow = true; storyPanel(storyFocus('[data-s="send"]')); say(S.slow); bodyG("glance"); }   // mira a su alrededor: la línea sigue ocupada
        /* tipo de red: después de buscar unos segundos, conectado a 3G */
        if (k === "net" && ST.sub === "search" && (reduce || (now - ST.subAt) / 1000 >= STORY.search)) { ST.sub = "on"; storyPanel(storyFocus('[data-s="send"]')); say(S.connected + " " + S.backTask); bodyG("nod"); }
        /* 119: mientras se mantiene el micrófono, Valeria va diciendo cada frase */
        if (k === "voice" && ST.sub === "talk") {
          if (ST.holding) ST.talk = Math.min(S.say.length * STORY.piece, ST.talk + (reduce ? STORY.piece : dt));
          var n = storySaid();
          if (n !== ST.said) {
            ST.said = n; if (n > 0) { ST.line = S.say[n - 1]; ST.lineAt = now; say(ST.line); bodySay(ST.line); if (window.FFAudio) window.FFAudio.key("x"); }
            if (storyComplete()) { ST.holding = false; ST.doneAt = now; storyPanel(storyFocus('[data-s="send"]')); say(S.ready); }
            else { var mm = storyEl.querySelector(".st-msg"); if (mm) mm.outerHTML = msgHTML(storyLines(), S.empty); }
          }
          var mp = storyEl.querySelector(".st-mic-p"); if (mp) mp.style.width = Math.round(100 * ST.talk / (S.say.length * STORY.piece)) + "%";
        }
        /* reloj de la llamada (en el panel) */
        if (k === "call" || (k === "voice" && ST.sub === "talk")) { var sec = Math.floor(storyElapsed()); if (sec !== ST.sec) { ST.sec = sec; var te = storyEl.querySelector(".st-time"); if (te) te.textContent = clock(sec); } }
      }
      /* mensaje en espera: Mateo camina; cuando el celular encuentra señal (fin de la búsqueda), el mensaje sale solo */
      if (ST.phase === "walk" && ws.sig === "result") { bodyG("lookUp"); storyEnd(); }
      var begun = reduce || s >= STORY.think;
      /* postura (solo cuando empieza la interacción, nunca durante el comentario): SMS y tipo de red, celular un poco más alto para mirarlo;
         llamada y 119, a la oreja (se mueve de a poco: ST.ear 0 → 1) */
      var target = (k === "net" || k === "sms" || k === "wait") && ST.phase === "compose" ? (k === "net" ? 0.45 : 0.4) : 0;
      ST.raise = reduce ? target : ST.raise + (target - ST.raise) * Math.min(1, dt * 3);
      var earT = ST.phase === "compose" && (k === "call" || (k === "voice" && ST.sub === "talk")) ? 1 : 0;
      ST.ear = reduce ? earT : ST.ear + (earT - ST.ear) * Math.min(1, dt * 4);
      ST.mood = ST.phase === "intro" && begun ? "scared" : ST.phase === "sent" || ST.phase === "done" ? "happy" : null;
      /* indicador de arriba: aparece un momento después de que Valeria empieza a hablar (con la tarjeta visible ya no hace falta, y la taparía) */
      var chip = storyChip(S, reduce || s >= STORY.chip), ck = chip ? chip.id : "";
      if (ck !== ST.key) {
        var was = ST.key; ST.key = ck; sigEl.hidden = !chip;
        if (chip) {
          sigEl.className = "sw-signal st-sig " + chip.cls;
          [].forEach.call(sigEl.querySelectorAll(".sw-bars i"), function (el, i) { el.classList.toggle("on", i < chip.bars); });
          sigEl.querySelector("b").textContent = chip.b; sigEl.querySelector("small").textContent = chip.s;
          if (chip.id.indexOf("live") !== 0 || was.indexOf("live") !== 0) say(chip.b + ": " + chip.s);   // el reloj no se anuncia cada segundo
        }
      }
      /* globo de Valeria: primero cuenta el problema; después, lo que dice en la llamada (unos segundos) y la frase del cierre (hasta que aparece la tarjeta) */
      var btxt = ST.phase === "intro" && begun && !reduce ? S.comment : ST.phase === "sent" ? S.bubble : ST.phase === "compose" && ST.line && now - ST.lineAt < 2800 ? ST.line :
                 ST.phase === "walk" && ws.sig === "none" && S.walkBubble ? S.walkBubble : "", showB = !!btxt;   // mensaje en espera: mientras camina dice adónde va
      if (ST.phase === "intro" && begun && walkHud.getAttribute("data-t") !== btxt) say(S.comment);
      if (walkHud.hidden !== !showB) walkHud.hidden = !showB;
      if (showB && walkHud.getAttribute("data-t") !== btxt) { walkHud.setAttribute("data-t", btxt); bubbleEl.textContent = btxt; }
      if (showB) {
        var cgx = charGroup.position.x, cgz = charGroup.position.z;   // el globo sigue al personaje (Mateo camina en «El mensaje en espera»)
        u3.set(cgx + 1.45 * CK, 3.75 * CK, cgz).project(camera); var bw2 = walkHud.offsetWidth, bh2 = walkHud.offsetHeight, bx = (u3.x + 1) / 2 * w, by = (1 - u3.y) / 2 * h;
        var side = ST.phase !== "compose" && bx + bw2 <= w - 10; walkHud.classList.toggle("above", !side);   // con el panel abierto, encima de la cabeza (a la derecha lo taparía el panel)
        if (!side) { u3.set(cgx, 4.55 * CK, cgz).project(camera); bx = (u3.x + 1) / 2 * w - bw2 / 2; by = (1 - u3.y) / 2 * h - bh2; } else by -= bh2 / 2;
        walkHud.style.left = Math.max(10, Math.min(w - bw2 - 10, bx)) + "px"; walkHud.style.top = Math.max(top0, Math.min(h - bh2 - 10, by)) + "px";
      }
    }
    /* tarjeta corta del paso 4 */
    function learnedHTML(o) {
      var S = o.story, k = S.kind || "sms", pieces = storyLines(), ICO = { yes: "✓", no: "✕", warn: "!" };
      if (!pieces.length) pieces = k === "voice" ? S.say : storyNeed().map(function (p) { return p[2]; });
      var lbl = S.box || "Mensaje de Valeria", dur = k === "call" && ST.dur >= 1 ? clock(ST.dur) : "";
      return '<p class="ln-kicker">' + esc(tr("Lo aprendido")) + '</p><h2 id="seq-title">' + (o.icon === "sms" ? ICON_SMS : ICON_PHONE) + esc(o.name) + "</h2>" +
        '<p class="ln-key">' + esc(S.key) + "</p>" +
        '<div class="ln-msg ' + k + '"><span class="ln-lbl">' + esc(lbl) + (dur ? ' <b class="ln-dur">' + esc(tr("Duración")) + " " + dur + "</b>" : "") + "</span><p>" + pieces.map(function (p) { return "<span>" + esc(p) + "</span>"; }).join(" ") + "</p></div>" +
        '<ul class="ln-facts">' + S.facts.map(function (f) { return '<li class="' + f[0] + '"><i aria-hidden="true">' + ICO[f[0]] + "</i><b>" + esc(f[1]) + "</b><span>" + esc(f[2]) + "</span></li>"; }).join("") + "</ul>" +
        '<details class="ln-more"><summary>' + esc(tr("Saber más")) + "</summary>" +
          (o.intro ? "<h3>" + esc(introTitle(o)) + "</h3><p>" + esc(o.intro) + "</p>" : "") +
          "<h3>" + esc(o.whatTitle || "Cómo ayuda") + "</h3>" + paras(o.what) +
          (o.why ? "<h3>¿Por qué es útil cuando hay problemas de conectividad?</h3><p>" + esc(o.why) + "</p>" : "") +
          netHTML(o) + (o.limit ? "<h3>Condiciones y límites</h3>" + paras(o.limit) : "") + "</details>" +
        '<div class="seq-actions"><button type="button" class="seq-again" data-act="story-again">' + esc(tr("Ver la historia otra vez")) + "</button>" +
        '<button type="button" class="seq-again" data-act="again">' + esc(tr("Repetir práctica")) + "</button>" +
        '<a class="seq-finish seq-card-next" data-act="next" data-nav href="' + esc(NAV.next.href) + '"' + (NAV.next.topic ? ' data-nav-topic="' + esc(NAV.next.topic) + '"' : "") + ">" + esc(NAV.next.label) + ' <span aria-hidden="true">→</span></a></div>';
    }

    /* ---------- lenguaje corporal: qué siente, qué mira y qué hace el personaje en cada momento (el cuerpo lo mueve js/characters-3d.js) ----------
       Cada fotograma se decide la postura (character.pose), la mirada (character.lookAt) y si está hablando (character.talking).
       Los gestos de una sola vez salen de momentos de la historia y se guardan en bodyEv: suenan una vez por momento, aunque la página se vuelva
       a dibujar; se borran al empezar de nuevo la alternativa, la historia o el sismo. */
    var bodyEv = {}, bodyLook = V(0, 0, 0);
    function bodyOnce(key, fn) { if (bodyEv[key] || !character) return; bodyEv[key] = true; fn(character); }
    function bodyG(name) { if (character && character.gesture) character.gesture(name); }
    function bodySay(text) { if (character && character.say) character.say(text); }
    function bodyReset() { bodyEv = {}; if (character && character.quiet) character.quiet(); }
    function objWorld(out) { if (mod.lookWorld && mod.lookWorld(out)) return out; return rig.getWorldPosition(out); }   // el objeto en la mano (la linterna: la zona iluminada)
    function bodyFrame(stage, wt) {
      var c = character; if (!c) return;
      var pose = null, look = false, talking = false, o = topic(), now = performance.now();
      if (!bye.hidden) { pose = "relief"; bodyOnce("bye", function (c) { c.gesture("jump"); }); }   // despedida: saluda (ya existía) y, una sola vez, un pequeño salto
      else if (stage === "wide") {
        if (hasStory()) {
          var S = o.story, k = storyKind(), s = t - tl.w1;
          if (ST.phase === "intro") {
            /* cuenta el problema: mira el celular, baja la cabeza, hombros tensos; gestos de la mano libre con las frases */
            look = k !== "call" || ST.ear < .5;
            if (s >= STORY.think) { pose = "worry"; talking = true; bodyOnce("say", function () { bodySay(S.comment); }); }
          } else if (ST.phase === "compose") {
            if (k === "call" || (k === "voice" && ST.sub === "talk")) {   // en la llamada: habla (cabeza y mano libre); si no cuelga, se preocupa
              pose = ST.slow ? "worry" : "talk"; talking = (!!ST.line && now - ST.lineAt < 2800) || ST.holding;
            } else { pose = ST.sub === "pending" ? "worry" : "focus"; look = true; }   // mira la pantalla y se prepara para usarla (mensaje en espera: preocupado)
          } else if (ST.phase === "walk" && wt) {   // mensaje en espera: camina mirando al frente; al llegar levanta el celular y lo mira
            look = wt.raise > .5; pose = wt.raise > .5 ? "focus" : null;
          } else if (ST.phase === "sent" || ST.phase === "done") {
            pose = "relief";
            bodyOnce("sent", function () { if (k === "sms" || k === "wait") bodyG("lookUp"); else bodyG("nod"); bodyG("raise"); });   // SMS: sigue con la mirada el mensaje que sube
          }
        } else if (o.walk && wt) {   // Mateo busca señal: camina mirando al frente, levanta el celular y lo mira; con el resultado, niega o asiente
          look = wt.raise > .5;
          pose = wt.sig === "result" ? (live.walk.bars ? "relief" : "worry") : wt.raise > .5 ? "focus" : null;
          /* sin señal: niega; señal débil: asiente; señal parcial (lo mejor que puede pasar aquí): un pequeño salto de alegría */
          if (wt.sig === "result") bodyOnce("walk" + walkTry, function () { var b = live.walk.bars; bodyG(!b ? "shake" : b >= 2 ? "jump" : "nod"); });
        } else {
          /* demás alternativas: al llegar, mira el objeto (la radio: ladea la cabeza como quien escucha); la linterna: la cabeza sigue la luz */
          var since = t - tl.w1, ASb = mod.antennaScene && mod.antennaScene.active ? mod.antennaScene : null;
          if (ASb) { look = true; pose = ASb.pose; talking = !!ASb.bubble; if (ASb.mood === "happy") bodyOnce("antena", function () { bodyG("nod"); }); }   // escena de la antena: mira la radio; al oírse claro, asiente
          else if (J.module === "torch") { look = true; pose = "focus"; }
          else if (since < 3.2) { look = true; pose = J.module === "radio" ? "listen" : "focus"; }
        }
      }
      c.pose = pose; c.talking = talking; c.lookAt = look ? objWorld(bodyLook) : null;
    }

    /* ---------- práctica (etapa 2) ----------
       El objeto queda solo, grande y en el centro (sin manos) y el usuario lo usa directamente: toca la pantalla del teléfono (o escribe con su teclado),
       gira las perillas de la radio o mantiene presionado el interruptor de la linterna. Un panel pequeño, abajo y al centro, dice qué hacer;
       al terminar pregunta «Mmm… ¿quieres repetir la práctica?» y ofrece «Repetir práctica» o «Continuar» (al personaje y al cuadro). */
    var P = { on: false, released: false, done: false, key: "", airOn: false, user: [], err: false, errT: 0, mdone: false, until: 0 };
    var AIR_MS = 7000;   // modo avión: tiempo que tiene el usuario para practicar; al acabarse, el recorrido continúa solo
    function tr(s) { return window.FFi18n && window.FFi18n.t ? window.FFi18n.t(s) : s; }
    function practiceOff() {
      P.on = false; P.done = false; P.key = ""; prac.hidden = true; prac.innerHTML = ""; root.classList.remove("seq-practicing");
      if (hold) { hold = null; hot.classList.remove("held"); } stopPlay(); clearTimeout(P.errT); hot.hidden = true; setHotMode("toggle");
      if (J.module === "radio" && window.FFAudio && window.FFAudio.radioStop) window.FFAudio.radioStop();   // al terminar (o saltar) la práctica, la radio se calla: la canción no sigue en el personaje ni en la información
    }
    function practiceSetup() {
      resetLive(); stopPlay(); P.done = false; P.airOn = false; P.user = []; P.err = false; P.mdone = false; clearTimeout(P.errT); P.key = "";
      P.until = topic().airplane ? performance.now() + AIR_MS : 0;
      if (topic().sms) { live.sms.num = "0000000000"; live.sms.screen = "compose"; live.sms.field = "msg"; }   // el destinatario ya está elegido («Familia»)
      setLight(false, true);
    }
    function practiceStart() {
      P.on = true; practiceSetup(); prac.hidden = false; root.classList.add("seq-practicing"); updateLead();
      if (J.module === "torch") { setHotMode("hold"); hot.hidden = false; }
      if (TORCH) {   // al llegar al centro, el cuadro muestra un ejemplo de la señal SOS (la linterna destella y cada punto o raya se ilumina); luego practica el usuario
        P.demo = true; pRender(true);
        playEvents(sosEvents(), function () { P.demo = false; pRender(true); }); P.demo = true;
        return;
      }
      pRender(true);
    }
    function practiceRelease() {
      practiceOff(); P.released = true; setLight(false, true); say("Continuar");
      if (reduce) t = tl.card + 0.01;
    }
    function nearestStation() {
      var F = window.FFTuner, st = F.state, best = null, bd = 1e9;
      window.FF.tuner.bands[st.band].forEach(function (s) { var d = Math.abs(s.pos - st.pos); if (d < bd) { bd = d; best = s; } });
      return best;
    }
    /* qué tiene que hacer ahora el usuario (según el estado real del objeto) y si ya terminó */
    function pTask() {
      var o = topic(), now = performance.now(), L = live, id = o.id;
      if (J.module === "torch") {
        if (P.demo) return { text: "Mira el ejemplo: tres destellos cortos, tres largos y tres cortos forman la señal SOS. Después hazlo tú.", morse: true };
        if (P.mdone) return { text: "¡Correcto! Formaste la señal SOS: tres destellos cortos, tres largos y tres cortos.", done: true, morse: true };
        return { text: P.err ? "Ese destello no corresponde. El SOS es · · · — — — · · · (corto, corto, corto, largo, largo, largo…). Vuelve a empezar."
          : "Mantén presionado el interruptor de la linterna (el círculo amarillo): un toque corto hace un punto y uno largo, una raya. Forma la señal SOS.", morse: true, btns: [["sos", "Ver la señal SOS"], ["clear", "Borrar"]] };
      }
      if (J.module === "radio") {
        var F = window.FFTuner, D = window.FF.tuner, c = F.clarity();
        var btns = !!(mod.buttons && mod.buttons());   // radio de Cali: botones arriba en vez de perillas
        if (!F.state.on) return { text: btns ? "Presiona el primer botón de arriba de la radio (a la izquierda) para encenderla." : "Toca la perilla izquierda de la radio para encenderla.", meter: 0 };
        /* zona rural: la emisora llega débil (la antena está recogida). En el punto exacto sigue sin oírse: el medidor se queda bajo y el texto lo dice;
           al continuar, Mateo estira la antena (escena de la antena, js/seq-modules.js) */
        var weak = !!(mod.weakSignal && mod.weakSignal());
        if (c >= 0.75 && weak) return { text: "Mmm… la perilla está justo en la emisora, pero parece que todavía no se escucha. ¿Qué podrá hacer Mateo? Toca «Continuar».", done: true, meter: 1 };   // la barra indica la sintonía: completa, aunque no se oiga
        if (P.done && weak) return { text: "La emisora está ahí, pero casi no se oye. Toca «Continuar» para ver qué hace Mateo.", done: true, meter: c };
        if (c >= 0.75) { var ns = nearestStation(); return { text: "¡Encontraste una emisora! " + ns.name + " (" + F.state.band + "). " + ns.msg, done: true, meter: c }; }
        if (P.done) return { text: "Ya encontraste una emisora. Puedes volver a ella moviendo el dial, o continuar.", done: true, meter: c };
        if (btns) return { text: "Mantén presionados el tercer (−) y el cuarto (+) botón de arriba para mover la sintonía. El segundo cambia entre AM y FM y el quinto salta a la siguiente emisora. " + (c >= 0.3 ? D.near : D.noise), meter: c };
        return { text: "Gira la perilla derecha con el cursor (como una perilla de verdad) para mover el dial. Toca AM o FM para cambiar de banda. " + (c >= 0.3 ? D.near : D.noise), meter: c };
      }
      if (id === "sms") {
        var s = L.sms;
        if (s.sent) return { text: "Mensaje enviado (simulado). Que salga no garantiza que llegue: en la vida real depende de la red celular.", done: true };
        if (s.text.trim().length < 2) return { text: "Toca las letras del teclado del teléfono (o escribe con tu teclado) para escribir un mensaje corto, por ejemplo «" + (topic().exampleHint || "Estoy bien") + "»." };
        return { text: "¡Bien! Cuando termines, toca el botón ➤ del teléfono para enviarlo (simulado).", btns: [["del", "Borrar una letra"]] };
      }
      if (id === "cobertura" || id === "lugar") {
        var since = now - L.searchAt, dur = id === "lugar" ? 2000 : 3200;
        if (L.searchAt < 0) return { text: id === "lugar" ? "Mateo no tiene señal. Toca «Actualizar» en la pantalla del teléfono para buscar red." : "Toca «Buscar red» en la pantalla del teléfono." };
        if (since < dur) return { text: "Buscando red… espera unos segundos." };
        return id === "lugar" ? { text: "Aquí sigue sin servicio. Ahora verás a Mateo buscar, con cuidado, un lugar abierto y seguro.", done: true }
          : { text: "Apareció una señal débil: puede ir y venir y no está garantizada.", done: true };
      }
      if (id === "reconexion" || id === "avion") {
        if (L.airplane) return { text: "Modo avión activado: no entran ni salen llamadas ni SMS. Toca el interruptor otra vez para desactivarlo." };
        if (!P.airOn) return { text: "Toca el interruptor «Modo avión» en la pantalla del teléfono para activarlo." };
        if (now - L.recAt < 2800) return { text: "El teléfono vuelve a buscar una red…" };
        return { text: "El teléfono se reconectó (simulado). Si en el lugar hay algo de señal, en este momento los mensajes pendientes podrían enviarse.", done: true };
      }
      if (id === "red") {
        if (!L.net) return { text: "Toca «3G» en la lista «Tipo de red preferido» del teléfono." };
        if (now - L.netAt < 2400) return { text: "Buscando la nueva red…" };
        return { text: "Conectado a 3G (simulado): internet lento, pero las llamadas y los SMS pueden funcionar.", done: true };
      }
      if (id === "llamadas") {
        if (L.call.step === 0) return { text: "Toca «Familia» en la pantalla para hacer una llamada breve (simulada)." };
        if (L.call.step === 1) return { text: "Di solo lo esencial (quién eres, dónde estás y qué necesitas) y toca el botón rojo para colgar." };
        return { text: "Llamada breve terminada: la línea queda libre para otras personas. No se llamó a nadie.", done: true };
      }
      if (id === "voz") {
        var v = L.voice;
        if (v.step === 0) return { text: "Toca la aplicación «Teléfono» (el icono verde del auricular)." };
        if (v.step === 1) return { text: "Marca 1, 1 y 9 en el teclado del teléfono." };
        if (v.step === 2) return { text: "Pulsa el botón verde para llamar (simulado)." };
        if (v.step === 3) return { text: "Escucha la grabación y di lo esencial: que estás bien y dónde estás. Luego toca el botón rojo para colgar." };
        return { text: "Llamada finalizada (simulación): no se llamó a ningún número.", done: true };
      }
      return { text: o.hint || "", done: true };
    }
    /* la señal SOS del panel, con lo que el usuario ya formó marcado */
    function morseHTML() {
      var h = '<div class="mo-seq" role="img" aria-label="SOS: tres destellos cortos, tres largos y tres cortos">', n = 0;
      ["S", "O", "S"].forEach(function (L, li) { h += '<span class="mo-letter"><span class="mo-syms">'; for (var k = 0; k < 3; k++) { var got = n < P.user.length, bad = P.err && n === P.user.length - 1; h += '<i class="mo-sym ' + (li === 1 ? "dash" : "dot") + (bad ? " bad" : got ? " got" : "") + '" data-mi="' + n + '"></i>'; n++; } h += "</span><b>" + L + "</b></span>"; });
      return h + "</div>";
    }
    function pRender(force) {
      if (!P.on) return;
      var k = pTask();
      if (k.done && !P.done) { P.done = true; var A = window.FFAudio; if (A && A.blip && J.module !== "radio") A.blip(); }
      if (k.meter !== undefined) { var mt = prac.querySelector(".pr-meter i"); if (mt) mt.style.width = Math.round(k.meter * 100) + "%"; }
      var key = k.text + "|" + P.done + "|" + (k.morse ? P.user.join(",") + P.err : "") + "|" + (k.btns ? k.btns.map(function (b) { return b[0]; }).join() : "");
      if (!force && key === P.key) return;
      var fresh = P.key !== key; P.key = key;
      var hadFocus = prac.contains(document.activeElement);
      var h = '<p class="pr-kicker">' + esc(tr("Práctica")) + " · " + esc(tr(topic().name)) + "</p>";
      if (k.morse) h += morseHTML();
      h += '<p class="pr-task' + (P.done ? " ok" : "") + (k.morse && P.err ? " err" : "") + '">' + esc(tr(k.text)) + "</p>";
      if (k.meter !== undefined) h += '<div class="pr-meter" aria-hidden="true"><i style="width:' + Math.round(k.meter * 100) + '%"></i></div>';
      if (P.until) h += '<p class="pr-timer" aria-hidden="true"></p>';   // cuenta regresiva del modo avión (la actualiza el bucle)
      if (P.done) h += '<div class="pr-acts"><button type="button" class="seq-again" data-p="repeat">' + esc(tr("Repetir práctica")) + '</button><button type="button" class="seq-finish" data-p="go">' + esc(tr("Continuar")) + ' <span aria-hidden="true">→</span></button></div>';
      else if (k.btns) h += '<div class="pr-acts">' + k.btns.map(function (b) { return '<button type="button" class="seq-again' + (b[0] === "sos" ? " mo-act" : "") + '" data-p="' + b[0] + '">' + esc(tr(b[1])) + "</button>"; }).join("") + "</div>";
      prac.innerHTML = h; syncGuideButtons();
      if (fresh) say(k.text);
      if (P.done && (hadFocus || force)) { var g = prac.querySelector('[data-p="go"]'); if (g && hadFocus) g.focus({ preventScroll: true }); }
    }
    /* el usuario formó un punto o una raya con el interruptor: se compara con SOS (... --- ...) */
    function pSym(sym) {
      if (!P.on) return;
      if (P.mdone || P.err) { P.user = []; P.mdone = false; P.err = false; clearTimeout(P.errT); }
      P.user.push(sym);
      var str = P.user.map(function (x) { return x === "dot" ? "." : "-"; }).join("");
      if (str !== SOS_STR.slice(0, str.length)) { P.err = true; clearTimeout(P.errT); P.errT = setTimeout(function () { if (P.err) { P.err = false; P.user = []; pRender(); } }, 4000); }
      else if (str.length === SOS_STR.length) P.mdone = true;
      pRender();
    }
    /* acciones sobre el objeto (las llama el módulo al tocar la pantalla del teléfono, o el panel / el teclado) */
    function practiceAct(a, v) {
      if (!P.on) return;
      var now = performance.now(), A = window.FFAudio, s = live.sms; live.kick = now;
      if (a === "key") { if (s.sent || s.text.length >= 60) return; s.text += s.text.length === 0 ? String(v).toUpperCase() : v; live.tapAt = now; live.tapCh = String(v).toLowerCase(); if (A) A.key(v); }
      else if (a === "del") { if (s.sent || !s.text) return; s.text = s.text.slice(0, -1); live.tapAt = now; live.tapCh = "del"; if (A) A.del(); }
      else if (a === "exmsg") { if (s.sent) return; s.text = window.FFSms.example || window.FFSms.EXAMPLE_MSG; if (A) A.click(true); }
      else if (a === "send") { if (s.sent) return; if (!s.text.trim()) { say("Escribe primero un mensaje"); return; } s.sent = true; live.tapAt = now; live.tapCh = "send"; if (A) A.send(); say("Envío simulado"); }
      else if (a === "search") { if (now - live.searchAt < 3300) return; doSearch(); }
      else if (a === "air") { setAirplane(!live.airplane); if (live.airplane) P.airOn = true; }
      else if (a === "net") { if (!!live.net === !!v) return; setNet(v); }
      else if (a === "call") { if (live.call.step !== 0) return; live.call = { step: 1, at: now, end: 0 }; if (A) A.click(true); }
      else if (a === "hang") { if (live.call.step !== 1) return; live.call.step = 3; live.call.end = now; if (A) A.click(false); }
      else if (a === "v-open") { if (live.voice.step !== 0) return; live.voice.n = 0; voiceAct("vz-open"); }
      else if (a === "v-digit") {
        var vv = live.voice; if (vv.step !== 1) return; live.tapAt = now; live.tapCh = v;
        if (v === "119".charAt(vv.n || 0)) { vv.n = (vv.n || 0) + 1; if (A) A.key(v); if (vv.n >= 3) voiceAct("vz-dial"); }
        else { say("Marca 1, 1 y 9"); if (A) A.del(); }
      }
      else if (a === "v-call") { if (live.voice.step !== 2) return; voiceAct("vz-call"); }
      else if (a === "v-stop") { if (live.voice.step !== 3) return; voiceAct("vz-stop"); }
      pRender();
    }
    prac.addEventListener("click", function (e) {
      var b = e.target.closest("[data-p]"); if (!b) return; var a = b.getAttribute("data-p");
      if (a === "go") practiceRelease();
      else if (a === "repeat") { practiceSetup(); pRender(true); var f = prac.querySelector("[data-p]"); if (f) f.focus({ preventScroll: true }); say("Repetir práctica"); }
      else if (a === "exmsg" || a === "del") practiceAct(a);
      else if (a === "sos") { if (!mp.busy && !hold) { P.user = []; P.err = false; P.mdone = false; pRender(); playSos(); } }
      else if (a === "clear") { P.user = []; P.err = false; P.mdone = false; clearTimeout(P.errT); pRender(); }
    });
    /* SMS: también se escribe con el teclado del dispositivo (Enter envía, Retroceso borra) */
    function onPracticeKey(e) {
      if (!P.on || !topic().sms || e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = (e.target && e.target.tagName) || "", k = e.key, onBtn = tag === "BUTTON" || tag === "A";
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (k === "Backspace") practiceAct("del");
      else if (k === "Enter") { if (onBtn) return; practiceAct("send"); }
      else if (k === " ") { if (onBtn) return; practiceAct("key", " "); }
      else if (k.length === 1 && /^[a-záéíóúñü0-9.,:;!?¿¡'"()\-]$/i.test(k)) practiceAct("key", k);
      else return;
      e.preventDefault(); e.stopPropagation();
    }
    document.addEventListener("keydown", onPracticeKey, true);

    /* encuadre de la práctica: el objeto (sin manos ni haz de luz) centrado y grande, un poco por encima del centro para dejar sitio al panel */
    var pbox = new THREE.Box3(), ptmp = new THREE.Box3();
    function visBox(o) {
      if (!o.visible) return;
      if (o.isMesh && o.geometry) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); ptmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); pbox.union(ptmp); }
      o.children.forEach(visBox);
    }
    function practiceCam() {
      var nb = mod.noBox || [], was = nb.map(function (o) { var v = o.visible; o.visible = false; return v; });
      var sp = rig.position.clone(), sq = rig.quaternion.clone(), ss = rig.scale.x;
      copyPose(pc, mod.pose.close(info)); place(pc, pc, 0); rig.updateMatrixWorld(true);
      pbox.makeEmpty(); rig.children.forEach(visBox);   // el rig puede estar oculto (sismo / sin señal): se mide igual
      rig.position.copy(sp); rig.quaternion.copy(sq); rig.scale.setScalar(ss); rig.updateMatrixWorld(true);
      nb.forEach(function (o, i) { o.visible = was[i]; });
      if (pbox.isEmpty()) return null;
      var c = pbox.getCenter(V(0, 0, 0)), sz = pbox.getSize(V(0, 0, 0)), tn = Math.tan(camera.fov * Math.PI / 360);
      /* celular: panel abajo → el objeto sube; computador: panel a la derecha y explicación a la izquierda → el objeto, centrado y más alto (≈ ¾ de la pantalla) */
      var small = portrait || aspect < 1.1 || root.clientWidth <= 720, fillH = small ? 0.46 : 0.74, fillW = small ? 0.86 : 0.4, up = small ? 0.16 : 0.02;
      var d = Math.max(sz.y / (2 * tn * fillH), sz.x / (2 * tn * aspect * fillW)) + sz.z / 2, ly = c.y - up * 2 * d * tn;
      return { p: V(c.x, ly, c.z + d), l: V(c.x, ly, c.z) };
    }

    /* ---------- bucle ---------- */
    var info = { t: 0, tl: null, stage: "hero", kIn: 0, kOut: 0, ta: 0, A: 0, fromWide: false, rise: 0, leftK: 1, armsK: 1, envA: 0, sweep: 0, speakK: 0, wrist: V(0, 0, 0), hold: V(0, 0, 0), holdAxis: V(1, 0, 0), pocket: V(0, 0, 0), holdOk: false, live: live, aspect: 1, portrait: false, reduce: reduce, dt: 0, ctx: ctxId, topic: topicId, camera: camera };
    var raf = 0, last = performance.now(), api = { hold: false }, pv = V(0, 0, 0), v1 = V(0, 0, 0), u3 = V(0, 0, 0), pw = { p: V(0, 0, 0), q: new THREE.Quaternion(), s: 1 }, ph = { p: V(0, 0, 0), q: new THREE.Quaternion(), s: 1 }, pc = { p: V(0, 0, 0), q: new THREE.Quaternion(), s: 1 };
    var yawQ = new THREE.Quaternion(), YAX = V(0, 1, 0);
    function copyPose(d, s) { d.p.copy(s.p); d.q.copy(s.q); d.s = s.s; }
    function place(a, b, k) {
      var q = rig.quaternion.copy(a.q).slerp(b.q, k), s = lerp(a.s, b.s, k); rig.scale.setScalar(s);
      pv.lerpVectors(a.p, b.p, k).sub(u3.copy(mod.pivot).multiplyScalar(s).applyQuaternion(q)); rig.position.copy(pv);
    }
    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - last) / 1000, 0.033); last = now; if (qState) { quakeFrame(dt); return; } if (!holdT && !api.hold) t += dt;
      if (!P.released && t > tl.c0 + PHOLD) t = tl.c0 + PHOLD;   // práctica: el tiempo espera a que el usuario pulse «Continuar»
      var story = hasStory();
      if (story && (ST.phase === "intro" || ST.phase === "compose") && t > tl.w1 + composeAt()) t = tl.w1 + composeAt();   // historia: espera a que el usuario termine
      var H = tl.H, c0 = tl.c0, c1 = tl.c1, w1 = tl.w1;
      var kIn = H >= 0 ? E((t - H) / T_CLOSE) : 1, kOut = E((t - c1) / TIMES.toWide);
      var stage = t < H ? "hero" : t < c1 ? "close" : "wide";
      if (!G) { if (stage === "hero") setStep(1); else if (stage === "close") setStep(2); else if (t < tl.card) setStep(3); }
      var sweep = t > w1 && !reduce ? (t - w1) * 0.55 : 0;
      var envA = t < c1 ? (tl.fromWide ? 1 - E(kIn * 1.3) : 0) : E((t - (c1 + 0.2)) / 1.6);
      var speakK = t >= tl.card ? 1 : 0;
      if (story) storyFrame(dt, stage);

      // Keep feet on the ground; articulation happens inside the imported model.
      var wt = !character ? null : topic().walk ? walkState(t) : story && storyKind() === "wait" ? storyWalk() : null;   // «Buscar un lugar con mejor señal» y «El mensaje en espera»: Mateo camina por el escenario
      charGroup.scale.setScalar(CK); charGroup.position.set(wt ? wt.x : 0, 0, wt ? wt.z : 0); charGroup.rotation.set(0, wt ? wt.yaw : 0, 0); charGroup.updateMatrixWorld(true);
      var earOn = story && (storyKind() === "call" || storyKind() === "voice");   // historias de llamada: el celular va de la mano a la oreja según ST.ear
      info.raiseK = wt && story ? Math.max(wt.raise, ST.raise) : wt ? wt.raise : story ? ST.raise : 0; info.charYaw = wt ? wt.yaw : 0; info.earK = earOn ? ST.ear : null;
      var AS = mod.antennaScene && mod.antennaScene.active ? mod.antennaScene : null;   // radio en la zona rural: Mateo levanta la radio y mueve la antena
      if (character) { character.walk = wt; character.raiseK = info.raiseK; character.mood = story ? ST.mood : AS ? AS.mood : null; character.earK = info.earK; character.holdLift = AS ? AS.lift : 0; character.reach = AS ? AS.reach : null; }
      bodyFrame(stage, wt);   // postura, mirada y gestos según la historia
      if (character) { character.fear = 0; character.update(t, topicId, J.module, reduce, speakK, envA, !bye.hidden); character.wrist(info.wrist); info.holdOk = !!(character.holdFrame && character.holdFrame(info.hold, info.holdAxis, info.pocket)); }   // en la despedida sostiene el objeto y saluda con la otra mano
      else { charGroup.updateMatrixWorld(true); wristLocal.set(C3.wrist[0], C3.wrist[1], C3.wrist[2]); info.wrist.copy(charGroup.localToWorld(u3.copy(wristLocal))); }
      info.character3D = !!character; info.charScale = CK;   // los objetos en la mano se achican igual que el personaje (js/seq-modules.js)
      info.t = t; info.tl = tl; info.stage = stage; info.kIn = kIn; info.kOut = kOut; info.ta = tl.A; info.A = tl.A; info.fromWide = tl.fromWide; info.practice = stage === "close";   // sin demostración: el objeto muestra siempre su estado real
      info.rise = tl.fromWide ? 1 : E((t - H) / 1.0); info.envA = envA; info.sweep = sweep; info.speakK = speakK; info.aspect = aspect; info.portrait = portrait; info.dt = dt; info.ctx = ctxId; info.topic = topicId;
      info.leftK = t < c1 ? (tl.fromWide ? E(kIn * 1.4) : 1) : 1 - E((t - c1) / 0.9);
      info.armsK = t < c1 + (w1 - c1) * 0.45 ? 1 : 0;

      /* objeto: hero → primer plano → plano completo (siempre el mismo modelo, mezclado sin cortes) */
      copyPose(pw, mod.pose.wide(info));
      if (info.charYaw) { yawQ.setFromAxisAngle(YAX, info.charYaw); pw.p.sub(info.wrist).applyQuaternion(yawQ).add(info.wrist); pw.q.premultiply(yawQ); }   // el celular gira con Mateo al caminar
      if (t < H) { copyPose(ph, mod.pose.hero(t, info)); place(ph, ph, 0); }
      else if (t < c1) { copyPose(pc, mod.pose.close(info)); if (tl.fromWide) place(pw, pc, kIn); else { copyPose(ph, mod.pose.hero(H, info)); place(ph, pc, kIn); } }
      else { copyPose(pc, mod.pose.close(info)); place(pc, pw, kOut); }

      /* cámara */
      if (t < H) { camera.position.copy(camHero.p); v1.copy(camHero.l); }
      else if (t < c1) {
        var cf = tl.fromWide ? camWide : camHero;
        camera.position.lerpVectors(cf.p, camClose.p, kIn); v1.lerpVectors(cf.l, camClose.l, kIn);
        if (!tl.fromWide && !reduce) camera.position.x += Math.sin(t * 0.6) * 0.04 * kIn;
      } else { camera.position.lerpVectors(camClose.p, camWide.p, kOut); v1.lerpVectors(camClose.l, camWide.l, kOut); }
      /* escena de la antena (radio rural): plano cercano de Mateo y la radio (de la cabeza a la radio levantada), mezclado suavemente con el completo */
      var camK = mod.antennaScene && mod.antennaScene.active ? mod.antennaScene.camK : 0;
      if (camK > 0.001) {
        var cgp = charGroup.position, dist = (portrait ? 7.6 : 8.8) * CK;   // entra del sombrero a la radio levantada (a la altura de la cintura), sin tocar los controles de abajo
        u3.set(cgp.x + (portrait ? 0.1 : 0.4) * CK, 2.8 * CK, cgp.z + dist); camera.position.lerp(u3, camK);
        u3.set(cgp.x, 2.25 * CK, cgp.z + 0.3 * CK); v1.lerp(u3, camK);
      }
      camera.lookAt(v1);

      /* entorno y luces (la misma luz de la etapa 1 pasa de forma continua al plano completo) */
      env.visible = envA > 0.01; envMats.forEach(function (m) { m.opacity = envA; });
      heroKey.intensity = lerp(HEROL.key, LIGHT.key, envA); heroFill.intensity = lerp(HEROL.fill, LIGHT.fill, envA); ambient.intensity = lerp(HEROL.amb, LIGHT.amb, envA);
      charMat.emissiveIntensity = LIGHT.emi;
      scenery.update(t, 0);
      if (mod.frame) mod.frame(info);
      if (miniCtx && mod.screenCanvas && now - miniAt > 110) { miniAt = now; miniCtx.drawImage(mod.screenCanvas, 0, 0, 128, 274); }
      // Imported arms already drive the prop anchor; do not move the body after attachment.

      if (!story) { if (AS && bye.hidden && !shown.card) antennaHud(AS); else { if (antKey) { antKey = ""; walkHud.removeAttribute("data-t"); } walkHudFrame(wt); } }   // con historia, la nube, el globo y el indicador los maneja storyFrame; en la escena de la antena, antennaHud
      musicFrame();
      if (!P.on && !P.released && stage === "close" && t >= c0 + PHOLD - 0.0005) practiceStart();
      if (P.on) pRender();
      if (P.on && P.until) {   // modo avión: 7 s para practicar y luego sigue solo
        var left = P.until - performance.now();
        if (left <= 0) { P.until = 0; practiceRelease(); }
        else { var tmr = prac.querySelector(".pr-timer"); if (tmr) tmr.textContent = tr("Tiempo para practicar:") + " " + Math.ceil(left / 1000) + " s"; }
      }
      playerTick(now);
      if (t >= tl.card && (!G || G.n === 5)) showCard();
      if (!hot.hidden && mod.hotWorld) {
        mod.hotWorld(u3); u3.project(camera); var w = root.clientWidth, h = root.clientHeight, s = 64;
        hot.style.left = ((u3.x + 1) / 2 * w - s / 2) + "px"; hot.style.top = ((1 - u3.y) / 2 * h - s / 2) + "px"; hot.style.width = s + "px"; hot.style.height = s + "px";
      }
      footFrame(env.visible ? groundMat.opacity : 0); renderer.render(scene, camera);
    }

    /* arranque: primera vez → secuencia completa; visita repetida → plano completo con el cuadro (se puede repetir) */
    applyContext(); resize();
    if (mod.setTopic) mod.setTopic(topicId);
    syncHot();
    if (cfg.quake && (Zn.quake || Zn.nosignal)) { restart(false); startQuake(); }
    else restart(false);   /* también en visitas repetidas: siempre empieza con el objeto solo → acercamiento con la interacción → personaje (se puede saltar) */
    raf = requestAnimationFrame(frame);

    api.seek = function (s) { t = s; };
    api.tick = function (n) { /* avanza n fotogramas a mano (pruebas con la pestaña en segundo plano) */
      for (var i = 0; i < (n || 1); i++) { cancelAnimationFrame(raf); last = performance.now() - 33; frame(performance.now()); }
    };
    api.step = goStep;
    Object.defineProperties(api, {
      time: { get: function () { return t; } }, plan: { get: function () { return tl; } }, live: { get: function () { return live; } },
      context: { get: function () { return ctxId; } }, topic: { get: function () { return topicId; } }, stage: { get: function () { return info.stage; } },
      info: { get: function () { return info; } }, module: { get: function () { return mod; } }
    });
    api.stop = function () {
      alive = false; clearInterval(vzTimer); window.removeEventListener("pointerup", micEnd); window.removeEventListener("pointercancel", micEnd); window.removeEventListener("blur", micEnd); clearTimeout(P.errT); document.removeEventListener("keydown", onPracticeKey, true); if (window.FFAudio) window.FFAudio.sceneStop(); cancelAnimationFrame(raf); if (ro) ro.disconnect(); else window.removeEventListener("resize", resize);
      if (unmountTuner) unmountTuner();
      scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (mt) { if (mt.map) mt.map.dispose(); mt.dispose(); }); } });
      if (character) character.dispose();
      renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {}
      root.innerHTML = ""; root.classList.remove("seq-on", "seq-flatmode");
    };
    api.setTopic = swapTopic; api.setLight = setLight; api.setAirplane = setAirplane; api.nav = NAV; api.interacting = function () { return !!pick || P.on || !!(tl && topic().walk && t >= tl.c1 && t < tl.card) || (hasStory() && (ST.phase === "compose" || ST.phase === "walk")); };   // durante la práctica y la caminata, deslizar o la rueda no cambian de tema
    api.quake = function () { return qState; }; api.endQuake = endQuake;
    start.current = api;
    return api;
  }

  return { start: start, modules: modules, get current() { return start.current; } };
})();

