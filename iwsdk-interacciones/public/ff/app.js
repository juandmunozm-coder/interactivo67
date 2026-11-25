/* Free Frequency · REALIDAD MIXTA para Meta Quest 3 (IWSDK, ver src/shim.js y src/main.js).
   Recorrido (solo zona rural, Cauca, con Mateo; solo radio y linterna):
     Pantalla inicial (index.html) → «Entrar en realidad aumentada (AR)» → escaneo y pellizco sobre una mesa (src/main.js)
     → aparece el diorama del Cauca con Mateo, la radio a un lado y la linterna al otro
     → Mateo se presenta (tres diálogos) → el usuario acerca la mano a un objeto y lo pellizca para elegirlo
     → Mateo presenta la actividad → el usuario agarra el objeto con su mano:
        · RADIO (recibir información): encender con una perilla, girar la otra de AM a FM hasta la emisora → éxito, música → «Continuar con la linterna».
        · LINTERNA (transmitir información): 1) destellos corto y largo (animación) 2) agarrarla, encender y apagar 3) SOS · · · — — — · · ·
          con ayuda de Mateo si hay errores → felicitación → «Terminar práctica».
     → cierre: Mateo agradece, los dos aprendizajes y «Cuando la señal se apaga, la comunicación no».
   Reutiliza los archivos originales del proyecto: js/data.js (textos del sintonizador), js/characters-3d.js (Mateo y su lenguaje corporal),
   js/scenery.js (el escenario de Blender del Cauca con su toon shader), js/toon-shader.js, js/audio.js y js/tuner.js (sonidos, música y sintonizador).
   En el computador (vista previa de desarrollo) todo se puede recorrer con el ratón. Nada es real: no se envían mensajes. */
(function () {
  "use strict";
  var UI = window.VRUI, C = UI.C, FF = window.FF, AU = window.FFAudio, TU = window.FFTuner;
  var V3 = THREE.Vector3;
  var sceneEl, root, camEl, lobbyEl, worldEl;
  var tmpV = new V3(), tmpV2 = new V3(), tmpV3 = new V3(), tmpQ = new THREE.Quaternion();
  if (FF.zones) delete FF.zones.urbano;   // la zona urbana no hace parte de esta experiencia
  /* emisoras del dial: las de ff/emisoras.js (música, noticias simuladas e historias de fantasmas); la radio empieza en FM, sin emisora */
  if (window.FFRadio) {
    FF.tuner.bands = { AM: [], FM: [] }; window.FFRadio.STATIONS.forEach(function (s) { FF.tuner.bands[s.band].push(s); });
    FF.tuner.start = { on: false, band: "FM", pos: 8 };
  }
  var ORDER = ["radio", "linterna"];
  var JT = new V3(), JI = new V3(), JA = new V3(), JB = new V3();   // articulaciones de los dedos (FFX.hands.joint)
  var YUP = new V3(0, 1, 0);

  /* ---------- MEDIDAS SOBRE LA MESA (metros reales; y = 0 es la superficie, −Z se aleja del usuario, +Z va hacia él) ----------
     · Mateo (22 cm) de pie en el borde delantero del diorama, entre los dos objetos.
     · Radio y linterna sobre sus bases, delante de Mateo: la radio a la izquierda (vista del usuario) y la linterna a la derecha.
     · Diorama del Cauca detrás de Mateo: el escenario de Blender completo (pasto, camino de tierra, casas, árboles frutales y montañas)
       a escala de maqueta (DIO.s metros por metro del modelo) sobre una base de tierra de 1,2 cm: nada flota, todo se apoya en la mesa. */
  /* ESCALA PROPORCIONAL: Mateo y el escenario usan la MISMA escala (DIO.s metros por metro del modelo de Blender), igual que en la página web:
     Mateo queda en su punto original del escenario (el origen del modelo, delante del camino de tierra), con las casas y los árboles a su
     tamaño real respecto de él. Con DIO.s = 0,021 Mateo mide unos 6 cm y el diorama unos 71 × 73 cm. */
  var DIO = { s: 0.021, base: 0.012, zM: -0.08 };   // zM: dónde queda Mateo (y el origen del escenario) en la mesa
  var CHAR_H = 4.4 * 0.66 * DIO.s, MATEO = { x: 0, z: DIO.zM };   // 4,4 unidades × charScale del Cauca (js/scenery.js)
  /* la radio y la linterna van sobre sus bases en la mesa, delante del diorama (su borde delantero está en zM + 5,9 × DIO.s);
     para cambiarlas de lado, intercambia las x */
  /* RADIO Y LINTERNA A LA ESCALA DE MATEO: las mismas medidas que tienen cuando Mateo los sostiene en la página original
     (radio: ancho = 0,27 × alto de Mateo / 1,5; linterna: largo = 0,22 × alto / 1,5), sobre bases pequeñas en el pasto, a cada lado de él
     (la radio a su izquierda vista desde el usuario). Al agarrarlos crecen hasta el tamaño de la mano y al soltarlos vuelven a su sitio (ver GROW). */
  var MINI = { radio: 0.27 * CHAR_H / 1.5, torch: 0.22 * CHAR_H / 1.5 }, PS = 0.075;   // PS: escala de las bases (la base mide unos 2,5 cm)
  var SLOT = { radio: [MATEO.x - 0.028, MATEO.z + 0.012], linterna: [MATEO.x + 0.028, MATEO.z + 0.012] };
  var BUBBLE_Y = 0.12;   // el globo de Mateo, a la altura de los techos (unos 5 cm sobre su cabeza)
  /* botón de la linterna: bajo la yema de este dedo (pulgar, como pide el guion; «index-finger-tip» lo pone bajo el índice) */
  var TORCH_FINGER = "thumb-tip";

  /* ---------- LUZ DE LA LINTERNA EN EL TOON SHADER ----------
     El toon shader del proyecto (js/toon-shader.js) usa una luz fija y no recibe las luces de la escena: una SpotLight no iluminaría el
     escenario, la radio ni la linterna. Aquí se le suma la luz de la linterna (posición, dirección y apertura en el mundo): un cono suave
     con caída por distancia, sin cambiar los escalones ni el contorno del shader. Mateo y las bases usan materiales toon de Three.js,
     que sí reciben la SpotLight de la linterna. */
  var TORCH_U = { uTorchPos: { value: new THREE.Vector3() }, uTorchDir: { value: new THREE.Vector3(0, -1, 0) }, uTorchK: { value: 0 }, uTorchCos: { value: Math.cos(0.62) } };
  var TORCH_GLSL = [
    "  if ( uTorchK > 0.001 ) {",
    "    vec3 ftL = uTorchPos - vFFWorld; float ftD = max( length( ftL ), 1e-4 );",
    "    float ftCone = smoothstep( uTorchCos, mix( uTorchCos, 1.0, 0.6 ), dot( -ftL / ftD, uTorchDir ) );",
    "    float ftAtt = 1.0 / ( 1.0 + ftD * ftD * 5.0 );",
    "    ffColor += ( diffuseColor.rgb * 1.5 + vec3( 0.18, 0.15, 0.07 ) ) * uTorchK * ftCone * ftAtt;",
    "  }", ""].join("\n");
  /* ---------- compatibilidad: el toon shader se escribió para Three.js r149 (el fragmento ahora se llama «opaque_fragment») ---------- */
  (function () {
    var T = window.FFToon; if (!T) return;
    ["apply", "soft"].forEach(function (k) {
      var f = T[k];
      T[k] = function (m, o) {
        if (!m || m.userData.ffToonVR) return m;
        f(m, o); var ob = m.onBeforeCompile; m.userData.ffToonVR = true;
        m.onBeforeCompile = function (sh, r) {
          sh.fragmentShader = sh.fragmentShader.replace("#include <opaque_fragment>", "#include <output_fragment>");
          ob(sh, r);
          sh.fragmentShader = sh.fragmentShader.replace("#include <output_fragment>", "#include <opaque_fragment>");
          /* luz de la linterna (ver TORCH_U) */
          Object.keys(TORCH_U).forEach(function (u) { sh.uniforms[u] = TORCH_U[u]; });
          sh.vertexShader = "varying vec3 vFFWorld;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n  vFFWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;");
          sh.fragmentShader = "uniform vec3 uTorchPos;\nuniform vec3 uTorchDir;\nuniform float uTorchK;\nuniform float uTorchCos;\nvarying vec3 vFFWorld;\n" +
            sh.fragmentShader.replace("outgoingLight = ffColor + totalEmissiveRadiance;", TORCH_GLSL + "  outgoingLight = ffColor + totalEmissiveRadiance;");
        };
        return m;
      };
    });
  })();

  /* ---------- materiales (los mismos de js/hub.js) ---------- */
  var ramp = null;
  function toon(color, extra) {
    if (!ramp) { ramp = new THREE.DataTexture(new Uint8Array([105, 175, 255]), 3, 1, THREE.RedFormat); ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true; }
    var m = new THREE.MeshToonMaterial(Object.assign({ color: color, gradientMap: ramp }, extra || {}));
    m.userData.base = new THREE.Color(color); return m;
  }
  function otoon(color, extra) { var m = toon(color, extra); return window.FFToon ? window.FFToon.apply(m) : m; }
  function basic(color, extra) { var m = new THREE.MeshBasicMaterial(Object.assign({ color: color }, extra || {})); m.userData.base = new THREE.Color(color); return m; }
  function canvasTex(w, h, draw) { var c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  function radial(stops) { return canvasTex(128, 128, function (x, w, h) { var g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); stops.forEach(function (s) { g.addColorStop(s[0], s[1]); }); x.fillStyle = g; x.fillRect(0, 0, w, h); }); }
  var SHADOW_TEX = null, HALO_TEX = null;
  function contactShadow(r) {
    if (!SHADOW_TEX) SHADOW_TEX = radial([[0, "rgba(20,24,16,.6)"], [0.55, "rgba(20,24,16,.3)"], [1, "rgba(20,24,16,0)"]]);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 1.2), new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.006; m.renderOrder = 1; return m;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- objetos de Blender (assets/models/objetos) con el toon shader ---------- */
  var OBJ = { radio: { file: "assets/models/objetos/Radio.glb", ref: /^Cuerpo_Radio/ }, torch: { file: "assets/models/objetos/Linterna.glb" } };
  var glb = {};
  function loadGLB(file) {
    if (!glb[file]) glb[file] = new Promise(function (ok, ko) { new THREE.GLTFLoader().load(encodeURI(file), function (g) { ok(g.scene); }, undefined, ko); });
    return glb[file];
  }
  function kindFor(item) { return item === "linterna" ? "torch" : "radio"; }
  /* size: metros (alto de la linterna; ancho del cuerpo de la radio). Devuelve un grupo con la base en y = 0. Los materiales se comparten. */
  var objMats = new Map();
  function makeObject(kind, size) {
    var spec = OBJ[kind];
    return loadGLB(spec.file).then(function (src) {
      var o = src.clone(true);
      o.traverse(function (n) {
        if (!n.isMesh) return; var s = n.material;
        if (!objMats.has(s.uuid)) { var m = otoon(0xffffff, { side: s.side }); m.name = s.name; m.color.copy(s.color); m.userData.base.copy(m.color); if (s.map) m.map = s.map; objMats.set(s.uuid, m); }
        n.material = objMats.get(s.uuid);
      });
      o.updateMatrixWorld(true);
      var ref = new THREE.Box3(); if (spec.ref) o.traverse(function (n) { if (n.isMesh && spec.ref.test(n.name)) ref.expandByObject(n); });
      var sz = (ref.isEmpty() ? new THREE.Box3().setFromObject(o) : ref).getSize(new V3());
      o.scale.setScalar(kind === "radio" ? size / sz.x : size / sz.y); o.updateMatrixWorld(true);
      var box = new THREE.Box3().setFromObject(o), c = box.getCenter(new V3());
      o.position.set(-c.x, -box.min.y, -c.z);
      var g = new THREE.Group(); g.add(o); g.updateMatrixWorld(true);
      var b2 = new THREE.Box3().setFromObject(g); g.userData = { box: b2, size: b2.getSize(new V3()), kind: kind };
      return g;
    });
  }

  /* ---------- Mateo: el modelo y el lenguaje corporal de js/characters-3d.js ---------- */
  function Char(zone, parent, scale) {
    var self = this; this.zone = zone; this.g = new THREE.Group(); this.g.scale.setScalar(scale); parent.add(this.g);
    this.kind = "none"; this.topic = "x"; this.farewell = false; this.look = null; this.fear = 0;
    this.g.add(contactShadow(1.1));
    window.FFCharacters.load(zone, this.g).then(function (api) { self.api = api; if (self.onReady) self.onReady(api); })
      .catch(function (e) { console.error("Personaje 3D:", e); });
  }
  Char.prototype.update = function (t) {
    var a = this.api; if (!a) return;
    a.lookAt = this.look; a.fear = 0;
    a.update(t, this.topic, this.kind, false, !!a.talking, 1, this.farewell);
  };
  Char.prototype.say = function (text, ms) {
    var a = this.api, self = this; if (!a) return;
    a.say(text); a.talking = true; a.pose = "talk"; clearTimeout(this.sayT);
    this.sayT = setTimeout(function () { if (self.api) { self.api.talking = false; if (self.api.pose === "talk") self.api.pose = "relief"; } }, ms || Math.max(1800, text.length * 65));
  };

  /* ---------- estado ---------- */
  var S = { view: null, zone: null, item: null, phase: null, token: 0, done: { radio: false, linterna: false }, hover: null, hoverSrc: null, grabbed: false, arStarted: false };
  function later(ms, fn) { var tk = S.token; return setTimeout(function () { if (tk === S.token) fn(); }, ms); }
  var P = {}, PR = {};

  /* =====================================================================================
     MUNDO: diorama del Cauca + Mateo + bases con la radio y la linterna
     ===================================================================================== */
  var W = { zone: null };
  function buildWorld(zone) {
    if (W.zone === zone) return;
    W = { zone: zone, heldEl: W.heldEl, heldBox: W.heldBox, spot: W.spot, beam: W.beam };
    var wo = worldEl.object3D;
    /* diorama: base de tierra + el escenario de Blender a escala de maqueta (fitDiorama lo encaja sobre la base) */
    var dio = W.dio = new THREE.Group(); dio.position.set(MATEO.x, DIO.base, MATEO.z); wo.add(dio);
    /* base: el pasto recortado (x −17,6…16, z −29…5,9 en metros del modelo; ver fitDiorama) */
    var bw = 33.6 * DIO.s + 0.012, bd = 34.9 * DIO.s + 0.012, bx = -0.8 * DIO.s, bz = -11.55 * DIO.s;
    /* base de tierra: su cara de arriba queda 2 mm por debajo del pasto (si coinciden, la tierra tapa el pasto) */
    var base = new THREE.Mesh(new THREE.BoxGeometry(bw, DIO.base - 0.002, bd), toon(0x6b4c30)); base.position.set(bx, -DIO.base / 2 - 0.001, bz); dio.add(base);
    var lip = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.004, 0.004), toon(0xf5b335)); lip.position.set(bx, -0.004, bz + bd / 2); dio.add(lip);   // filo amarillo (la señal de la página)
    var env = W.env = new THREE.Group(); env.scale.setScalar(DIO.s); dio.add(env);
    P.loading.show(true);
    W.scenery = window.FFScenery.build({ THREE: THREE, M: { toon: toon, canvasTex: canvasTex }, env: env, envMat: function (m) { return m; }, V: function (x, y, z) { return new V3(x, y, z); },
      bg: new THREE.Object3D(), ground: new THREE.Object3D(), camera: camEl.getObject3D("camera"), cityTrees: false,
      status: function (s) { if (W.zone !== zone) return; if (s !== "loading") P.loading.show(false); if (s === "ready") fitDiorama(env); } }, zone);
    /* cielo del escenario (solo en la vista previa del computador; en realidad mixta se ve el cuarto real) */
    var st = W.scenery.sky; st.colorSpace = THREE.SRGBColorSpace; st.repeat.set(1, 2); st.offset.set(0, -1); st.needsUpdate = true;
    W.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.MeshBasicMaterial({ map: st, side: THREE.BackSide, fog: false, depthWrite: false }));
    W.sky.renderOrder = -10; wo.add(W.sky);
    /* Mateo: a la misma escala del escenario (k = DIO.s), de pie sobre el pasto en su punto del modelo */
    var CK = W.scenery.charScale || 1, k = DIO.s;
    var stage = W.stage = new THREE.Group(); stage.scale.setScalar(k); stage.position.set(MATEO.x, DIO.base, MATEO.z); wo.add(stage); W.k = k;
    var cg = new THREE.Group(); cg.scale.setScalar(CK); stage.add(cg); W.cg = cg;
    W.char = new Char(zone, cg, 1);
    W.char.onReady = function (api) { api.pose = "relief"; };
    W.walk = { yaw: 0 };
    W.extra = new THREE.Group(); wo.add(W.extra);
    buildPodium(zone);
  }
  /* el escenario de Blender del Cauca (unos 39 × 39 m de pasto y montañas de hasta 150 m) convertido en maqueta para la mesa, sin cambiar sus modelos
     ni sus materiales: se ocultan el potrero hasta el horizonte y las nubes (flotarían), el pasto termina en el borde de la base y las cuatro capas
     de montañas se juntan en una franja al fondo del diorama (más angostas y algo más bajas), conservando su forma por capas. */
  function fitDiorama(env) {
    var group = env.children[0]; if (!group) return;
    var holder = null;
    group.children.slice().forEach(function (c) {
      if (c.isMesh && c.scale.x > 100) c.visible = false;                 // potrero lejano hasta el horizonte
      else if (!c.isMesh && c.position.y > 8) c.visible = false;          // nubes
      else if (!holder && c.children.length === 1 && Math.abs(Math.abs(c.rotation.y) - Math.PI) < 0.01) holder = c;
    });
    if (!holder) return;
    env.updateMatrixWorld(true);
    var vereda = holder.children[0], mts = [];
    vereda.children.forEach(function (n) { if (/^Monta/.test(n.name || "")) mts.push(n); });
    var band = new THREE.Group(); band.name = "Montañas_Maqueta"; band.position.set(1.8, 0, -18.3); group.add(band); band.updateMatrixWorld(true);
    mts.forEach(function (n) { band.attach(n); });
    var sx = 0.215, sy = 0.32; band.scale.set(sx, sy, 0.0845); band.position.set(-0.8, 1.6 * sy, -23);   // x: −76…80 → −17,6…16 · z: −89…−18 → −29…−23
    var plano = vereda.getObjectByName("Plano");
    /* el pasto se recorta a la base: x −17,6…16 (a la derecha del guayabo solo había pasto) y z −29…5,9 (las montañas tapan el fondo) */
    if (plano) { var pg = new THREE.Group(); pg.position.set(-17.6, 0, 5.9); group.add(pg); pg.updateMatrixWorld(true); pg.attach(plano); pg.scale.set(33.6 / 38.8, 1, 34.9 / 38.8); }
  }

  /* ---------- bases de la radio y la linterna: pequeñas, sobre el pasto del diorama a cada lado de Mateo ---------- */
  var HUB = { accent: { radio: 0xa64630, linterna: 0x5f5a92 },
    name: { radio: "Radio", linterna: "Linterna" }, verb: { radio: "Recibir información", linterna: "Transmitir información" } };
  var PED_TOP = 0.036 * PS;
  function buildPodium(zone) {
    W.slots = {};
    if (!HALO_TEX) HALO_TEX = radial([[0, "rgba(255,255,255,1)"], [0.45, "rgba(255,255,255,.55)"], [1, "rgba(255,255,255,0)"]]);
    ORDER.forEach(function (id, i) {
      var p = SLOT[id], el = FFX.entity(); el.setAttribute("vr-hit", ""); worldEl.appendChild(el);
      el.object3D.position.set(p[0], DIO.base, p[1]);
      var box = new THREE.Group(); el.setObject3D("mesh", box);   // setObject3D: así el rayo lo encuentra
      var pz = new THREE.Group(); pz.scale.setScalar(PS); box.add(pz);   // la base, a escala de Mateo
      pz.add(contactShadow(0.2));
      var pedM = toon(HUB.accent[id]), ped = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.168, 0.03, 32), pedM); ped.position.y = 0.015; pz.add(ped);
      var pt = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.132, 0.006, 32), toon(0xf6ecd6)); pt.position.y = 0.033; pz.add(pt);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.144, 0.01, 6, 40), basic(0xf5b335, { transparent: true, opacity: 0.35 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.036; pz.add(ring);
      /* resplandor de la base: se enciende al acercar la mano y queda suave mientras el objeto es el elegido (más ancho que la base: se nota) */
      var halo = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), new THREE.MeshBasicMaterial({ map: HALO_TEX, color: 0xffc552, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.rotation.x = -Math.PI / 2; halo.position.y = 0.037; halo.renderOrder = 2; pz.add(halo);
      /* zona para tocar o apuntar: algo más grande que el objeto (que mide ~1 cm), para que sea fácil elegirlo */
      var hit = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.035, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hit.position.y = 0.0175; box.add(hit);
      var holder = new THREE.Group(); holder.position.y = PED_TOP; box.add(holder);
      tagEl(box, el);
      var kind = kindFor(id);
      var slot = W.slots[id] = { id: id, el: el, holder: holder, ring: ring, halo: halo, pedM: pedM, st: { y: 0, vy: 0, rot: 0, vr: 0 }, phase: i * 1.7, show: 1, target: 1, glow: 0 };
      makeObject(kind, MINI[kind]).then(function (o) { if (W.zone !== zone) return; holder.add(o); tagEl(o, el); o.rotation.y = id === "linterna" ? 0.3 : 0; slot.obj = o; });
      /* etiqueta pequeña, corrida hacia afuera (no tapa a Mateo, que está entre los dos objetos) */
      slot.tag = new UI.Panel({ parent: el, pos: [id === "radio" ? -0.032 : 0.032, 0.012, 0.01], w: 0.07, anchor: "bottom", order: 4 });
      slot.tag.show(false);
      el.addEventListener("mouseenter", function () { setHover(id, "ray"); });
      el.addEventListener("mouseleave", function () { if (S.hoverSrc === "ray" && S.hover === id) setHover(null); });
      el.addEventListener("click", function () { slotClick(id); });
    });
  }
  /* los clics solo llegan a piezas que llevan la referencia a su entidad (.el): las que terminan de cargar después la reciben aquí */
  function tagEl(obj, el) { obj.traverse(function (c) { c.el = el; }); }
  function kick(s, k) { s.st.vy += 1.1 * k; s.st.vr += (Math.random() < 0.5 ? -1 : 1) * 6 * k; }
  function slotTop(s, out) { return s.holder.getWorldPosition(out); }
  function slotCenter(s, out) { slotTop(s, out); out.y += 0.006; return out; }
  /* qué bases se ven: las demás se encogen y desaparecen */
  function showSlots(list) {
    Object.keys(W.slots || {}).forEach(function (id) {
      var s = W.slots[id]; s.target = list.indexOf(id) >= 0 ? 1 : 0;
      if (s.target) { s.el.object3D.visible = true; s.holder.visible = true; }
    });
    UI.refresh();
  }
  function slotsUpdate(t, dt) {
    if (!W.slots) return;
    var k = Math.min(0.05, dt / 1000);
    Object.keys(W.slots).forEach(function (id) {
      var s = W.slots[id], st = s.st;
      if (!s.el.object3D.visible) return;
      s.show += (s.target - s.show) * Math.min(1, k * 8);
      s.el.object3D.scale.setScalar(Math.max(0.001, s.show));
      if (!s.target && s.show < 0.03) { s.el.object3D.visible = false; UI.refresh(); return; }
      st.vy += (-st.y * 60 - st.vy * 8) * k; st.y += st.vy * k; st.vr += (-st.rot * 50 - st.vr * 7) * k; st.rot += st.vr * k;
      s.holder.position.y = PED_TOP + Math.max(0, st.y) * 0.008;   // saltito proporcional al tamaño del objeto
      s.holder.rotation.y = (S.view === "hub" ? Math.sin(t * 0.5 + s.phase) * 0.18 : 0) + st.rot * 0.1;
      var want = S.hover === id && S.view === "hub" ? 1 : S.view === "act" && S.item === id ? 0.55 : S.view === "end" ? 0.5 : 0.12;
      s.glow += (want - s.glow) * Math.min(1, k * 6);
      var pulse = 0.85 + 0.15 * Math.sin(t * 4 + s.phase);
      s.halo.material.opacity = s.glow * 0.75 * pulse; s.halo.scale.setScalar(0.85 + s.glow * 0.25);
      s.ring.material.opacity = 0.3 + s.glow * 0.65;
      s.pedM.emissive.setHex(HUB.accent[id]).multiplyScalar(s.glow * 0.45);
    });
  }

  /* =====================================================================================
     PANELES
     ===================================================================================== */
  function buildWorldPanels() {
    P.loading = new UI.Panel({ parent: worldEl, pos: [0, 0, 0.22], rot: [-10, 0, 0], w: 0.22, anchor: "bottom", stand: true, spec: { w: 360, bg: "rgba(10,13,22,.8)", radius: 999, pad: [12, 20, 12, 20], items: [{ t: "text", size: 16, weight: 600, align: "center", color: "#fff", text: "Cargando el Cauca y a Mateo…" }] } });
    /* globo de diálogo: sobre la cabeza de Mateo, mirando al usuario (no tapa los objetos, que están más abajo y delante) */
    P.bubble = new UI.Panel({ parent: worldEl, pos: [0, BUBBLE_Y, MATEO.z], w: 0.22, anchor: "bottom", order: 3 });
    /* tarjeta de la actividad (derecha) y herramientas (izquierda), de pie sobre la mesa a los lados del diorama */
    P.seq = new UI.Panel({ parent: worldEl, pos: [0.5, 0, 0.1], rot: [-6, -32, 0], w: 0.3, anchor: "bottom", stand: true, onClick: act });
    P.tools = new UI.Panel({ parent: worldEl, pos: [-0.48, 0, 0.12], rot: [-6, 32, 0], w: 0.17, anchor: "bottom", stand: true, onClick: act });
    /* objeto en las manos del usuario: en el Quest sigue a la mano real (placeHeld); en el computador va delante de la cámara */
    var held = FFX.entity(); held.setAttribute("vr-hit", ""); worldEl.appendChild(held);
    held.noTouch = function () { return AR; };   // en AR lo sostienen las manos: tocarlo no debe activar nada por accidente
    W.heldEl = held;
    W.heldBox = new THREE.Group(); held.setObject3D("mesh", W.heldBox);
    held.addEventListener("click", function (e) { practiceObjClick(e); });
    held.addEventListener("mousedown", function () { if (PR.mode === "torch") torchPress(true); });
    held.addEventListener("mouseup", function () { if (PR.mode === "torch") torchPress(false); });
    held.addEventListener("mouseleave", function () { if (PR.mode === "torch") torchPress(false); });
    /* luz de la linterna */
    /* foco de la linterna: abierto (≈35°), bordes suaves; ilumina a Mateo, las bases y la base del diorama (materiales que reciben luces) */
    W.spot = new THREE.SpotLight(0xfff1d0, 0, 2.6, TORCH_ANGLE, 0.85, 1.1); W.spot.target.position.set(0, 0, -1);
    var lens = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: 0xfff6cf, transparent: true, opacity: 0, side: THREE.DoubleSide, fog: false }));
    var cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending }));
    W.beam = { lens: lens, cone: cone };
  }
  function hideWorldPanels() { ["bubble", "seq"].forEach(function (k) { P[k].show(false); }); }
  function bubble(text) {
    if (!text) { P.bubble.show(false); return; }
    P.bubble.set({ w: 300, bg: C.paper, radius: 18, shadow: true, tail: "left", pad: [12, 17, 12, 17], items: [
      { t: "text", size: 17, weight: 700, lh: 1.35, color: C.ink, text: text }] });
    P.bubble.show(true);
  }
  /* Mateo habla: el globo se queda hasta la siguiente frase (no desaparece mientras el usuario hace la actividad) */
  function say(text, ms) { S.coach = text; bubble(text); if (W.char) W.char.say(text, ms || Math.max(2600, text.length * 70)); }
  function seqCard(spec) { P.seq.set(Object.assign({ w: 420, bg: "rgba(251,245,230,.98)", radius: 20, shadow: true, pad: [18, 22, 20, 22] }, spec)).show(true); }
  function toolsCard() {
    var xr = FFX.immersive();
    P.tools.set({ w: 240, bg: "rgba(10,24,32,.86)", radius: 18, pad: [12, 14, 14, 14], items: [
      { t: "kicker", color: C.peach, text: "Free Frequency" },
      { t: "buttons", size: 13, gap: 6, list: [{ id: "sound", label: AU.enabled() ? "🔊 Sonido" : "🔇 Sin sonido", kind: "light" }, xr ? { id: "replace", label: "Mover a otra mesa", kind: "light" } : null] }
    ] }).show(true);
  }

  /* =====================================================================================
     MATEO: gestos y celebración
     ===================================================================================== */
  function mateoPoint(id, ms) {
    var s = W.slots && W.slots[id]; if (!s || !W.char || !W.char.api) return;
    W.pointAt = slotCenter(s, new V3()); W.pointUntil = performance.now() + (ms || 2000);
    W.char.api.gesture("point");
  }
  function mateoWave(ms) { W.waveUntil = performance.now() + (ms || 3000); }
  function celebrate() {
    var a = W.char && W.char.api; if (a) { a.mood = "happy"; a.gesture("jump"); }
    mateoWave(2600); AU.lock();
    confetti(new V3(MATEO.x, DIO.base + CHAR_H * 1.2, MATEO.z));
  }
  /* confeti sobre Mateo al completar una actividad: 48 papelitos reutilizados (sin crear objetos nuevos en cada celebración) */
  var CONF = null;
  function confetti(at) {
    if (!CONF) {
      CONF = { g: new THREE.Group(), list: [], on: false }; var geo = new THREE.PlaneGeometry(0.0025, 0.004), cols = [0xf5b335, 0x5fd08a, 0xf08a6c, 0x6fc3df, 0xffffff];   // papelitos a la escala de Mateo
      for (var i = 0; i < 48; i++) { var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: cols[i % 5], side: THREE.DoubleSide, transparent: true })); m.visible = false; CONF.g.add(m); CONF.list.push({ m: m, v: new V3(), r: new V3(), life: 0 }); }
      worldEl.object3D.add(CONF.g);
    }
    CONF.list.forEach(function (p) {
      p.m.position.copy(at).add(tmpV.set((Math.random() - 0.5) * 0.02, 0, (Math.random() - 0.5) * 0.02));
      p.v.set((Math.random() - 0.5) * 0.12, 0.12 + Math.random() * 0.12, (Math.random() - 0.5) * 0.12); p.r.set(Math.random() * 9, Math.random() * 9, 0);
      p.life = 2 + Math.random() * 1.2; p.m.visible = true; p.m.material.opacity = 1;
    });
    CONF.on = true;
  }
  function confettiUpdate(dt) {
    if (!CONF || !CONF.on) return;
    var s = Math.min(0.05, dt / 1000), any = false;
    CONF.list.forEach(function (p) {
      if (!p.m.visible) return;
      p.life -= s; p.v.y -= 0.35 * s; p.v.multiplyScalar(0.985); p.m.position.addScaledVector(p.v, s);
      if (p.m.position.y < DIO.base + 0.001) { p.m.position.y = DIO.base + 0.001; p.v.set(0, 0, 0); }   // caen sobre el pasto
      p.m.rotation.x += p.r.x * s; p.m.rotation.y += p.r.y * s; p.m.material.opacity = Math.min(1, p.life);
      if (p.life <= 0) p.m.visible = false; else any = true;
    });
    CONF.on = any;
  }

  /* =====================================================================================
     NAVEGACIÓN
     ===================================================================================== */
  function go(view) {
    S.token++; S.view = view; S.coach = null; S.held = false; S.openT = 0;
    AU.sceneStop(); if (window.FFRadio) FFRadio.stop(); torchLight(false); pressT = 0; torchDown = false;
    lobbyEl.object3D.visible = false; worldEl.object3D.visible = true;
    hideWorldPanels(); clearHeld(); clearDemo();
    W.pointUntil = 0; W.waveUntil = 0;
    if (W.char && W.char.api) { W.char.api.mood = null; W.char.api.pose = "relief"; W.char.api.talking = false; }
    PR = {};
    arApply(); toolsCard(); updateTags();
    UI.refresh();
  }
  /* realidad aumentada (passthrough): se oculta el cielo; en el computador queda el cielo y la mesa virtual de src/main.js */
  var AR = false;
  function arApply() {
    if (W.sky) W.sky.visible = !AR;
    sceneEl.removeAttribute("fog");
    if (P.tools && S.view) toolsCard();
    UI.refresh();
  }
  function enterZone() {
    S.zone = "rural"; document.body.setAttribute("data-zone", "rural");
    buildWorld("rural");
    S.done = { radio: false, linterna: false };
    hub(true);
  }

  /* =====================================================================================
     PRESENTACIÓN Y SELECCIÓN
     Mateo se presenta y pregunta; el usuario acerca la mano a un objeto (la base se ilumina, aparece su etiqueta y suena) y lo pellizca.
     ===================================================================================== */
  function hub(intro) {
    go("hub"); S.item = null; S.phase = null; S.hover = null;
    showSlots(ORDER); hubCard();
    if (intro) {
      later(700, function () { say("¡Hola, soy Mateo!", 5000); mateoWave(3500); });
      later(5700, function () { say("Y el día de hoy no tengo señal. ¿Me podrían ayudar?", 7000); if (W.char.api) W.char.api.gesture("ask"); });
      later(12700, askChoice);
    } else later(400, askChoice);
  }
  function askChoice() {
    say("¿Cuál de estas dos alternativas me ayudarán?");
    var i = 0, loop = function () { if (S.view !== "hub") return; mateoPoint(ORDER[i++ % 2], 1900); later(4200, loop); };
    later(600, loop);
  }
  function hubCard() {
    var xr = FFX.immersive();
    seqCard({ items: [
      { t: "kicker", text: "Cauca · Ayuda a Mateo" },
      { t: "h2", text: "Elige una alternativa" },
      { t: "text", size: 16, weight: 600, lh: 1.45, text: xr ? "Acerca tu mano a un objeto y pellízcalo para elegirlo." : "Haz clic en un objeto de la mesa para elegirlo.", mb: 8 },
      (S.done.radio || S.done.linterna) ? { t: "small", text: (S.done.radio ? "✓ Radio  " : "") + (S.done.linterna ? "✓ Linterna" : "") } : null
    ] });
  }
  function setHover(id, src) {
    if (S.view !== "hub") id = null;
    if (id === S.hover) return;
    S.hover = id; S.hoverSrc = id ? src : null;
    if (id) { kick(W.slots[id], 0.7); if (id === "radio") AU.band(); else AU.click(true); }
    updateTags();
  }
  /* etiqueta sobre el objeto: al acercar la mano (indicación de selección) y, en el cierre, el aprendizaje de cada uno */
  function updateTags() {
    if (!W.slots) return;
    var xr = FFX.immersive();
    Object.keys(W.slots).forEach(function (id) {
      var s = W.slots[id], on = (S.view === "hub" && S.hover === id) || S.view === "end";
      if (on) s.tag.set({ w: 300, bg: "rgba(251,245,230,.97)", radius: 16, shadow: true, border: S.view === "hub" ? C.signal : null, pad: [10, 14, 12, 14], items: [
        { t: "text", size: 22, weight: 800, align: "center", color: C.ink, text: HUB.name[id].toUpperCase(), mb: 2 },
        { t: "text", size: 15, weight: 700, align: "center", color: C.moss, text: HUB.verb[id], mb: S.view === "hub" ? 6 : 0 },
        S.view === "hub" ? { t: "text", size: 14, weight: 700, align: "center", color: "#b3261e", text: xr ? "👌 Pellízcalo para elegirlo" : "Clic para elegirlo" } : null] });
      s.tag.show(on);
    });
  }
  function slotClick(id) {
    if (S.view === "hub") { slotSelect(id); return; }
    /* en el computador, clic sobre el objeto elegido = tomarlo (en el Quest se toma con la mano: grabCheck) */
    if (S.view === "act" && id === S.item && waitingGrab() && !FFX.immersive()) grabObject(null);
  }
  function slotSelect(id) {
    if (S.view !== "hub") return;
    AU.unlock(); AU.click(true); kick(W.slots[id], 1.4);
    startActivity(id);
  }
  /* mano cerca de un objeto (Meta Quest): la punta del índice o la palma a menos de 11 cm → se resalta; pellizco ahí → se elige */
  var HH = new V3(), HC = new V3();
  function hubHands() {
    var H = FFX.hands, best = null, bd = 0.08, bside = null;   // los objetos están a 5,6 cm entre sí: se resalta el más cercano
    ["left", "right"].forEach(function (side) {
      if (!H.tracked(side)) return;
      var pts = [];
      if (H.joint(side, "index-finger-tip", HH)) pts.push(HH.clone());
      var g = H.grip(side); if (g) pts.push(g.getWorldPosition(new V3()));
      pts.forEach(function (p) {
        Object.keys(W.slots).forEach(function (id) {
          var s = W.slots[id]; if (!s.el.object3D.visible || !s.target) return;
          var d = p.distanceTo(slotCenter(s, HC)); if (d < bd) { bd = d; best = id; bside = side; }
        });
      });
    });
    if (best) setHover(best, "hand"); else if (S.hoverSrc === "hand") setHover(null);
    if (best && H.pinch(bside).start) slotSelect(best);
  }

  /* =====================================================================================
     ACTIVIDADES
     Elegido un objeto: el otro desaparece, el elegido se queda en su base junto a Mateo y Mateo presenta la actividad.
     Después el usuario lo agarra con la mano (puño cerrado o pellizco junto al objeto) y comienza la interacción.
     ===================================================================================== */
  function startActivity(id) {
    go("act"); S.item = id; S.grabbed = false; S.grabArm = {}; S.grabT = performance.now();
    showSlots([id]); mateoPoint(id, 2400);
    if (id === "radio") {
      S.phase = "intro";
      say("Cuando no tenemos internet o la señal celular falla, una radio puede ayudarnos a recibir noticias e indicaciones de las autoridades.");
    } else {
      S.phase = "m1"; PR = { mode: "demo", demo: -1 };
      say("También podemos utilizar la luz para enviar señales. Hoy vamos a aprender a transmitir un mensaje utilizando el código Morse.");
      later(1200, startDemo);
    }
    renderCard();
  }
  /* esperando el agarre: antes de tomarlo por primera vez o después de soltarlo (vuelve a su base) */
  function waitingGrab() { return S.view === "act" && !S.held; }
  /* agarre (Meta Quest): la palma a menos de 13 cm del objeto y la mano se cierra (o pellizca). Primero hay que abrir la mano: así el
     pellizco con el que se eligió el objeto no lo toma sin querer. */
  function grabCheck() {
    var H = FFX.hands, s = W.slots[S.item]; if (!s || performance.now() - S.grabT < 900) return;
    var c = slotCenter(s, HC);
    ["right", "left"].forEach(function (side) {
      if (S.held || !H.tracked(side)) return;
      var g = H.grip(side); if (!g || g.getWorldPosition(HH).distanceTo(c) > 0.1) return;   // la palma sobre el objeto pequeño (a menos de 10 cm)
      var closed = handClosed(side) || H.pinch(side).active;
      if (!closed) S.grabArm[side] = true;
      else if (S.grabArm[side]) grabObject(side);
    });
  }
  /* mano cerrada: las yemas del índice, medio y anular cerca de sus nudillos */
  var HK1 = new V3(), HK2 = new V3();
  function handClosed(side) {
    var H = FFX.hands, n = 0, sum = 0;
    ["index", "middle", "ring"].forEach(function (f) { if (H.joint(side, f + "-finger-tip", HK1) && H.joint(side, f + "-finger-phalanx-proximal", HK2)) { sum += HK1.distanceTo(HK2); n++; } });
    return n >= 2 && sum / n < 0.055;
  }
  /* AGARRAR CON UNA SOLA MANO. La radio se toma con la mano IZQUIERDA (la derecha queda libre para las perillas); la linterna, con cualquiera.
     Soltar: abrir la mano (handOpen) por un tercio de segundo: el objeto vuelve a su base y se puede agarrar otra vez; la práctica sigue donde iba. */
  var RADIO_LEFT = "La radio se agarra con la mano izquierda: la derecha queda libre para girar las perillas.";
  function grabObject(side) {
    if (S.held || S.view !== "act") return;
    if (S.item === "radio" && side === "right") { if (S.coach !== RADIO_LEFT) say(RADIO_LEFT); return; }
    if (!W.heldEl.object3D.visible) W.grow = 0;   // crece desde su base (si estaba encogiéndose, sigue desde donde iba)
    S.held = true; S.openT = 0; AU.click(true);
    clearDemo();
    W.slots[S.item].holder.visible = false;   // el objeto pasa de la base a la mano
    if (!S.grabbed) {
      S.grabbed = true;
      if (S.item === "radio") { S.phase = "play"; startRadio(side); }
      else { S.phase = "m2"; startTorch(side); }
      renderCard(); coachLine(); return;
    }
    /* volver a agarrar: el mismo objeto (con su estado: encendida, emisora, perillas…) regresa a la mano */
    W.heldEl.object3D.visible = true; W.radioPose = null; W.torchPose = null;
    if (S.item === "radio") { PR.holdSide = side || "left"; PR.knobSide = PR.holdSide === "left" ? "right" : "left"; PR.push = 0; PR.dropY = 0; }
    else { W.torchHand = side || null; if (PR.trig) { PR.trig.rest = null; PR.trig.pressed = false; } }
    S.coach = null; UI.refresh(); renderCard(); coachLine();
  }
  function releaseObject() {
    if (!S.held) return;
    S.held = false; S.grabArm = {}; S.grabT = performance.now(); S.openT = 0;
    if (PR.mode === "torch") { torchPress(false); torchDown = false; torchLight(false); if (PR.trig) PR.trig.pressed = false; }
    PR.grab = null; PR.nearKnob = false; PR.push = 0; PR.dropY = 0;
    AU.click(false);   // el objeto se encoge y vuelve a su base (placeHeld)
    say(S.item === "radio" ? "La radio quedó en su base. Agárrala otra vez con tu mano izquierda cuando quieras." : "La linterna quedó en su base. Vuelve a agarrarla cuando quieras.");
    UI.refresh(); renderCard();
  }
  /* mano abierta: las yemas lejos de sus nudillos (más que «cerrada», con margen para que no se suelte sin querer) y sin pellizcar */
  function handOpen(side) {
    var H = FFX.hands, n = 0, sum = 0;
    ["index", "middle", "ring"].forEach(function (f) { if (H.joint(side, f + "-finger-tip", HK1) && H.joint(side, f + "-finger-phalanx-proximal", HK2)) { sum += HK1.distanceTo(HK2); n++; } });
    return n >= 2 && sum / n > 0.072 && !H.pinch(side).active;
  }
  function releaseCheck(dt) {
    var side = S.item === "radio" ? PR.holdSide : W.torchHand; if (!side || !FFX.hands.tracked(side)) { S.openT = 0; return; }
    if (handOpen(side)) { S.openT += dt; if (S.openT > 330) releaseObject(); } else S.openT = 0;
  }
  function renderCard() {
    if (S.view !== "act") return;
    var xr = FFX.immersive(), items = [], drop = xr ? null : { id: "drop", label: "Soltar", kind: "outline" };
    /* lo soltó: vuelve a su base y se puede agarrar otra vez (la práctica sigue donde iba) */
    if (S.grabbed && !S.held) {
      items.push({ t: "kicker", text: S.item === "radio" ? "Radio · Recibir información" : "Linterna · Transmitir información" });
      items.push({ t: "h2", text: S.item === "radio" ? "Agarra otra vez la radio" : "Agarra otra vez la linterna" });
      items.push({ t: "text", size: 16, weight: 600, lh: 1.45, mb: 12, text: xr ? (S.item === "radio" ? "Tómala por la manija con tu mano izquierda." : "Rodéala con una mano y cierra los dedos.") : "Haz clic en el objeto (o en «Tomar»)." });
      items.push({ t: "buttons", list: [xr ? null : { id: "take", label: "Tomar", kind: "signal" }, { id: "to-hub", label: "Elegir otra", kind: "outline" }] });
      seqCard({ items: items }); return;
    }
    if (S.item === "radio") {
      items.push({ t: "kicker", text: "Radio · Recibir información" });
      if (S.phase === "intro") {
        items.push({ t: "h2", text: "Agarra la radio" });
        items.push({ t: "text", size: 16, weight: 600, lh: 1.45, text: xr ? "Toma su manija con tu mano izquierda y cierra los dedos." : "Haz clic en la radio para tomarla.", mb: 12 });
        items.push({ t: "buttons", list: [xr ? null : { id: "take", label: "Tomar la radio", kind: "signal" }, { id: "to-hub", label: "Elegir otra", kind: "outline" }] });
      } else {
        var on = TU.state.on, st = PR.station ? FF.tuner.bands[TU.state.band].filter(function (x) { return x.id === PR.station; })[0] : null;
        items.push({ t: "h2", text: !on ? "Enciéndela" : st ? "¡Señal clara!" : PR.found ? "Busca otra emisora" : "Sintoniza una emisora" });
        if (st) items.push(successBadge(st.name));
        else items.push({ t: "text", size: 16, weight: 600, lh: 1.45, text: !on ? (xr ? "Con la mano derecha, toma una perilla: la radio se enciende." : "Haz clic en la perilla izquierda de la radio.") : (xr ? "Gira la perilla derecha para recorrer el dial." : "Haz clic en la perilla derecha para girarla."), mb: 10 });
        items.push(tunerUI());
        if (PR.found) {
          items.push({ t: "text", size: 15, weight: 700, lh: 1.45, color: C.moss, text: "La radio RECIBE información, pero no envía mensajes ni pide ayuda.", mt: 10, mb: 12 });
          items.push({ t: "buttons", list: [{ id: "radio-next", label: S.done.linterna ? "Ver el cierre →" : "Continuar con la linterna →", kind: "signal" }, drop] });
        } else items.push({ t: "buttons", mt: 10, list: [{ id: "to-hub", label: "Elegir otra", kind: "outline" }, drop] });
      }
    } else {
      items.push({ t: "kicker", text: "Linterna · Transmitir información" });
      if (S.phase === "m1") {
        items.push({ t: "h2", text: "Mira los destellos" });
        items.push(flashDemoUI());
        items.push({ t: "text", size: 15, weight: 600, lh: 1.45, text: xr ? "Cuando quieras, agarra la linterna." : "Cuando quieras, toma la linterna.", mt: 10, mb: 12 });
        items.push({ t: "buttons", list: [xr ? null : { id: "take", label: "Tomar la linterna", kind: "signal" }, { id: "to-hub", label: "Elegir otra", kind: "outline" }] });
      } else if (S.phase === "m2") {
        items.push({ t: "h2", text: "Enciende y apaga" });
        items.push({ t: "text", size: 16, weight: 600, lh: 1.45, text: xr ? "Presiona el botón con tu pulgar y suéltalo." : "Mantén presionado el clic sobre la linterna (o usa los botones).", mb: 10 });
        items.push(flashCountUI());
        items.push({ t: "buttons", mt: 10, size: 14, gap: 8, list: [xr ? null : { id: "dot", label: "Corto", kind: "cream" }, xr ? null : { id: "dash", label: "Largo", kind: "cream" },
          { id: "torch-sos", label: PR.flashes >= 3 ? "Practicar SOS →" : "Saltar →", kind: PR.flashes >= 3 ? "signal" : "outline" }, drop] });
      } else {
        items.push({ t: "h2", text: PR.done ? "¡Enviaste SOS!" : "Envía SOS" });
        items.push(sosUI());
        if (PR.err) items.push(morseWarn());
        else if (PR.done) items.push(successBadge("Tu mensaje de luz es correcto"));
        else items.push({ t: "small", text: "Corto = toque rápido · Largo = mantén un poco más", mt: 6 });
        if (PR.done) items.push({ t: "buttons", mt: 12, list: [{ id: "torch-end", label: "Terminar práctica", kind: "signal" }] });
        else items.push({ t: "buttons", mt: 10, size: 14, gap: 8, list: [xr ? null : { id: "dot", label: "Corto", kind: "cream" }, xr ? null : { id: "dash", label: "Largo", kind: "cream" },
          { id: "sos-demo", label: "▶ Ver SOS", kind: "cream" }, { id: "clear", label: "Borrar", kind: "outline" }, drop] });
      }
    }
    seqCard({ items: items });
  }
  /* instrucción corta de Mateo para cada momento (se queda en el globo hasta el siguiente paso) */
  function coachLine() {
    var xr = FFX.immersive(), line = null;
    if (S.view !== "act") return;
    if (S.item === "radio" && S.phase === "play" && !PR.found) {
      line = !TU.state.on ? (xr ? "Con tu mano derecha toma una perilla entre el pulgar y el índice: la radio se enciende." : "Haz clic en la perilla izquierda para encender la radio.")
        : (xr ? "¡Se encendió! Gira la perilla derecha para recorrer el dial hasta que una emisora se oiga clara." : "¡Se encendió! Haz clic en la perilla derecha para recorrer el dial.");
    } else if (S.item === "linterna" && S.phase === "m2") {
      line = PR.flashes >= 3 ? "¡Así se hace! Ya sabes encenderla y apagarla. Ahora enviemos un SOS." : xr ? "Presiona el botón con tu pulgar para encenderla y suéltalo para apagarla." : "Mantén presionado el clic sobre la linterna para encenderla.";
    } else if (S.item === "linterna" && S.phase === "m3" && !PR.done && !PR.err) {
      var n = PR.log.length;
      line = n < 3 ? "SOS empieza con tres destellos cortos." : n < 6 ? "¡Bien! Ahora tres destellos largos." : "¡Ya casi! Termina con tres destellos cortos.";
    }
    if (line && line !== S.coach) say(line);
  }
  function successBadge(text) {
    return { t: "custom", h: 58, mb: 4, draw: function (ctx, x, y, w, h) {
      UI.rr(ctx, x, y, w, h, 14); ctx.fillStyle = "#e3f6e8"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#2e8b57"; ctx.stroke();
      ctx.fillStyle = "#2e8b57"; ctx.beginPath(); ctx.arc(x + 29, y + h / 2, 17, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x + 21, y + h / 2); ctx.lineTo(x + 27, y + h / 2 + 6); ctx.lineTo(x + 38, y + h / 2 - 7); ctx.stroke();
      UI.drawText(ctx, { size: 16, weight: 800, color: "#1f5f3a", text: text }, x + 56, y + h / 2 - 11, w - 64, true);
    } };
  }

  /* =====================================================================================
     OBJETO EN LA MANO
     · Radio: tomada por la MANIJA con la mano que la agarró; sigue la posición y la orientación de esa mano (articulaciones de WebXR). La otra
       mano gira las perillas; si un dedo se mete en la radio, la radio se aparta (no la atraviesa).
     · Linterna: empuñada (el mango atraviesa el puño) con el botón bajo la yema del pulgar (TORCH_FINGER).
     · En el Quest, si la mano no se ve, el objeto se queda donde estaba o vuelve a su base: nunca flota delante de la cara.
     · En el computador (vista previa) el objeto va delante de la cámara.
     ===================================================================================== */
  var HM = new THREE.Matrix4(), HP2 = new V3(), HQ = new THREE.Quaternion(), HS = new V3(1, 1, 1), HPI = new THREE.Matrix4();
  var HELD_CAM = { torch: [0.07, -0.16, -0.38, 0.05, 0, 0], radio: [0, -0.15, -0.55, 0.25, 0, 0] };
  var RADIO_W = 0.24;   // ancho del cuerpo de la radio en la mano (m)
  var QX = new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), -Math.PI / 2), QUP = new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2);
  function clearHeld() {
    if (!W.heldEl) return;
    var hb = W.heldBox; hb.children.slice().forEach(function (c) { hb.remove(c); });
    W.heldEl.object3D.visible = false; W.heldObj = null; W.heldKind = null; W.radioPose = null; W.torchPose = null; UI.refresh();
  }
  function setHeld(kind, size, done) {
    clearHeld(); var tk = S.token, h = W.heldEl.object3D; h.visible = true; W.heldKind = kind;
    makeObject(kind, size).then(function (o) {
      if (tk !== S.token) return;
      var piv = new THREE.Group(); piv.add(o); o.position.y = -o.userData.size.y / 2; W.heldBox.add(piv); tagEl(piv, W.heldEl);
      W.heldObj = { piv: piv, obj: o, kind: kind, half: o.userData.size.y / 2 };
      if (done) done(piv, o); UI.refresh();
    });
  }
  /* GROW (0 → 1): al agarrar, el objeto pasa de su tamaño a escala de Mateo (en su base) al tamaño real en la mano, en unos 0,3 s;
     al soltar hace lo contrario y vuelve a quedar en su base, junto a Mateo. Mientras crece, sus perillas y su botón no responden. */
  var GROW_MS = 110, GP = new V3(), GQ = new THREE.Quaternion();
  function fullSize(kind) { return kind === "radio" ? RADIO_W : 0.19; }
  function placeHeld(dt) {
    var h = W.heldEl && W.heldEl.object3D; if (!h || !h.visible || !W.heldKind || !W.heldObj) return;
    var gt = S.held ? 1 : 0; W.grow = W.grow == null ? 0 : W.grow;
    W.grow += (gt - W.grow) * (1 - Math.exp(-(dt || 16) / GROW_MS)); if (Math.abs(gt - W.grow) < 0.004) W.grow = gt;
    if (!S.held && W.grow <= 0) {   // terminó de encogerse: queda en su base
      h.visible = false; if (W.slots[S.item]) W.slots[S.item].holder.visible = true; UI.refresh(); return;
    }
    var kind = W.heldKind, H = FFX.hands, done = false, torchSide = null;
    if (FFX.immersive()) {
      if (kind === "radio") done = radioPose(H);
      else {
        var t = torchHand(H);
        if (t) {
          W.torchJ = torchFrame(H, t);
          if (!W.torchJ) { var g = H.grip(t); g.getWorldPosition(HP2); g.getWorldQuaternion(HQ); }   // control o mano sin articulaciones
          done = true; W.torchSide = torchSide = t;
        } else if (W.torchPose) { HP2.copy(W.torchPose.p); HQ.copy(W.torchPose.q); done = true; }   // mano perdida: se queda donde estaba
      }
      W.noHand = !done;
      if (!done) {   /* aún no hay mano: el objeto espera en su base, a escala de Mateo (ver GROW) */
        var s = W.slots[S.item]; slotTop(s, HP2); HP2.y += W.heldObj.half + 0.002;
        root.getWorldQuaternion(HQ); if (kind === "torch") HQ.multiply(QUP);
        W.torchJ = false; done = true;
      }
    } else {
      var cam = camEl.object3D, c = HELD_CAM[kind]; cam.updateMatrixWorld(true);
      HP2.set(c[0], c[1], c[2]).applyMatrix4(cam.matrixWorld); cam.getWorldQuaternion(HQ);
      HQ.multiply(tmpQ.setFromEuler(new THREE.Euler(c[3], c[4], c[5])));
      W.torchSide = "right"; W.torchJ = false; W.noHand = false;
    }
    /* mezcla entre la base (tamaño de Mateo) y la mano (tamaño real) según GROW */
    var gs = W.slots[S.item], mini = MINI[kind] / fullSize(kind), e = W.grow * W.grow * (3 - 2 * W.grow);
    if (gs && e < 1) {
      slotTop(gs, GP); GP.y += W.heldObj.half * mini + 0.0005;
      root.getWorldQuaternion(GQ); if (kind === "torch" && !W.torchJ) GQ.multiply(QUP);   // de pie en su base
      if (W.noHand) e = 0;
      HP2.lerpVectors(GP, HP2, e); HQ.slerpQuaternions(GQ, HQ, e);
    }
    W.heldBox.scale.setScalar(mini + (1 - mini) * e);
    HM.compose(HP2, HQ, HS);
    h.parent.updateMatrixWorld(true); HPI.copy(h.parent.matrixWorld).invert(); HM.premultiply(HPI);
    HM.decompose(h.position, h.quaternion, tmpV);
    if (kind === "torch") torchFit(torchSide);
  }

  /* ---------- marco de la mano a partir de sus articulaciones (WebXR hand tracking) ----------
     FA: eje del puño (de los nudillos del meñique hacia los del índice) · FF: de la muñeca hacia los nudillos · FN: sale de la palma ·
     FC: centro del hueco del puño (donde queda un mango o una manija), delante de la palma. */
  var FJ = { w: new V3(), i: new V3(), m: new V3(), r: new V3(), p: new V3() }, FA = new V3(), FFw = new V3(), FN = new V3(), FK = new V3(), FC = new V3();
  function handFrame(H, side, grip) {
    var j = function (n, v) { return H.joint(side, n, v); };
    if (!j("wrist", FJ.w) || !j("index-finger-phalanx-proximal", FJ.i) || !j("middle-finger-phalanx-proximal", FJ.m) || !j("ring-finger-phalanx-proximal", FJ.r) || !j("pinky-finger-phalanx-proximal", FJ.p)) return false;
    FA.subVectors(FJ.i, FJ.p); if (FA.lengthSq() < 1e-6) return false; FA.normalize();
    FK.copy(FJ.i).add(FJ.m).add(FJ.r).add(FJ.p).multiplyScalar(0.25);
    FFw.subVectors(FK, FJ.w); FFw.addScaledVector(FA, -FFw.dot(FA)); if (FFw.lengthSq() < 1e-6) return false; FFw.normalize();
    FN.crossVectors(FA, FFw).multiplyScalar(side === "right" ? 1 : -1);
    FC.copy(FK).addScaledVector(FN, grip.n).addScaledVector(FFw, grip.f);
    return true;
  }

  /* ---------- radio en la mano ---------- */
  var RADIO_GRIP = { n: 0.02, f: -0.006 }, RX = new V3(), RY = new V3(), RZ = new V3();
  function radioPose(H) {
    var side = PR.holdSide, pose = W.radioPose, rig = PR.rig;
    if (rig && side && H.tracked(side) && handFrame(H, side, RADIO_GRIP)) {
      /* la manija pasa por el puño (eje X de la radio = eje del puño) y el cuerpo cuelga por debajo de la mano.
         Orientación natural: el «arriba» de la radio está a medio camino entre el dorso de la mano y la vertical (como una radio que cuelga
         de su manija): sigue los giros de la muñeca sin quedar de lado ni boca abajo. La posición del agarre (la manija en el puño) no cambia. */
      RY.copy(FN).negate().lerp(YUP, 0.55).normalize();
      RX.copy(FA).multiplyScalar(side === "left" ? 1 : -1); RX.addScaledVector(RY, -RX.dot(RY)).normalize();
      RZ.crossVectors(RX, RY);
      HM.makeBasis(RX, RY, RZ); HQ.setFromRotationMatrix(HM);
      HP2.copy(FC).sub(tmpV.copy(rig.grip).applyQuaternion(HQ));
      var a = PR.nearKnob ? 0.2 : 0.5;   // con la otra mano en una perilla, la radio se mueve más suave (no tiembla bajo los dedos)
      if (pose) { pose.p.lerp(HP2, a); pose.q.slerp(HQ, a); } else pose = W.radioPose = { p: HP2.clone(), q: HQ.clone() };
    }
    if (!pose) return false;
    HP2.copy(pose.p); HQ.copy(pose.q);
    /* colisiones: los dedos de la mano derecha empujan la radio hacia atrás (push) y la palma izquierda, hacia abajo (dropY) */
    if (PR.push > 0) HP2.addScaledVector(tmpV2.set(0, 0, 1).applyQuaternion(HQ), -PR.push);
    if (PR.dropY > 0) HP2.addScaledVector(tmpV2.set(0, 1, 0).applyQuaternion(HQ), -PR.dropY);
    return true;
  }
  /* caja de una pieza del modelo en el espacio del pivote del objeto en las manos (metros) */
  function relBox(piv, n) {
    piv.updateMatrixWorld(true);
    var M = new THREE.Matrix4().copy(piv.matrixWorld).invert().multiply(n.matrixWorld);
    n.geometry.computeBoundingBox(); return n.geometry.boundingBox.clone().applyMatrix4(M);
  }
  function findMesh(o, re) { var r = null; o.traverse(function (n) { if (!r && n.isMesh && re.test(n.name)) r = n; }); return r; }
  /* perillas de Radio.glb: «Perilla1» (izquierda: encender) y «Perilla» (derecha: AM/FM), cada una con su indicador, en un pivote que gira
     sobre su eje. «Manija_Radio»: punto de agarre. «Antena_Radio»: de su punta salen las ondas cuando la señal está clara. */
  function radioRig(piv, o) {
    var knob = function (kRe, iRe) {
      var k = findMesh(o, kRe), ind = findMesh(o, iRe); if (!k) return null;
      var bb = relBox(piv, k), c = bb.getCenter(new V3());
      var pv = new THREE.Group(); pv.position.copy(k.position); k.parent.add(pv); pv.updateMatrixWorld(true);
      pv.attach(k); if (ind) pv.attach(ind);
      return { pv: pv, front: new V3(c.x, c.y, bb.max.z), r: (bb.max.x - bb.min.x) / 2 };
    };
    var bodyM = findMesh(o, /^Cuerpo_Radio/), bb = bodyM ? relBox(piv, bodyM) : null;
    var man = findMesh(o, /^Manija/), mb = man ? relBox(piv, man) : null, mc = mb ? mb.getCenter(new V3()) : null;
    var ant = findMesh(o, /^Antena/), ab = ant ? relBox(piv, ant) : null;
    /* pantalla y aguja del dial («Pantalla_Radio» y «Barra_Radio»): la pantalla se ilumina al encender y la aguja recorre el dial con la perilla */
    var pant = findMesh(o, /^Pantalla_Radio/), barra = findMesh(o, /^Barra_Radio/), disp = null;
    if (pant && barra) {
      pant.material = pant.material.clone();   // solo la radio de la mano se ilumina
      var pb = relBox(piv, pant), nb = relBox(piv, barra), nw = nb.max.x - nb.min.x;
      piv.updateMatrixWorld(true); barra.parent.updateMatrixWorld(true);
      var q0 = barra.parent.worldToLocal(piv.localToWorld(new V3(0, 0, 0))), q1 = barra.parent.worldToLocal(piv.localToWorld(new V3(1, 0, 0)));
      disp = { pant: pant, barra: barra, x0: pb.min.x + nw * 1.5, x1: pb.max.x - nw * 1.5, cx: (nb.min.x + nb.max.x) / 2, bx0: barra.position.x, f: q1.x - q0.x, x: (nb.min.x + nb.max.x) / 2, glow: 0 };
    }
    return { piv: piv, t0: performance.now(), disp: disp,
      power: knob(/^Perilla1$/, /^Perilla-Indicador$/), tune: knob(/^Perilla$/, /^Perilla-Indicador1$/),
      grip: mb ? new V3(mc.x, mb.max.y - 0.006, mc.z) : new V3(0, 0.12, 0),
      ant: ab ? new V3(ab.max.x - 0.004, ab.max.y, (ab.min.z + ab.max.z) / 2) : new V3(0.1, 0.2, 0),
      body: bb ? { x0: bb.min.x, x1: bb.max.x, y0: bb.min.y, y1: bb.max.y, z0: bb.min.z, zf: bb.max.z } : null };
  }
  function startRadio(side) {
    var holdSide = side || "left";
    PR = { mode: "radio", found: false, station: null, heard: {}, knob: 0, pknob: 0, push: 0, dropY: 0, grab: null, nearKnob: false, holdSide: holdSide, knobSide: holdSide === "left" ? "right" : "left" };
    TU.set(FF.tuner.start); TU.audioCap = 1; if (window.FFRadio) FFRadio.update(TU.state);
    setHeld("radio", RADIO_W, function (piv, o) {
      PR.rig = radioRig(piv, o);
      /* ondas de señal (anillos que se expanden desde la antena) para el momento del éxito */
      PR.waves = [0, 1, 2].map(function () {
        var r = new THREE.Mesh(new THREE.RingGeometry(0.016, 0.02, 40), new THREE.MeshBasicMaterial({ color: 0xf5b335, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
        r.position.copy(PR.rig.ant); piv.add(r); return r;
      });
    });
  }
  function wavesUpdate(t) {
    if (!PR.waves) return;
    PR.waves.forEach(function (r, i) { var p = (t * 0.7 + i / 3) % 1; r.scale.setScalar(1 + p * 5); r.material.opacity = PR.station ? (1 - p) * 0.85 : 0; });
  }
  /* pantalla y aguja: la pantalla se enciende (más brillante cuanto más clara la señal) y la aguja sigue al dial, suavemente */
  var DISP_COL = new THREE.Color(0xffb347);
  function radioDisplay() {
    var d = PR.rig && PR.rig.disp; if (!d) return;
    var s = TU.state, want = s.on ? 0.35 + 0.55 * TU.clarity() : 0;
    d.glow += (want - d.glow) * 0.2;
    d.pant.material.emissive.copy(DISP_COL).multiplyScalar(d.glow);
    var tx = d.x0 + (d.x1 - d.x0) * clamp(s.pos / 100, 0, 1); d.x += (tx - d.x) * 0.3;
    d.barra.position.x = d.bx0 + (d.x - d.cx) * d.f;
  }

  /* ---------- radio: el mismo sintonizador ilustrativo (js/tuner.js + FF.tuner) ---------- */
  function tunerUI() {
    var D = FF.tuner, s = TU.state, c = TU.clarity(), n = nearestStation(), msg = !s.on ? D.off : c >= 0.75 && n ? n.name + " (" + s.band + "). " + (n.msg || "") : c >= 0.3 ? D.near : D.noise;
    return { t: "custom", h: 214, draw: function (ctx, x, y, w, h, S) {
      UI.rr(ctx, x, y, w, h, 16); ctx.fillStyle = "#2a241f"; ctx.fill();
      var b = function (id, label, bx, on) { var bw = id === "power" ? 150 : 62; UI.rr(ctx, x + bx, y + 14, bw, 38, 999); ctx.fillStyle = on ? C.signal : S.hover === id ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.1)"; ctx.fill(); ctx.fillStyle = on ? C.ink : "#fff"; ctx.font = UI.font(13.5, 700); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, x + bx + bw / 2, y + 34); ctx.textAlign = "left"; S.region(id, x + bx, y + 14, bw, 38); };
      b("power", s.on ? "⏻  Apagar la radio" : "⏻  Encender la radio", 14, s.on); b("band:AM", "AM", 178, s.band === "AM"); b("band:FM", "FM", 248, s.band === "FM");
      var dx = x + 50, dw = w - 100, dy = y + 70;
      UI.rr(ctx, dx, dy, dw, 54, 10); ctx.fillStyle = s.on ? "#f3e6c4" : "#bfb49a"; ctx.fill();
      ctx.fillStyle = "rgba(35,37,31,.55)"; for (var i = 0; i <= 20; i++) { var tx = dx + 10 + (dw - 20) * i / 20; ctx.fillRect(tx, dy + 8, 1.5, i % 5 ? 10 : 18); }
      if (s.on) { ctx.globalAlpha = (1 - c) * 0.45; for (var j = 0; j < 90; j++) { ctx.fillStyle = Math.random() < 0.5 ? "#000" : "#fff"; ctx.fillRect(dx + Math.random() * dw, dy + 30 + Math.random() * 20, 2, 2); } ctx.globalAlpha = 1; }
      var nx = dx + 10 + (dw - 20) * s.pos / 100; ctx.fillStyle = C.red; ctx.fillRect(nx - 1.5, dy + 4, 3, 46);
      S.region("dial", dx, dy, dw, 54);
      var arrow = function (id, label, ax) { UI.rr(ctx, ax, dy + 7, 36, 40, 12); ctx.fillStyle = S.hover === id ? "rgba(255,255,255,.3)" : "rgba(255,255,255,.12)"; ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = UI.font(20, 700); ctx.textAlign = "center"; ctx.fillText(label, ax + 18, dy + 28); ctx.textAlign = "left"; S.region(id, ax, dy + 7, 36, 40); };
      arrow("dial-", "‹", x + 8); arrow("dial+", "›", x + w - 44);
      UI.rr(ctx, x + 14, y + 136, w - 28, 8, 4); ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fill(); UI.rr(ctx, x + 14, y + 136, (w - 28) * c, 8, 4); ctx.fillStyle = c >= 0.75 ? "#5fd08a" : C.signal; ctx.fill();
      UI.drawText(ctx, { size: 13, weight: 600, lh: 1.4, color: c >= 0.75 ? "#8be0a4" : "#f3e6c4", text: msg }, x + 14, y + 152, w - 28, true);
    } };
  }
  function nearestStation() { var s = TU.state, best = null, bd = 1e9; FF.tuner.bands[s.band].forEach(function (st) { var d = Math.abs(st.pos - s.pos); if (d < bd) { bd = d; best = st; } }); return best; }
  /* cambios del sintonizador: el sonido lo pone ff/emisoras.js (estática y fragmentos de cada emisora; nunca dos a la vez); aquí van los
     sonidos de la perilla (clic, cambio de banda y tic del dial) y la respuesta en la tarjeta y en Mateo */
  var STATION_LINE = { music: "¡Música! También por la radio llegan canciones.", news: "¡Noticias! Así nos enteramos de lo que pasa y de lo que recomiendan las autoridades.", terror: "¡Uy, historias de fantasmas! La radio también nos acompaña y entretiene." };
  function radioSet(patch) {
    if (PR.mode !== "radio") return;
    var b = { on: TU.state.on, band: TU.state.band, pos: TU.state.pos };
    TU.set(patch, false);
    var s = TU.state;
    if (patch.on !== undefined && s.on !== b.on) AU.click(s.on);
    if (patch.band !== undefined && s.band !== b.band) AU.band();
    if (patch.pos !== undefined && s.pos !== b.pos) { if (s.on) AU.dial(s.pos); PR.knob = (DIAL0 - s.pos) / KNOB_POS; }   // la perilla y el dial siempre coinciden
    var st = window.FFRadio ? FFRadio.update(s) : (TU.clarity() >= 0.75 ? nearestStation() : null);
    var changed = (st ? st.id : null) !== PR.station; PR.station = st ? st.id : null;
    if (st && !PR.found) { PR.found = true; radioSuccess(st); return; }
    if (st && changed && PR.found && !PR.heard[st.id]) { PR.heard[st.id] = true; say(STATION_LINE[st.kind] || st.name); }
    renderCard(); if (!st) coachLine();
  }
  /* primera emisora clara: éxito (las perillas siguen libres para recorrer las demás emisoras) */
  function radioSuccess(st) {
    S.done.radio = true; PR.heard[st.id] = true; celebrate();
    say("¡Escucha, ya hay señal! La radio nos deja RECIBIR información, pero no sirve para enviar mensajes ni pedir ayuda directamente. Sigue girando para oír otras emisoras.");
    renderCard();
  }
  /* girar la perilla derecha recorre el dial: unos 270° van del comienzo (8) al final (100); cada giro mueve la aguja y suena el dial */
  var DIAL0 = 8, KNOB_POS = 19.5;
  function turnKnob(d) {
    if (!TU.state.on) return;
    PR.knob = clamp(PR.knob + d, (DIAL0 - 100) / KNOB_POS, DIAL0 / KNOB_POS);
    var pos = Math.round(clamp(DIAL0 - PR.knob * KNOB_POS, 0, 100));
    if (pos !== TU.state.pos) radioSet({ pos: pos });
  }
  /* girar la perilla izquierda (encendido): la radio ya se enciende al tomar cualquier perilla; la perilla queda en «encendido» */
  var POWER_ON = 0.6, POWER_REST = 0.9;
  function turnPower(d) {
    PR.pknob = clamp(PR.pknob + d, -1.6, 1.6);
    if (!TU.state.on && Math.abs(PR.pknob) >= POWER_ON) { PR.pknobSign = PR.pknob < 0 ? -1 : 1; radioSet({ on: true }); }
  }
  /* la otra mano sobre las perillas: tomar una perilla entre el pulgar y el índice (o pellizcar sobre ella) y girar la muñeca.
     Si la punta de un dedo se mete en el cuerpo o en una perilla, la radio se aparta lo necesario (PR.push, hasta 3 cm): la mano no la atraviesa. */
  var RH_TIPS = ["thumb-tip", "index-finger-tip", "middle-finger-tip"], RH_P = [new V3(), new V3(), new V3()];
  function radioHands() {
    var rig = PR.rig, H = FFX.hands; if (!rig || !rig.power || !rig.tune) { PR.nearKnob = false; return; }
    var pv = rig.piv, s = pv.scale.x, side = PR.knobSide; pv.updateMatrixWorld(true);
    var tips = RH_TIPS.map(function (n, i) { return H.joint(side, n, RH_P[i]) ? pv.worldToLocal(RH_P[i]) : null; });
    var th = tips[0], ix = tips[1], m = 1 / s, near = false, grab = null;
    [["power", rig.power], ["tune", rig.tune]].forEach(function (k) {
      var f = k[1].front, r = k[1].r;
      var dTh = th ? th.distanceTo(f) : 1e9, dIx = ix ? ix.distanceTo(f) : 1e9;
      if (Math.min(dTh, dIx) < r + 0.045 * m) near = true;
      if (grab || !th || !ix) return;
      var both = dTh < r + 0.03 * m && dIx < r + 0.03 * m;
      var pinch = H.pinch(side).active && tmpV3.addVectors(th, ix).multiplyScalar(0.5).distanceTo(f) < r + 0.03 * m;
      if (both || pinch) grab = { knob: k[0], ang: Math.atan2(ix.y - th.y, ix.x - th.x) };
    });
    PR.nearKnob = near;
    if (grab) {
      if (!TU.state.on) radioSet({ on: true });   // al empezar a manipular las perillas, la radio se enciende y empieza la sintonización
      if (!PR.grab || PR.grab.knob !== grab.knob) PR.grab = { knob: grab.knob, prev: grab.ang, acc: 0, live: false };
      else {
        var d = grab.ang - PR.grab.prev; d = Math.atan2(Math.sin(d), Math.cos(d)); PR.grab.prev = grab.ang;
        d = clamp(d, -0.25, 0.25);   // un salto del seguimiento no hace girar de golpe la perilla
        /* zona muerta al empezar: el temblor de los dedos al tomar la perilla no la mueve; gira cuando el giro de la muñeca es claro (≈3,5°) */
        if (!PR.grab.live) { PR.grab.acc += d; if (Math.abs(PR.grab.acc) > 0.06) PR.grab.live = true; d = 0; }
        if (d) { if (grab.knob === "power") turnPower(d); else turnKnob(d); }
      }
    } else PR.grab = null;
    var b = rig.body, pen = -1, inside = false;
    if (b) tips.forEach(function (p) {
      if (!p || p.x < b.x0 - 0.005 * m || p.x > b.x1 + 0.005 * m || p.y < b.y0 - 0.005 * m || p.y > b.y1 + 0.005 * m) return;
      if (p.z < b.zf - 0.07 * m) return;
      inside = true;
      var g = b.zf - p.z;
      [rig.power, rig.tune].forEach(function (k) { if (Math.hypot(p.x - k.front.x, p.y - k.front.y) < k.r * 0.85) g = Math.max(g, k.front.z - p.z); });
      pen = Math.max(pen, g * s);
    });
    if (inside && pen > 0) PR.push = Math.min(0.03, PR.push + pen * 0.7);
    else if (!inside || pen < -0.006) PR.push = Math.max(0, PR.push - 0.0015);
    /* la mano que sostiene: si la palma o los dedos se meten en el cuerpo (por ejemplo, al tomarla más abajo de la manija), la radio baja lo
       necesario para que su cara de arriba quede bajo la mano (dropY, hasta 4 cm) */
    var hs = PR.holdSide, drop = -1, hin = false;
    if (b && hs) HOLD_J.forEach(function (n) {
      if (!H.joint(hs, n, HJ)) return; var p = pv.worldToLocal(HJ);
      if (p.x < b.x0 || p.x > b.x1 || p.z < b.z0 || p.z > b.zf || p.y < b.y0 || p.y > b.y1 + 0.004 * m) return;
      hin = true; drop = Math.max(drop, (b.y1 + 0.004 * m - p.y) * s);
    });
    if (hin && drop > 0) PR.dropY = Math.min(0.04, PR.dropY + drop * 0.6);
    else PR.dropY = Math.max(0, PR.dropY - 0.001);
  }
  var HOLD_J = ["index-finger-phalanx-proximal", "middle-finger-phalanx-proximal", "ring-finger-phalanx-proximal", "pinky-finger-phalanx-proximal", "index-finger-tip", "middle-finger-tip", "ring-finger-tip", "thumb-tip"], HJ = new V3();
  function radioKnobs() {
    var rig = PR.rig; if (!rig) return;
    if (rig.tune) rig.tune.pv.rotation.z += (PR.knob - rig.tune.pv.rotation.z) * 0.5;
    if (rig.power) {
      if (!(PR.grab && PR.grab.knob === "power")) PR.pknob += ((TU.state.on ? (PR.pknobSign || -1) * POWER_REST : 0) - PR.pknob) * 0.15;
      rig.power.pv.rotation.z += (PR.pknob - rig.power.pv.rotation.z) * 0.5;
    }
  }
  function knobAt(pt) {
    var rig = PR.rig; if (!pt || !rig || !rig.tune || !rig.power) return null;
    var pv = rig.piv; pv.updateMatrixWorld(true);
    var p = pv.worldToLocal(new V3(pt.x, pt.y, pt.z));
    var dt = Math.hypot(p.x - rig.tune.front.x, p.y - rig.tune.front.y), dp = Math.hypot(p.x - rig.power.front.x, p.y - rig.power.front.y);
    if (dt < rig.tune.r * 1.6 && dt < dp) return "tune";
    if (dp < rig.power.r * 1.6) return "power";
    return null;
  }
  /* clic sobre la radio en la mano (computador): perilla derecha = girarla; perilla izquierda (o el cuerpo) = encender o apagar */
  function practiceObjClick(e) {
    if (S.view !== "act" || PR.mode !== "radio") return;
    var pt = e && e.detail && e.detail.intersection && e.detail.intersection.point;
    if (knobAt(pt) === "tune") { if (TU.state.on) turnKnob(-Math.PI / 6); return; }
    radioSet({ on: !TU.state.on });
  }

  /* ---------- linterna en la mano ---------- */
  function torchRig(piv, o) {
    var btns = [], box = new THREE.Box3();
    o.traverse(function (n) { if (n.isMesh && /^Interruptor/.test(n.name)) { btns.push({ m: n, x0: n.position.x }); box.union(relBox(piv, n)); } });
    if (box.isEmpty()) return { rb: 0.016, yb: 0.04, btns: btns, rest: null, pressed: false };
    return { rb: box.max.x, yb: (box.min.y + box.max.y) / 2, btns: btns, rest: null, pressed: false };
  }
  function pressBtn(rg, on) { rg.btns.forEach(function (b) { b.m.position.x = on ? b.x0 - 0.07 : b.x0; }); }
  /* ¿qué mano la tiene? La que la agarró. Si la otra mano se acerca a la linterna (palma a menos de 6 cm), pasa a esa mano. */
  var TORCH_GRIP = { n: 0.028, f: -0.008 }, TX = new V3(), TC = new V3();
  function torchHand(H) {
    var cur = W.torchHand, now = performance.now(), other = cur === "left" ? "right" : "left";
    if (cur && H.tracked(cur)) {
      W.torchSeen = now;
      var og = H.tracked(other) && H.grip(other);
      if (og && og.getWorldPosition(TC).distanceTo(W.heldEl.object3D.getWorldPosition(TX)) < 0.06) { W.torchHand = other; W.torchPose = null; if (PR.trig) { PR.trig.rest = null; PR.trig.pressed = false; } return other; }
      return cur;
    }
    if (cur && now - (W.torchSeen || 0) < 700) return null;
    var pick = H.tracked("right") ? "right" : H.tracked("left") ? "left" : null;
    if (pick !== cur) { W.torchHand = pick; W.torchPose = null; if (PR.trig) { PR.trig.rest = null; PR.trig.pressed = false; } }
    if (pick) W.torchSeen = now;
    return pick;
  }
  /* agarre con las articulaciones: el mango va por la línea de los nudillos (cabeza hacia el índice y el pulgar), dentro del puño */
  function torchFrame(H, side) {
    if (!handFrame(H, side, TORCH_GRIP)) return false;
    HP2.copy(FC);
    TX.crossVectors(FA, FFw); HM.makeBasis(TX, FA, FFw); HQ.setFromRotationMatrix(HM);   // Y del agarre = eje de la linterna
    var tp = W.torchPose;
    if (tp && tp.side === side) { tp.p.lerp(HP2, 0.5); tp.q.slerp(HQ, 0.5); HP2.copy(tp.p); HQ.copy(tp.q); }
    else tp = W.torchPose = { side: side, p: HP2.clone(), q: HQ.clone() };
    return true;
  }
  /* la linterna gira sobre su eje y se desliza a lo largo de él para que el BOTÓN quede bajo la yema del dedo (TORCH_FINGER). «rest» es la
     posición de reposo de esa yema; presionar = la yema se hunde 6 mm o más hacia el eje; soltar = vuelve. */
  function torchFit(side) {
    var pv = W.heldObj && W.heldObj.piv, rg = PR.trig; if (!pv || !rg) return;
    if (!W.torchJ) { pv.position.set(0, 0, 0); pv.quaternion.copy(QX); rg.rest = null; rg.pressed = false; pressBtn(rg, W.lightOn); return; }
    var ft = side && FFX.hands.joint(side, TORCH_FINGER, JI);
    if (!ft) { pressBtn(rg, W.lightOn); return; }
    var h = W.heldEl.object3D; h.updateMatrixWorld(true);
    var T = h.worldToLocal(ft), now = performance.now();
    if (!rg.rest) rg.rest = T.clone();
    var rT = Math.hypot(T.x, T.z), rR = Math.hypot(rg.rest.x, rg.rest.z);
    if (!rg.pressed && rT < rR - 0.006) { rg.pressed = true; rg.since = now; }
    else if (rg.pressed && (rT > rR - 0.003 || now - rg.since > 4000)) { rg.pressed = false; if (now - rg.since > 4000) rg.rest.copy(T); }
    if (!rg.pressed) rg.rest.lerp(T, 0.05);
    var th = Math.atan2(-rg.rest.z, rg.rest.x);
    pv.quaternion.setFromAxisAngle(YUP, th);
    var sr = clamp(rR - rg.rb - 0.004, -0.006, 0.012), sy = clamp(rg.rest.y - rg.yb, -0.09, 0.03);
    pv.position.set(Math.cos(th) * sr, sy, -Math.sin(th) * sr);
    pressBtn(rg, rg.pressed || W.lightOn);
  }
  function startTorch(side) {
    PR = { mode: "torch", flashes: 0, last: null, log: "", err: null, done: false, flashLog: -1 };
    W.torchHand = side || null; W.torchPose = null;
    setHeld("torch", 0.19, function (piv, o) { piv.quaternion.copy(QX); attachBeam(piv, o, 0.55); PR.trig = torchRig(piv, o); torchLight(false); });
  }

  /* ---------- luz de la linterna (lente encendida, cono de luz y foco) ---------- */
  /* ---------- LUZ DE LA LINTERNA ----------
     · Haz visible: un cono abierto (TORCH_ANGLE) con material propio: brilla junto al lente, se desvanece a lo largo y en los bordes
       (no se ve como una línea ni como un cono sólido). Llega hasta la superficie que alumbra.
     · Luz sobre lo virtual: SpotLight (Mateo, bases, base del diorama) + el término de linterna del toon shader (escenario, radio, linterna).
     · Mancha de luz sobre la superficie: en realidad mixta la mesa es real y ninguna luz de Three.js la ilumina; se dibuja una mancha cálida
       en el plano de la mesa (y = 0 de la experiencia, la superficie elegida al colocarla) o sobre el pasto del diorama, donde apunta el haz,
       alargada según el ángulo.
     · Encendido y apagado suaves (unos 45 ms: los destellos del Morse siguen siendo nítidos). Todo sigue la orientación de la linterna. */
  var TORCH_ANGLE = 0.62, POOL = null;
  function beamMat() {
    return new THREE.ShaderMaterial({ uniforms: { uK: { value: 0 }, uColor: { value: new THREE.Color(0xfff0c8) } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: "varying float vA; varying vec3 vN; varying vec3 vV; void main(){ vA = uv.y; vec4 mv = modelViewMatrix * vec4( position, 1.0 ); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }",
      fragmentShader: "uniform float uK; uniform vec3 uColor; varying float vA; varying vec3 vN; varying vec3 vV; void main(){ float f = abs( dot( normalize( vN ), normalize( vV ) ) ); float a = pow( vA, 1.3 ) * pow( f, 1.5 ) * 0.75 * uK; gl_FragColor = vec4( uColor * a, a ); }" });
  }
  function attachBeam(parent, obj, len) {
    var s = obj.userData.size, top = s.y / 2 + 0.002;
    var lens = W.beam.lens.clone(); lens.material = W.beam.lens.material.clone(); lens.scale.setScalar(s.x * 0.42); lens.position.y = top; lens.rotation.x = -Math.PI / 2; parent.add(lens);
    var cone = new THREE.Mesh(W.beam.cone.geometry, beamMat()); cone.rotation.x = Math.PI; cone.renderOrder = 6; parent.add(cone);
    var spot = W.spot; spot.position.set(0, top, 0); spot.target.position.set(0, top + 1, 0); parent.add(spot); parent.add(spot.target);
    parent.userData.lens = lens; parent.userData.cone = cone; parent.userData.top = top; parent.userData.len = len || 0.6;
    setBeamLen(parent, parent.userData.len);
  }
  function setBeamLen(p, L) { var c = p.userData.cone, r = L * Math.tan(TORCH_ANGLE) * 0.9; c.scale.set(r, L, r); c.position.y = p.userData.top + L / 2; }
  function torchLight(on) {
    W.lightOn = !!on; W.lightTarget = on ? 1 : 0;
    if (PR.trig && PR.mode === "torch") pressBtn(PR.trig, on || PR.trig.pressed);
  }
  function makePool() {
    var tex = radial([[0, "rgba(255,246,214,1)"], [0.35, "rgba(255,232,170,.75)"], [0.7, "rgba(255,214,130,.25)"], [1, "rgba(255,214,130,0)"]]);
    var g = new THREE.Group(), m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, fog: false }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 5; g.add(m); g.userData.m = m; g.visible = false; worldEl.object3D.add(g); return g;
  }
  var TP = new V3(), TD = new V3(), TQ = new THREE.Quaternion();
  function torchFx(dt) {
    var target = W.lightTarget || 0, lvl = W.lightLevel || 0;
    lvl += (target - lvl) * (1 - Math.exp(-dt / 45)); if (Math.abs(target - lvl) < 0.002) lvl = target; W.lightLevel = lvl;
    var held = W.heldObj && W.heldObj.kind === "torch" && W.heldEl.object3D.visible ? W.heldObj.piv : null, src = held || W.demoTorch;
    [W.heldObj && W.heldObj.kind === "torch" ? W.heldObj.piv : null, W.demoTorch].forEach(function (p) {
      if (!p || !p.userData.lens) return; var on = p === src ? lvl : 0;
      p.userData.lens.material.opacity = on; p.userData.cone.material.uniforms.uK.value = on;
    });
    if (W.spot) W.spot.intensity = src ? 9 * lvl : 0;
    TORCH_U.uTorchK.value = src ? lvl : 0;
    if (!POOL) POOL = makePool();
    if (!src || lvl < 0.01) { POOL.visible = false; return; }
    src.updateMatrixWorld(true);
    src.localToWorld(TP.set(0, src.userData.top, 0)); TD.set(0, 1, 0).transformDirection(src.matrixWorld);
    TORCH_U.uTorchPos.value.copy(TP); TORCH_U.uTorchDir.value.copy(TD);
    /* dónde cae el haz: el plano de la mesa (o el pasto del diorama, 1,2 cm más arriba) en coordenadas de la experiencia */
    var wo = worldEl.object3D; wo.updateMatrixWorld(true);
    var lp = wo.worldToLocal(TP.clone()), ld = TD.clone().applyQuaternion(wo.getWorldQuaternion(TQ).invert());
    var hit = null, t = 0;
    if (ld.y < -0.06) {
      t = (0 - lp.y) / ld.y; hit = lp.clone().addScaledVector(ld, t);
      var dx = (hit.x - MATEO.x) / DIO.s, dz = (hit.z - MATEO.z) / DIO.s;
      if (dx > -17.6 && dx < 16 && dz > -29 && dz < 5.9) { t = (DIO.base - lp.y) / ld.y; hit = lp.clone().addScaledVector(ld, t); }
    }
    if (held) setBeamLen(src, hit ? clamp(t, 0.06, 1.4) : 0.7);
    if (!hit || t > 2) { POOL.visible = false; return; }
    var r = t * Math.tan(TORCH_ANGLE) + 0.02, e = 1 / Math.max(0.3, -ld.y);
    POOL.visible = true; POOL.position.set(hit.x, hit.y + 0.002, hit.z); POOL.rotation.set(0, Math.atan2(ld.x, ld.z), 0);
    POOL.userData.m.scale.set(r * 2, r * 2 * e, 1);
    POOL.userData.m.material.opacity = lvl * 0.75 * clamp(1.35 - t / 1.4, 0.15, 1);
  }

  /* =====================================================================================
     LINTERNA Y CÓDIGO MORSE
     Momento 1: la linterna de la base destella sola: corto, largo… (la tarjeta muestra cuál es cuál, sin párrafos).
     Momento 2: el usuario la agarra, la enciende y la apaga (tres destellos).
     Momento 3: SOS · · · — — — · · ·. Cada destello se compara con el que toca; si no corresponde, se marca en rojo, Mateo explica cómo
     corregirlo y a los 5 s se borran el error y el aviso. Al completarlo: felicitación y «Terminar práctica».
     ===================================================================================== */
  function startDemo() {
    var s = W.slots.linterna; if (S.phase !== "m1" || !s.obj) return;
    if (!s.demo) {   // la linterna de la base, de pie, con su lente y su cono de luz hacia arriba
      var o = s.obj, piv = new THREE.Group(), half = o.userData.size.y / 2;
      piv.position.y = half; o.parent.remove(o); o.position.y = -half; piv.add(o); s.holder.add(piv); tagEl(piv, s.el);
      attachBeam(piv, o, 0.05); s.demo = piv;   // haz corto, proporcional a la linterna pequeña
    }
    W.demoTorch = s.demo; demoLoop();
  }
  function demoLoop() {
    if (S.phase !== "m1" || S.grabbed) return;
    var blink = function (which, ms, pause, next) {
      PR.demo = which; renderCard(); torchLight(true); AU.click(true);
      later(ms, function () { torchLight(false); AU.click(false); PR.demo = -1; renderCard(); later(pause, next); });
    };
    blink(0, 260, 1000, function () { if (S.phase === "m1" && !S.grabbed) blink(1, 900, 1600, demoLoop); });
  }
  function clearDemo() {
    var p = W.demoTorch; if (!p) return;
    torchLight(false); W.demoTorch = null;
    if (p.userData.lens) { p.userData.lens.material.opacity = 0; p.userData.cone.material.uniforms.uK.value = 0; }
  }
  function flashDemoUI() {
    return { t: "custom", h: 112, draw: function (ctx, x, y, w, h) {
      var cw = (w - 12) / 2;
      [["CORTO", "."], ["LARGO", "-"]].forEach(function (d, i) {
        var cx = x + i * (cw + 12), on = PR.demo === i;
        UI.rr(ctx, cx, y, cw, h, 16); ctx.fillStyle = on ? "#10203a" : "#2a2d3a"; ctx.fill();
        if (on) { ctx.lineWidth = 3; ctx.strokeStyle = C.signal; ctx.stroke(); ctx.shadowColor = C.signal; ctx.shadowBlur = 22; }
        ctx.fillStyle = on ? C.signal : "rgba(255,255,255,.35)";
        if (d[1] === ".") { ctx.beginPath(); ctx.arc(cx + cw / 2, y + 42, 13, 0, Math.PI * 2); ctx.fill(); } else { UI.rr(ctx, cx + cw / 2 - 34, y + 31, 68, 22, 11); ctx.fill(); }
        ctx.shadowColor = "transparent";
        UI.drawText(ctx, { size: 16, weight: 800, align: "center", color: on ? "#fff" : "rgba(255,255,255,.6)", text: d[0] }, cx, y + 74, cw, true);
      });
    } };
  }
  function flashCountUI() {
    return { t: "custom", h: 64, draw: function (ctx, x, y, w, h) {
      UI.rr(ctx, x, y, w, h, 14); ctx.fillStyle = "#10203a"; ctx.fill();
      for (var i = 0; i < 3; i++) {
        var cx = x + 34 + i * 46, on = i < PR.flashes;
        ctx.fillStyle = on ? C.signal : "rgba(255,255,255,.15)"; if (on) { ctx.shadowColor = C.signal; ctx.shadowBlur = 14; }
        ctx.beginPath(); ctx.arc(cx, y + h / 2, 15, 0, Math.PI * 2); ctx.fill(); ctx.shadowColor = "transparent";
      }
      var t = W.lightOn ? "¡Encendida!" : PR.last ? "Último: " + (PR.last === "." ? "corto ·" : "largo —") : "Apagada";
      UI.drawText(ctx, { size: 15, weight: 700, color: W.lightOn ? C.signal : "#f3e6c4", text: t }, x + 178, y + h / 2 - 10, w - 186, true);
    } };
  }
  /* SOS: el objetivo de nueve destellos en tres grupos (S · O · S); los hechos en amarillo, el siguiente con borde, el error en rojo */
  var SOS = "...---...", ERR_MS = 5000, MCTX = null;
  function sosUI() {
    return { t: "custom", h: 92, draw: function (ctx, x, y, w, h) {
      UI.rr(ctx, x, y, w, h, 14); ctx.fillStyle = "#10203a"; ctx.fill();
      var gw = (w - 24) / 3, n = PR.log.length, errI = PR.err ? PR.err.idx : -1;
      for (var g = 0; g < 3; g++) {
        var gx = x + 12 + g * gw;
        UI.drawText(ctx, { size: 15, weight: 800, align: "center", color: "rgba(255,255,255,.55)", text: g === 1 ? "O" : "S" }, gx, y + 62, gw, true);
        for (var k = 0; k < 3; k++) {
          var i = g * 3 + k, sym = SOS[i], cx = gx + gw / 2 + (k - 1) * (sym === "." ? 26 : 34), cy = y + 34;
          var col = i === errI ? "#ff5a4a" : i < n ? C.signal : "rgba(255,255,255,.18)";
          ctx.fillStyle = col; if (i === errI || PR.flashLog === i) { ctx.shadowColor = col; ctx.shadowBlur = 14; }
          if (i === errI) { var es = PR.err.got; if (es === ".") { ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill(); } else { UI.rr(ctx, cx - 15, cy - 7, 30, 14, 7); ctx.fill(); } }
          else if (sym === ".") { ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill(); } else { UI.rr(ctx, cx - 15, cy - 7, 30, 14, 7); ctx.fill(); }
          ctx.shadowColor = "transparent";
          if (i === n && !PR.err && !PR.done) { ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; if (sym === ".") { ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.stroke(); } else { UI.rr(ctx, cx - 19, cy - 11, 38, 22, 11); ctx.stroke(); } }
        }
      }
    } };
  }
  function morseName(s) { return s === "." ? "un destello corto" : "un destello largo"; }
  /* aviso de error: grande y legible en las gafas, con la cuenta regresiva de los 5 s */
  function morseWarn() {
    var e = PR.err, left = Math.max(1, Math.ceil((e.until - performance.now()) / 1000));
    var title = { size: 21, weight: 800, lh: 1.2, color: "#b3261e", text: "La secuencia no es correcta" };
    var spec = { size: 15.5, weight: 700, lh: 1.4, color: "#7a1f15", text: "Aquí iba " + morseName(e.expect) + ". En " + left + " s empezamos de nuevo desde cero." };
    if (!MCTX) MCTX = document.createElement("canvas").getContext("2d");
    return { t: "custom", mt: 8, h: function (w) { return Math.max(70, UI.drawText(MCTX, title, 0, 0, w - 70, false) + UI.drawText(MCTX, spec, 0, 0, w - 70, false) + 30); }, draw: function (ctx, x, y, w, h) {
      UI.rr(ctx, x, y, w, h, 14); ctx.fillStyle = "#fde3df"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "#c0392b"; ctx.stroke();
      ctx.fillStyle = "#c0392b"; ctx.beginPath(); ctx.arc(x + 30, y + h / 2, 17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = UI.font(22, 800); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("!", x + 30, y + h / 2 + 1); ctx.textAlign = "left";
      var th = UI.drawText(ctx, title, x + 58, y + 12, w - 70, true);
      UI.drawText(ctx, spec, x + 58, y + 16 + th, w - 70, true);
    } };
  }
  /* cada destello se compara con el que toca en el SOS. Si no corresponde: se marca en rojo, aparece el aviso, Mateo explica cómo corregirlo y
     durante 5 s no se registran destellos. A los 5 s exactos se borran el aviso y TODA la secuencia: la práctica vuelve a empezar desde cero. */
  function morseInput(sym) {
    if (PR.err || PR.done) return false;
    var expect = SOS[PR.log.length];
    PR.log += sym; PR.flashLog = PR.log.length - 1;
    if (sym !== expect) {
      var err = PR.err = { idx: PR.log.length - 1, expect: expect, got: sym, until: performance.now() + ERR_MS };
      AU.blip(); if (W.char && W.char.api) W.char.api.gesture("shake");
      say((expect === "." ? "¡Casi! Ese fue largo y aquí iba uno corto: presiona y suelta rápido." : "¡Casi! Ese fue corto y aquí iba uno largo: mantén el botón un poco más, como contando «uno, dos».") + " Empezamos de nuevo en 5 segundos.");
      [1, 2, 3, 4].forEach(function (i) { later(i * 1000, function () { if (PR.err === err) renderCard(); }); });   // cuenta regresiva
      later(ERR_MS, function () { if (PR.err !== err) return; PR.log = ""; PR.err = null; PR.flashLog = -1; S.coach = null; renderCard(); coachLine(); });
    } else if (PR.log === SOS) torchSuccess();
    else coachLine();
    return true;
  }
  function torchSuccess() {
    PR.done = true; S.done.linterna = true; celebrate();
    say("¡Lo lograste! Con la luz TRANSMITISTE un mensaje: SOS, que significa «necesito ayuda».");
  }
  /* el botón de la linterna (mano en el Quest, clic sostenido en el computador): corto (< 0,4 s) = punto, largo = raya */
  var pressT = 0, torchDown = false;
  function torchPress(down) {
    var ok = S.view === "act" && PR.mode === "torch" && (S.phase === "m2" || S.phase === "m3");
    if (!ok) { if (!down && pressT) { pressT = 0; torchLight(false); } return; }
    if (down) { if (pressT) return; pressT = performance.now(); torchLight(true); AU.click(true); renderCard(); return; }
    if (!pressT) return;
    var d = performance.now() - pressT; pressT = 0; torchLight(false); AU.click(false);
    torchSymbol(d < 400 ? "." : "-");
  }
  function torchSymbol(sym) {
    if (S.phase === "m2") { PR.flashes++; PR.last = sym; renderCard(); coachLine(); }
    else if (S.phase === "m3") { if (morseInput(sym)) renderCard(); }
  }
  function flash(ms, cb) { torchLight(true); AU.click(true); later(ms, function () { torchLight(false); AU.click(false); if (cb) cb(); }); }
  function playSos() {
    if (PR.playing) return;
    var i = 0; PR.playing = true;
    var stepF = function () {
      if (i >= SOS.length || S.phase !== "m3") { PR.playing = false; return; }
      flash(SOS[i] === "." ? 220 : 650, function () { i++; later(i === 3 || i === 6 ? 650 : 250, stepF); });
    };
    stepF();
  }

  /* =====================================================================================
     CIERRE
     ===================================================================================== */
  function closing() {
    go("end"); S.item = null; showSlots(ORDER);
    say("¡Gracias por ayudarme! Ahora sé que, aunque no haya señal, podemos comunicarnos.");
    later(300, celebrate);
    updateTags();
    seqCard({ stripe: C.signal, items: [
      { t: "kicker", color: C.gold, text: "Free Frequency · Cauca" },
      { t: "h2", text: "¡Recorrido terminado!" },
      learningsUI(),
      { t: "text", size: 19, weight: 800, italic: true, lh: 1.3, align: "center", color: C.ink, text: "Cuando la señal se apaga, la comunicación no.", mt: 12, mb: 14 },
      { t: "buttons", align: "center", list: [{ id: "restart", label: "Volver a empezar", kind: "signal" }, { id: "to-hub", label: "Repetir una actividad", kind: "outline" }] }
    ] });
  }
  function learningsUI() {
    return { t: "custom", h: 104, draw: function (ctx, x, y, w, h) {
      var cw = (w - 12) / 2;
      [["RADIO", "Recibir información", "#a64630", "in"], ["LINTERNA", "Transmitir información", "#5f5a92", "out"]].forEach(function (d, i) {
        var cx = x + i * (cw + 12);
        UI.rr(ctx, cx, y, cw, h, 16); ctx.fillStyle = d[2]; ctx.fill();
        /* flecha: hacia dentro (recibir) o hacia fuera (transmitir) */
        ctx.strokeStyle = C.signal; ctx.lineWidth = 4; ctx.lineCap = "round"; var ax = cx + cw / 2, ay = y + 26;
        ctx.beginPath(); ctx.moveTo(ax - 18, ay); ctx.lineTo(ax + 18, ay); ctx.stroke();
        var tip = d[3] === "in" ? ax - 18 : ax + 18, sg = d[3] === "in" ? 1 : -1;
        ctx.beginPath(); ctx.moveTo(tip + sg * 9, ay - 8); ctx.lineTo(tip, ay); ctx.lineTo(tip + sg * 9, ay + 8); ctx.stroke();
        UI.drawText(ctx, { size: 17, weight: 800, align: "center", color: "#fff", text: d[0] }, cx, y + 44, cw, true);
        UI.drawText(ctx, { size: 13.5, weight: 600, align: "center", color: "#f6ecd6", text: d[1] }, cx + 6, y + 70, cw - 12, true);
      });
    } };
  }

  /* =====================================================================================
     ACCIONES (botones de los paneles)
     ===================================================================================== */
  function act(id) {
    AU.unlock();
    if (id === "replace") { FFX.placement.start(); return; }
    if (id === "sound") { AU.setEnabled(!AU.enabled()); toolsCard(); return; }
    if (id === "to-hub") { hub(false); return; }
    if (id === "restart") { S.done = { radio: false, linterna: false }; hub(true); return; }
    if (id.indexOf("choose:") === 0) { if (S.view !== "hub") hub(false); slotSelect(id.slice(7)); return; }
    if (id === "take") { grabObject(null); return; }
    if (id === "drop") { releaseObject(); return; }
    /* radio */
    if (id === "power") { radioSet({ on: !TU.state.on }); return; }
    if (id.indexOf("band:") === 0) { radioSet({ band: id.slice(5) }); return; }
    if (id === "dial-" || id === "dial+") { if (TU.state.on) radioSet({ pos: clamp(TU.state.pos + (id === "dial+" ? 2 : -2), 0, 100) }); return; }
    if (id === "dial") return;
    if (id === "radio-next") { if (S.done.linterna) closing(); else startActivity("linterna"); return; }
    /* linterna */
    if (id === "dot" || id === "dash") {
      if (S.phase !== "m2" && S.phase !== "m3") return;
      var sym = id === "dot" ? "." : "-", ms = sym === "." ? 220 : 650;
      if (S.phase === "m3" && (PR.err || PR.done)) return;
      flash(ms); torchSymbol(sym); return;
    }
    if (id === "torch-sos") { S.phase = "m3"; PR.log = ""; PR.err = null; PR.done = false; renderCard(); coachLine(); return; }
    if (id === "sos-demo") { playSos(); return; }
    if (id === "clear") { PR.log = ""; PR.err = null; PR.flashLog = -1; S.coach = null; renderCard(); coachLine(); return; }
    if (id === "torch-end") { if (S.done.radio) closing(); else { startActivity("radio"); } return; }
  }

  /* =====================================================================================
     CADA FOTOGRAMA
     ===================================================================================== */
  window.FFApp = { act: function (id) { act(id); }, state: function () { return { view: S.view, item: S.item, phase: S.phase, done: S.done, mode: PR.mode, log: PR.log, light: W.lightOn, radio: TU.state, hover: S.hover, grabbed: S.grabbed, heldKind: W.heldKind }; }, debug: function () { return { PR: PR, W: W, S: S }; } };
  AFRAME.registerComponent("vr-hit", {});
  AFRAME.registerComponent("ff-app", {
    init: function () {
      sceneEl = this.el; root = sceneEl.object3D; camEl = FFX.byId("cam");
      lobbyEl = FFX.byId("lobby"); worldEl = FFX.byId("world");
      var start = function () {
        buildWorldPanels(); buildScanPanel();
        UI.loadFonts().then(function () { var l = FFX.byId("ff-loading"); l.style.opacity = 0; setTimeout(function () { l.remove(); }, 700); });
        enterZone();   // vista previa en el computador: el Cauca con Mateo directamente (en el Quest empieza al colocar la experiencia)
        sceneEl.addEventListener("enter-vr", function () { AR = true; S.arStarted = false; arApply(); });
        sceneEl.addEventListener("exit-vr", function () { AR = false; arApply(); });
        var FOV0 = 70, zoomTo = function (f) { if (sceneEl.is("vr-mode")) return; camEl.setAttribute("camera", "fov", clamp(f, 25, 95)); };
        sceneEl.canvas.addEventListener("wheel", function (e) { e.preventDefault(); zoomTo(camEl.getAttribute("camera").fov + (e.deltaY > 0 ? 4 : -4)); }, { passive: false });
        window.addEventListener("keydown", function (e) {
          var f = camEl.getAttribute("camera").fov;
          if (e.key === "+" || e.key === "=" || e.code === "NumpadAdd") zoomTo(f - 6);
          else if (e.key === "-" || e.key === "_" || e.code === "NumpadSubtract") zoomTo(f + 6);
          else if (e.key === "0" || e.code === "Numpad0") zoomTo(FOV0);
        });
        /* clic en el dial de la radio: posición exacta */
        P.seq.el.addEventListener("click", function (e) {
          var hit = e.detail && e.detail.intersection; if (!hit || !hit.uv || PR.mode !== "radio" || !TU.state.on) return;
          var r = P.seq.regions.filter(function (q) { return q.id === "dial"; })[0]; if (!r) return;
          var x = hit.uv.x * P.seq.W, y = (1 - hit.uv.y) * P.seq.H; if (y < r.y || y > r.y + r.h || x < r.x || x > r.x + r.w) return;
          radioSet({ pos: Math.round(clamp((x - r.x - 10) / (r.w - 20) * 100, 0, 100)) });
        });
      };
      if (sceneEl.hasLoaded) start(); else sceneEl.addEventListener("loaded", start);
    },
    tick: function (time, dt) {
      if (!P.seq) return;
      scanTick();
      if (FFX.placement.state === "placing" || !W.char) return;   // mientras se escanea, la experiencia está oculta: no se anima nada
      var t = time / 1000, camPos = camEl.object3D.getWorldPosition(new V3()), now = performance.now(), c = W.char;
      turnToUser(dt, camPos);
      c.look = now < (W.pointUntil || 0) && W.pointAt ? W.pointAt : camPos;
      c.farewell = now < (W.waveUntil || 0);
      c.update(t);
      followBubble(camPos);
      slotsUpdate(t, dt);
      placeHeld(dt);
      handGestures(dt);
      if (S.view === "act" && PR.mode === "radio") { radioKnobs(); radioDisplay(); wavesUpdate(t); }
      torchFx(dt);
      confettiUpdate(dt);
    }
  });
  /* Mateo de pie en su sitio, girando el cuerpo hacia el usuario (o hacia el objeto que señala) */
  function turnToUser(dt, camPos) {
    var wk = W.walk; if (!wk || !W.cg) return;
    var tgt = performance.now() < (W.pointUntil || 0) && W.pointAt ? W.pointAt : camPos;
    var me = worldEl.object3D.worldToLocal(tgt.clone()), yaw = Math.atan2(me.x - MATEO.x, me.z - MATEO.z);
    var d = yaw - wk.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); wk.yaw += d * Math.min(1, dt / 1000 * 3);
    if (W.char.api) W.char.api.walk = null;
    W.cg.rotation.y = wk.yaw;
  }
  function followBubble(camPos) {
    if (!P.bubble.el.object3D.visible) return;
    var o = P.bubble.el.object3D; o.position.set(MATEO.x + 0.02, BUBBLE_Y, MATEO.z);
    var me = worldEl.object3D.worldToLocal(camPos.clone()); o.rotation.set(0, Math.atan2(me.x - o.position.x, me.z - o.position.z), 0);
  }

  /* =====================================================================================
     GESTOS CON LAS MANOS (Meta Quest, hand tracking)
     ===================================================================================== */
  function handGestures(dt) {
    if (!FFX.immersive()) return;
    var H = FFX.hands;
    if (S.view === "hub") { hubHands(); return; }
    if (S.view !== "act") return;
    if (waitingGrab()) { grabCheck(); return; }
    releaseCheck(dt); if (!S.held || (W.grow || 0) < 0.95) return;   // mientras crece en la mano, aún no responde
    if (PR.mode === "torch") {
      var on = W.torchJ ? !!(PR.trig && PR.trig.pressed) : !!H.pinch(W.torchSide || "right").active;
      if (on !== torchDown) { torchDown = on; torchPress(on); }
    } else if (PR.mode === "radio") radioHands();
  }

  /* =====================================================================================
     COLOCACIÓN (src/main.js detecta las superficies): indicación sencilla que acompaña la mirada
     ===================================================================================== */
  var hudEl = null, scanStatus = "";
  function buildScanPanel() {
    hudEl = FFX.entity(); hudEl._ensureEntity();   // fuera de la raíz: la raíz está oculta mientras se escanea
    P.scan = new UI.Panel({ parent: hudEl, w: 0.34, onClick: act });
    hudEl.object3D.visible = false;
    FFX.placement.on(function (st) {
      hudEl.object3D.visible = st === "placing"; scanStatus = "";
      if (st === "placing") { AU.sceneStop(); torchLight(false); }
      if (st === "placed") {
        arApply();
        /* la primera colocación en realidad aumentada empieza el recorrido (Mateo se presenta); al moverla a otra mesa, todo sigue donde iba */
        if (!S.arStarted) { S.arStarted = true; S.done = { radio: false, linterna: false }; hub(true); }
      }
      UI.refresh();
    });
  }
  function scanSpec(status) {
    return { w: 460, bg: "rgba(10,24,32,.9)", radius: 24, pad: [20, 24, 22, 24], items: [
      { t: "kicker", color: C.peach, text: "Free Frequency · Realidad aumentada" },
      { t: "h1", size: 27, color: "#fff", text: "Mira hacia una superficie donde quieras colocar la experiencia", mb: 10 },
      { t: "text", size: 16, lh: 1.5, weight: 600, color: "rgba(255,255,255,.9)", text: "Cuando el anillo amarillo quede sobre la mesa, pellizca (pulgar + índice) para colocarla.", mb: 12 },
      { t: "text", size: 16, lh: 1.45, weight: 700, color: status.ok ? "#8be0a4" : C.signal, text: status.text }
    ] };
  }
  function scanTick() {
    if (!hudEl || FFX.placement.state !== "placing") return;
    var head = FFX.head(), o = hudEl.object3D, hp = head.getWorldPosition(new V3()), hq = head.getWorldQuaternion(new THREE.Quaternion());
    var d = new V3(0, 0, -1).applyQuaternion(hq), f = new V3(d.x, 0, d.z); if (f.lengthSq() < 1e-4) f.set(0, 0, -1); f.normalize();
    var pitch = clamp(Math.asin(clamp(d.y, -1, 1)) + 0.45, -0.6, 0.2);
    var target = hp.clone().addScaledVector(f, 0.65 * Math.cos(pitch)); target.y = hp.y + 0.65 * Math.sin(pitch);
    if (!o.userData.init) { o.position.copy(target); o.userData.init = true; } else o.position.lerp(target, 0.04);
    o.lookAt(hp);
    var cand = FFX.placement.candidate, late = FFX.placement.since() > 5000;
    var st = cand ? { ok: true, text: (cand.table ? "✓ Mesa detectada." : "✓ Superficie detectada.") + " Pellizca para colocar la experiencia aquí." }
      : late ? { ok: false, text: "¿No aparece el anillo? Acércate a la mesa y mírala de frente. O pellizca para usar una mesa virtual delante de ti." }
      : { ok: false, text: "Buscando superficies…" };
    if (st.text !== scanStatus) { scanStatus = st.text; P.scan.set(scanSpec(st)); }
  }
})();
