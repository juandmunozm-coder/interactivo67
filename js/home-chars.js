/* Portada: Mateo (izquierda) y Valeria (derecha) como modelos 3D (los mismos de js/characters-3d.js), saludando con la mano. Son la única
   representación de los personajes en la portada: no hay imágenes planas de respaldo. Cada personaje tiene su propio lienzo transparente; solo se
   dibuja mientras la portada está visible, y el lienzo se mantiene oculto hasta su primer dibujo con el tamaño correcto.
   El tamaño del lienzo se comprueba en cada fotograma: si el modelo terminó de cargar mientras la portada estaba oculta (otra sección), el lienzo
   medía 0 y quedaba en 1×1 píxel —un rectángulo oscuro al volver—; ahora toma su tamaño real en cuanto la portada se muestra.
   Con «reducir movimiento» saludan con la mano quieta, levantada.
   «Elige una zona»: los mismos personajes 3D (con el mismo saludo y los mismos ojos) van dentro de cada tarjeta, en lugar de la imagen plana.
   Esa imagen (.zc-char) queda como respaldo: se oculta solo cuando el personaje 3D ya se dibujó (clase .has-3d en la tarjeta). Como la vista
   de zonas se vuelve a generar cada vez que se muestra, en cada fotograma se comprueba que el lienzo siga dentro de su tarjeta. */
(function () {
  "use strict";
  if (!window.THREE || !window.FFCharacters) return;
  var view = document.getElementById("view-home"); if (!view) return;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* inner: el brazo que queda hacia el centro de la página (para presentar «Comenzar»); look: hacia dónde queda el centro, visto desde cada personaje;
     delay: el saludo de Valeria empieza un poco después que el de Mateo, para que no se vean como copias */
  var slots = [{ zone: "rural", view: "home", side: "left", phase: 0, eye: 1, inner: "left", look: [2.6, 2.5, 4.5], delay: .3 },
    { zone: "urbano", view: "home", side: "right", phase: 1.3, eye: 1.13, wave: "left", inner: "right", look: [-2.6, 2.5, 4.5], delay: 1.1 },
    { zone: "rural", view: "zones", phase: 0.6, eye: 1, delay: .3 }, { zone: "urbano", view: "zones", phase: 1.9, eye: 1.13, wave: "left", delay: .9 }], running = false, t0 = performance.now();

  slots.forEach(function (s) {
    var canvas = document.createElement("canvas"); canvas.className = s.view === "home" ? "home-char3d " + s.side : "zc-3d"; canvas.setAttribute("aria-hidden", "true");
    canvas.style.visibility = "hidden";   // se muestra con su primer dibujo correcto (ver frame)
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true }); if (!renderer.getContext()) throw 0; } catch (e) { return; }
    /* si el navegador retira el contexto WebGL (demasiados lienzos 3D en la página), se permite restaurarlo y se vuelve a dibujar al recuperarlo */
    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); s.lost = true; });
    canvas.addEventListener("webglcontextrestored", function () { s.lost = false; s.w = s.h = 0; tick(); });
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.setClearColor(0x000000, 0); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 0.7, 0.1, 50);
    scene.add(new THREE.AmbientLight(0x8fa0cc, 0.35));
    var key = new THREE.DirectionalLight(0xffe2b0, 1.15); key.position.set(3, 5, 6); scene.add(key);
    scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x2a2230, 0.8));
    var group = new THREE.Group(); scene.add(group);   // de frente: el modelo mira hacia +z, igual que la cámara de su lienzo (cuerpo y cabeza alineados)
    /* sombra de contacto bajo los pies: una mancha suave en el suelo, para que se vean apoyados (no flotando) */
    var shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1.15, .6, 1); shadow.position.y = .01; scene.add(shadow);
    if (s.look) s.lookV = new THREE.Vector3(s.look[0], s.look[1], s.look[2]);
    s.canvas = canvas; s.renderer = renderer; s.scene = scene; s.camera = camera; s.group = group;
    if (s.view === "home") view.insertBefore(canvas, view.querySelector(".home-ground"));   // en las tarjetas de zona se coloca en frame (mount)
    FFCharacters.load(s.zone, group).then(function (api) {
      s.api = api; api.waveSide = s.wave || "right"; api.autoBlink = false;   /* la portada tiene su propio parpadeo (ojos felices) */
      if (s.inner) api.gestureSide = s.inner;
      s.eyes = happyEyes(api.root, s.eye); s.nextBlink = 1.5 + Math.random() * 3; s.blinkAt = -9; s.w = s.h = 0; tick();
    }).catch(function (err) { console.error("Personaje 3D (" + s.view + ", " + s.zone + "):", err); canvas.remove(); s.failed = true; });
  });

  /* Solo en la portada: ojos felices de bienvenida. Se ocultan los ojos originales (en Valeria la malla del ojo incluye la línea del párpado)
     y en su lugar va medio círculo negro con el lado recto abajo, como un ojo sonriente, del mismo tamaño y en el mismo sitio, pegado a la cara. */
  var EYE_MAT = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }), Z = new THREE.Vector3(0, 0, 1);
  function happyEyes(root, size) {
    root.updateWorldMatrix(true, true);   // incluye el giro del grupo, para que los ojos nuevos queden donde estaban los originales
    var head = null, eyes = [];
    root.traverse(function (o) { if (/Cabeza$/i.test(o.name)) head = o; if (o.isMesh && /(^|_)Ojo_/i.test(o.name)) eyes.push(o); });
    var domes = []; if (!head || !eyes.length) return domes;
    var hc = new THREE.Box3().setFromObject(head).getCenter(new THREE.Vector3());
    eyes.forEach(function (eye) {
      var c = eyeCenter(eye), n = eyeNormal(eye, c, hc), r = 0.11 * (size || 1);   // en Valeria, un poco más grandes
      var dome = new THREE.Mesh(new THREE.CircleGeometry(r, 28, 0, Math.PI), EYE_MAT);
      dome.position.copy(c).addScaledVector(n, 0.03).y -= r * 0.35;   // el borde recto queda un poco por debajo del centro del ojo original
      dome.quaternion.setFromUnitVectors(Z, n);
      eye.parent.attach(dome); eye.visible = false; domes.push(dome);
    });
    return domes;
  }
  /* hacia dónde mira el ojo: el promedio de las normales de su malla (la superficie de la cara en ese punto) */
  function eyeNormal(m, c, hc) {
    var nr = m.geometry.attributes.normal, sum = new THREE.Vector3(), v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
    if (nr) for (var i = 0; i < nr.count; i++) sum.add(v.fromBufferAttribute(nr, i));
    if (!nr || sum.lengthSq() < 1e-6) return c.clone().sub(hc).normalize();
    sum.applyMatrix3(nm).normalize(); if (sum.z < 0) sum.negate(); return sum;
  }
  /* centro del ojo en el mundo: si la malla tiene varias piezas (ojo + párpado), se toma la más pequeña, que es el ojo */
  function eyeCenter(m) {
    var g = m.geometry, p = g.attributes.position, idx = g.index ? g.index.array : null, n = p.count, par = new Int32Array(n), i;
    for (i = 0; i < n; i++) par[i] = i;
    function f(a) { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; }
    function u(a, b) { a = f(a); b = f(b); if (a !== b) par[a] = b; }
    if (idx) for (i = 0; i < idx.length; i += 3) { u(idx[i], idx[i + 1]); u(idx[i], idx[i + 2]); }
    var key = {}; for (i = 0; i < n; i++) { var k = p.getX(i).toFixed(4) + "," + p.getY(i).toFixed(4) + "," + p.getZ(i).toFixed(4); if (key[k] !== undefined) u(i, key[k]); else key[k] = i; }
    var groups = {}; for (i = 0; i < n; i++) { var rt = f(i); (groups[rt] = groups[rt] || []).push(i); }
    var best = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return a.length - b.length; })[0];
    var box = new THREE.Box3(), v = new THREE.Vector3();
    best.forEach(function (j) { box.expandByPoint(v.fromBufferAttribute(p, j)); });
    return box.getCenter(new THREE.Vector3()).applyMatrix4(m.matrixWorld);
  }

  /* ajusta el lienzo y la cámara a su tamaño en pantalla; devuelve false si el lienzo aún no tiene tamaño (portada oculta) */
  function fit(s) {
    var w = s.canvas.clientWidth, h = s.canvas.clientHeight;
    if (!w || !h) return false;
    if (w === s.w && h === s.h) return true;
    s.w = w; s.h = h; s.renderer.setSize(w, h, false); s.camera.aspect = w / h;
    var tn = Math.tan(s.camera.fov * Math.PI / 360), dist = Math.max(5.1 / (2 * tn), 3.6 / (2 * tn * s.camera.aspect));   // cabe el personaje entero con el brazo levantado
    s.camera.position.set(0, 2.35, dist); s.camera.lookAt(0, 2.3, 0); s.camera.updateProjectionMatrix();
    return true;
  }

  function shown(s) { return document.body.getAttribute("data-view") === s.view && !document.hidden; }
  function visible() { return slots.some(shown); }
  /* tarjetas de zona: coloca el lienzo dentro de su tarjeta (justo después del fondo); si la tarjeta es nueva, se oculta hasta volver a dibujarse */
  function mount(s) {
    if (s.view === "home") return true;
    var card = document.querySelector("#view-zones .zone-card." + s.zone); if (!card) return false;
    if (s.canvas.parentNode !== card) {
      var scene = card.querySelector(".zc-scene"); card.insertBefore(s.canvas, scene ? scene.nextSibling : card.firstChild);
      s.canvas.style.visibility = "hidden"; s.w = s.h = 0;
    }
    return true;
  }
  function tick() {
    if (running || !visible()) return; running = true;
    requestAnimationFrame(frame);
  }
  /* parpadeo: cada personaje por su cuenta, cada 3–6 s; el ojo (medio círculo) se aplasta hacia su borde recto en ~0,16 s y vuelve a su forma exacta */
  function blink(s, t) {
    if (!s.eyes || !s.eyes.length) return;
    if (t >= s.nextBlink) { s.blinkAt = t; s.nextBlink = t + 3 + Math.random() * 3; }
    var k = (t - s.blinkAt) / 0.16, sy = k >= 0 && k <= 1 ? 1 - 0.92 * Math.sin(Math.PI * k) : 1;
    for (var i = 0; i < s.eyes.length; i++) s.eyes[i].scale.y = sy;
  }
  function shadowTex() {
    var c = document.createElement("canvas"); c.width = c.height = 128; var x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(40,24,10,.55)"); g.addColorStop(.55, "rgba(40,24,10,.25)"); g.addColorStop(1, "rgba(40,24,10,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    var tex = new THREE.CanvasTexture(c); return tex;
  }
  /* lenguaje corporal de la portada. Los personajes están de pie sobre el suelo (ya no flotan: el cuerpo no sube ni baja). Respiran, cambian el peso
     de un pie al otro y mueven un poco la cabeza (eso lo hace js/characters-3d.js). Encima, una pequeña rutina de bienvenida que no se repite igual:
     al aparecer saludan con la mano (por turnos); después, cada 5–8 s, un gesto distinto —asentir, mirar hacia el centro (el título y «Comenzar»),
     ladear la cabeza, presentar con la mano abierta— y de vez en cuando vuelven a saludar. Al pasar el puntero (o el teclado) por «Comenzar»,
     los dos lo miran y lo señalan, y asienten. Con «reducir movimiento» saludan con la mano quieta, levantada, como antes. */
  var ACTS = ["nod", "center", "tilt", "present", "wave"], ACTS_Z = ["nod", "tilt", "wave"];
  var cta = document.getElementById("btn-start"), ctaOn = false, ctaAt = 0;
  if (cta) {
    ["pointerenter", "focus"].forEach(function (e) { cta.addEventListener(e, function () { if (!ctaOn) { ctaOn = true; ctaAt++; } }); });
    ["pointerleave", "blur"].forEach(function (e) { cta.addEventListener(e, function () { ctaOn = false; }); });
  }
  function choreo(s, t) {
    var api = s.api, home = s.view === "home", list = home ? ACTS : ACTS_Z;
    if (!s.on) { s.on = true; s.greet = t + (s.delay || 0); s.waveUntil = s.greet + 3.2; s.next = s.waveUntil + 2 + Math.random() * 2; s.k = s.view === "home" && s.zone === "urbano" ? 1 : 0; s.lookUntil = 0; }
    var wave = t >= s.greet && t < s.waveUntil;
    if (t >= s.next && !wave) {
      var a = list[s.k++ % list.length];
      if (a === "wave") { s.greet = t; s.waveUntil = t + 2.4; }                       // vuelve a saludar, un poco más corto
      else if (a === "center") { s.lookUntil = t + 3; api.gesture("nod"); }            // mira hacia el centro y asiente
      else if (a === "present") { s.lookUntil = t + 2.6; api.gesture("palm"); }        // presenta el centro con la mano abierta
      else api.gesture(a);
      s.next = t + 5 + Math.random() * 3;
    }
    var look = t < s.lookUntil;
    if (home && ctaOn) { look = true; if (s.cta !== ctaAt) { s.cta = ctaAt; api.gesture("point"); api.gesture("nod"); } }
    api.lookAt = look && s.lookV ? s.lookV : null;
    api.pose = home && ctaOn ? "focus" : "relief";
    return wave;
  }
  function frame(now) {
    if (!visible()) { running = false; slots.forEach(function (s) { s.on = false; }); return; }
    var t = (now - t0) / 1000;
    slots.forEach(function (s) {
      if (!shown(s)) s.on = false;   // al volver a la portada, saludan otra vez
      if (!s.api || s.lost || !shown(s) || !mount(s) || !fit(s)) return;
      var wave = reduce ? true : choreo(s, t);
      s.api.update(t + s.phase, "x", "none", reduce, false, 1, wave);   // farewell = saludo con la mano de afuera
      if (!reduce) blink(s, t);
      s.renderer.render(s.scene, s.camera);
      if (s.canvas.style.visibility) { s.canvas.style.visibility = ""; if (s.view === "zones") s.canvas.parentNode.classList.add("has-3d"); }   // primer dibujo correcto: ya se puede ver (y en la tarjeta se oculta la imagen plana)
    });
    requestAnimationFrame(frame);
  }
  new MutationObserver(tick).observe(document.body, { attributes: true, attributeFilter: ["data-view"] });
  document.addEventListener("visibilitychange", tick);
})();
