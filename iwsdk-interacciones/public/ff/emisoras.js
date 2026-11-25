/* EMISORAS DE LA RADIO (Free Frequency · realidad mixta). Un solo reproductor para toda la radio:
   · estática de sintonía (más fuerte cuanto más lejos está el dial de una emisora);
   · fragmentos de cada emisora, de 12 s como máximo. Cada vez que el dial ENTRA en una emisora suena un fragmento nuevo
     (nunca el mismo que sonó la última vez en esa emisora); al salir de la emisora o cambiar de emisora, el anterior se detiene
     con un fundido corto ANTES de que empiece el siguiente: nunca suenan dos fragmentos a la vez.
   · filtro de radio (paso banda) y volumen equilibrado; respeta el botón de sonido de la página (FFAudio.enabled()).
   Para agregar o reemplazar audios: assets/audio/emisoras/LEEME.txt y la lista STATIONS de abajo. */
window.FFRadio = (function () {
  "use strict";
  var MAX = 12, CAPTURE = 9;   // MAX: segundos de cada fragmento · CAPTURE: distancia del dial a la que empieza a oírse una emisora
  var DIR = "assets/audio/emisoras/";
  var STATIONS = [
    /* la música que ya tenía el proyecto: un tramo de 12 s distinto cada vez */
    { id: "musica", band: "FM", pos: 22, kind: "music", name: "Música · «Si tu amor no vuelve»", msg: "Suena música de la vereda.", files: ["assets/audio/radio-cancion.mp3"], excerpt: true, vol: 0.8 },
    /* noticias: locuciones SIMULADAS (no son Noticias RCN; ver LEEME.txt) */
    { id: "noticias", band: "FM", pos: 52, kind: "news", name: "Noticias · locución simulada", msg: "Boletín informativo de práctica.",
      files: ["noticias/noticia-01.wav", "noticias/noticia-02.wav", "noticias/noticia-03.wav", "noticias/noticia-04.wav"].map(function (f) { return DIR + f; }), vol: 1 },
    /* entretenimiento: historias de fantasmas */
    { id: "terror", band: "FM", pos: 80, kind: "terror", name: "Historias de fantasmas", msg: "Programa de entretenimiento: relatos de miedo.",
      files: ["terror/historia-01.wav", "terror/historia-02.wav", "terror/historia-03.wav", "terror/historia-04.wav"].map(function (f) { return DIR + f; }), vol: 1, drone: true },
    { id: "noticias-am", band: "AM", pos: 40, kind: "news", name: "Noticias AM · locución simulada", msg: "Boletín informativo de práctica.",
      files: ["noticias/noticia-01.wav", "noticias/noticia-02.wav", "noticias/noticia-03.wav", "noticias/noticia-04.wav"].map(function (f) { return DIR + f; }), vol: 1 }
  ];
  var ctx = null, master, bus, staticG, noiseSrc, bufs = {}, cur = null, tuned = null, last = {}, songEl = null, songNode = null;

  function enabled() { return !window.FFAudio || window.FFAudio.enabled(); }
  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = enabled() ? 0.9 : 0; master.connect(ctx.destination);
    /* sonido de radio: corta graves y agudos, con un compresor suave para que todo suene parejo en los parlantes del visor */
    var hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), comp = ctx.createDynamicsCompressor();
    hp.type = "highpass"; hp.frequency.value = 180; lp.type = "lowpass"; lp.frequency.value = 5200;
    comp.threshold.value = -18; comp.ratio.value = 3; bus = ctx.createGain(); bus.gain.value = 1;
    bus.connect(hp); hp.connect(lp); lp.connect(comp); comp.connect(master);
    /* estática: ruido filtrado en bucle */
    var len = ctx.sampleRate * 2, nb = ctx.createBuffer(1, len, ctx.sampleRate), d = nb.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseSrc = ctx.createBufferSource(); noiseSrc.buffer = nb; noiseSrc.loop = true;
    var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2200; bp.Q.value = 0.7;
    staticG = ctx.createGain(); staticG.gain.value = 0; noiseSrc.connect(bp); bp.connect(staticG); staticG.connect(bus); noiseSrc.start();
    if (window.FFAudio && window.FFAudio.onChange) window.FFAudio.onChange(function (on) { if (master) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.05); });
    STATIONS.forEach(function (s) { if (!s.excerpt) s.files.forEach(load); });   // las locuciones son pequeñas: se cargan de una vez
    return ctx;
  }
  function unlock() { var c = ensure(); if (c && c.state !== "running") c.resume().catch(function () {}); }
  function load(url) {
    if (!bufs[url]) bufs[url] = fetch(encodeURI(url)).then(function (r) { if (!r.ok) throw new Error(url); return r.arrayBuffer(); })
      .then(function (a) { return new Promise(function (ok, ko) { ctx.decodeAudioData(a, ok, ko); }); })
      .catch(function (e) { console.error("Emisora:", e); delete bufs[url]; return null; });
    return bufs[url];
  }
  function nearest(band, pos) {
    var best = null, bd = 1e9;
    STATIONS.forEach(function (s) { if (s.band !== band) return; var d = Math.abs(s.pos - pos); if (d < bd) { bd = d; best = s; } });
    return { st: best, d: bd, clarity: best ? Math.max(0, 1 - bd / CAPTURE) : 0 };
  }
  /* detener el fragmento que suena (fundido de 0,15 s) */
  function stopCur() {
    if (!cur) return;
    var c = cur; cur = null; clearTimeout(c.timer);
    try { c.g.gain.cancelScheduledValues(ctx.currentTime); c.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); } catch (e) {}
    setTimeout(function () {
      try { if (c.src) c.src.stop(); } catch (e) {}
      try { if (c.el) c.el.pause(); } catch (e) {}
      try { if (c.drone) c.drone.forEach(function (o) { o.stop(); }); } catch (e) {}
      try { c.g.disconnect(); } catch (e) {}
    }, 220);
  }
  function pick(st) {
    var n = st.files.length, i = Math.floor(Math.random() * n);
    if (n > 1 && i === last[st.id]) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;   // nunca el mismo de la última vez
    last[st.id] = i; return st.files[i];
  }
  function play(st) {
    stopCur(); if (!ctx) return;
    var g = ctx.createGain(), t = ctx.currentTime, me = { st: st, g: g, at: t, k: 1 };
    g.gain.value = 0; g.connect(bus); cur = me;
    var level = st.vol || 1;
    if (st.excerpt) {
      /* música: un elemento <audio> (no se decodifica la canción completa en memoria); tramo de 12 s desde un punto al azar */
      if (!songEl) { songEl = new Audio(); songEl.src = st.files[0]; songEl.preload = "auto"; songNode = ctx.createMediaElementSource(songEl); }
      try { songNode.disconnect(); } catch (e) {}
      songNode.connect(g); me.el = songEl;
      var startAt = function () {
        if (cur !== me) return;
        var dur = isFinite(songEl.duration) ? songEl.duration : 60, off = Math.max(0, Math.random() * Math.max(1, dur - MAX - 2));
        last[st.id] = off; try { songEl.currentTime = off; } catch (e) {}
        var p = songEl.play(); if (p && p.catch) p.catch(function () {});
        g.gain.setTargetAtTime(level * me.k, ctx.currentTime, 0.12);
      };
      if (songEl.readyState >= 1) startAt(); else songEl.addEventListener("loadedmetadata", startAt, { once: true });
    } else {
      load(pick(st)).then(function (buf) {
        if (cur !== me || !buf) return;
        var src = ctx.createBufferSource(); src.buffer = buf; src.connect(g); me.src = src;
        src.start(0, 0, Math.min(buf.duration, MAX));
        src.onended = function () { if (cur === me) { cur = null; try { g.disconnect(); } catch (e) {} } };
        g.gain.setTargetAtTime(level * me.k, ctx.currentTime, 0.08);
      });
      if (st.drone) {   /* ambiente de las historias: un zumbido grave y suave, solo mientras dura el relato */
        me.drone = [];
        [[55, 0.035], [82.4, 0.02]].forEach(function (f) { var o = ctx.createOscillator(), og = ctx.createGain(); o.type = "sine"; o.frequency.value = f[0]; o.detune.value = Math.random() * 12; og.gain.value = f[1]; o.connect(og); og.connect(g); o.start(); me.drone.push(o); });
      }
    }
    me.timer = setTimeout(function () { if (cur === me) stopCur(); }, MAX * 1000);   // corte duro a los 12 s
  }
  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  /* update: se llama cada vez que cambia el estado del sintonizador ({ on, band, pos }) */
  function update(s) {
    if (!ensure()) return null;
    var n = nearest(s.band, s.pos), c = s.on ? n.clarity : 0, t = ctx.currentTime;
    staticG.gain.setTargetAtTime(s.on ? (cur ? 0.035 : 0.12) * (1 - c) + 0.008 : 0, t, 0.06);
    if (!s.on) { tuned = null; stopCur(); return null; }
    if (c >= 0.75) {
      if (!tuned || tuned !== n.st.id) { tuned = n.st.id; play(n.st); }   // entró a una emisora: fragmento nuevo
    } else if (tuned && c < 0.6) { tuned = null; stopCur(); }             // salió de la emisora
    if (cur) { cur.k = smooth((c - 0.3) / 0.7); cur.g.gain.setTargetAtTime((cur.st.vol || 1) * cur.k, t, 0.1); }
    return c >= 0.75 ? n.st : null;
  }
  function stop() { tuned = null; stopCur(); if (staticG) staticG.gain.setTargetAtTime(0, ctx.currentTime, 0.05); }
  function info() { return { tuned: tuned, playing: cur ? cur.st.id : null, state: ctx ? ctx.state : "none", last: Object.assign({}, last) }; }
  if (typeof document !== "undefined") document.addEventListener("pointerdown", unlock, true);
  return { STATIONS: STATIONS, MAX: MAX, CAPTURE: CAPTURE, update: update, stop: stop, unlock: unlock, nearest: nearest, info: info };
})();
