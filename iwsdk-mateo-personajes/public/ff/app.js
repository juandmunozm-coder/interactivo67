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
  /* copia «iwsdk-mateo»: la radio y la linterna se ven 2,5 veces más grandes que a la escala de Mateo (OBJ_K): la radio mide unos 2,8 cm de
     ancho y la linterna unos 2,2 cm de largo. Las bases crecen con ellos (unos 3,7 cm) y se separan un poco más de Mateo. */
  var OBJ_K = 2.5;
  var MINI = { radio: 0.27 * CHAR_H / 1.5 * OBJ_K, torch: 0.22 * CHAR_H / 1.5 * OBJ_K }, PS = 0.11;   // PS: escala de las bases (la base mide unos 3,7 cm)
  var SLOT = { radio: [MATEO.x - 0.046, MATEO.z + 0.02], linterna: [MATEO.x + 0.046, MATEO.z + 0.02] };
  /* TARJETAS DENTRO DE LA MAQUETA: de pie sobre el pasto, a unos 4 cm de la base de cada objeto (la de la actividad a la derecha de la
     linterna; la de herramientas a la izquierda de la radio), un poco giradas hacia el usuario. «x»: borde de la tarjeta más cercano al objeto,
     en las coordenadas de la maqueta. Siguen a la maqueta cuando se mueve o se agranda, pero conservan su tamaño (se leen igual). */
  var CARD_GAP = 0.04, BASE_R = 0.168 * PS;
  var CARD = { seq: { x: SLOT.linterna[0] + BASE_R + CARD_GAP, z: SLOT.linterna[1] - 0.004, yaw: -20, w: 0.3 },
    tools: { x: SLOT.radio[0] - BASE_R - CARD_GAP, z: SLOT.radio[1] - 0.004, yaw: 20, w: 0.2 } };
  var BUBBLE_Y = 0.12;   // el globo de Mateo, a la altura de los techos (unos 5 cm sobre su cabeza)
  /* tamaño de la maqueta que eligió el usuario con las manos (1 = original); se conserva mientras dure la visita */
  var MQ = { s: 1, min: 0.6, max: 4 };
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
  /* copia «iwsdk-mateo-modelos»: los modelos nuevos (public/models/, los mismos nombres de piezas que usa el código) */
  var OBJ = { radio: { file: "models/Radio.glb", ref: /^Cuerpo_Radio/ }, torch: { file: "models/Linterna.glb" } };
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
  var P = {}, PR = {}, A = {};   // A: anclas de las tarjetas dentro de la maqueta

  /* =====================================================================================
     MUNDO: diorama del Cauca + Mateo + bases con la radio y la linterna
     ===================================================================================== */
  var W = { zone: null };
  function buildWorld(zone) {
    if (W.zone === zone) return;
    W = { zone: zone, heldEl: W.heldEl, heldBox: W.heldBox, spot: W.spot, beam: W.beam };
    /* MAQUETA: el diorama, Mateo, las montañas, las casas, los árboles y las bases con la radio y la linterna van juntos en un grupo que
       el usuario mueve y agranda con las manos (ver «MAQUETA CON LAS MANOS»). Se escala desde los pies de Mateo (maqEl, sin giro) y su
       hijo (miEl) deshace ese desplazamiento: dentro de miEl valen las mismas coordenadas de siempre (MATEO, SLOT, DIO…). */
    W.maqEl = FFX.entity(); worldEl.appendChild(W.maqEl); W.maqEl.object3D.name = "Maqueta";
    W.maqEl.object3D.position.set(MATEO.x, 0, MATEO.z); W.maqEl.object3D.scale.setScalar(MQ.s);
    W.miEl = FFX.entity(); W.maqEl.appendChild(W.miEl); W.miEl.object3D.position.set(-MATEO.x, 0, -MATEO.z);
    W.mi = W.miEl.object3D;
    var wo = W.mi;
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
      var p = SLOT[id], el = FFX.entity(); el.setAttribute("vr-hit", ""); W.miEl.appendChild(el);   // dentro de la maqueta
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
      var hit = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.05, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hit.position.y = 0.025; box.add(hit);
      var holder = new THREE.Group(); holder.position.y = PED_TOP; box.add(holder);
      tagEl(box, el);
      var kind = kindFor(id);
      var slot = W.slots[id] = { id: id, el: el, holder: holder, ring: ring, halo: halo, pedM: pedM, st: { y: 0, vy: 0, rot: 0, vr: 0 }, phase: i * 1.7, show: 1, target: 1, glow: 0 };
      makeObject(kind, MINI[kind]).then(function (o) { if (W.zone !== zone) return; holder.add(o); tagEl(o, el); o.rotation.y = id === "linterna" ? 0.3 : 0; slot.obj = o; });
      /* etiqueta pequeña, corrida hacia afuera (no tapa a Mateo, que está entre los dos objetos) */
      slot.tag = new UI.Panel({ parent: el, pos: [id === "radio" ? -0.04 : 0.04, 0.035, 0.012], w: 0.08, anchor: "bottom", order: 4 });
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
  /* centro del objeto sobre su base (a la mitad de su alto, con el tamaño actual de la maqueta) */
  function slotCenter(s, out) { slotTop(s, out); out.y += (s.obj ? s.obj.userData.size.y * 0.5 : 0.01) * MQ.s; return out; }
  /* Mateo solo: las bases se ocultan al instante (sin animación); showSlots las hace aparecer creciendo desde cero */
  function hideSlotsNow() {
    Object.keys(W.slots || {}).forEach(function (id) { var s = W.slots[id]; s.target = 0; s.show = 0; s.el.object3D.visible = false; });
    UI.refresh();
  }
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
    /* anclas de las tarjetas: siguen a la maqueta (ver CARD y placeCards) */
    A.seq = FFX.entity(); worldEl.appendChild(A.seq);
    A.tools = FFX.entity(); worldEl.appendChild(A.tools);
    A.loading = FFX.entity(); worldEl.appendChild(A.loading);
    P.loading = new UI.Panel({ parent: A.loading, pos: [0, 0, 0], rot: [-10, 0, 0], w: 0.2, anchor: "bottom", stand: true, spec: { w: 360, bg: "rgba(10,13,22,.8)", radius: 999, pad: [12, 20, 12, 20], items: [{ t: "text", size: 16, weight: 600, align: "center", color: "#fff", text: "Cargando el Cauca y a Mateo…" }] } });
    /* globo de diálogo: sobre la cabeza de Mateo, mirando al usuario (no tapa los objetos, que están más abajo y delante) */
    P.bubble = new UI.Panel({ parent: worldEl, pos: [0, BUBBLE_Y, MATEO.z], w: 0.22, anchor: "bottom", order: 3 });
    /* tarjeta de la actividad (a la derecha de la linterna) y herramientas (a la izquierda de la radio): DENTRO de la maqueta, de pie sobre el
       pasto a unos 4 cm de cada objeto. Cada tarjeta empieza en su ancla (el borde junto al objeto) y se extiende hacia afuera. */
    P.seq = new UI.Panel({ parent: A.seq, pos: [CARD.seq.w / 2, 0, 0], rot: [-6, 0, 0], w: CARD.seq.w, anchor: "bottom", stand: true, onClick: act });
    P.tools = new UI.Panel({ parent: A.tools, pos: [-CARD.tools.w / 2, 0, 0], rot: [-6, 0, 0], w: CARD.tools.w, anchor: "bottom", stand: true, onClick: act });
    placeCards();
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
    /* «Mover a otra mesa» se reemplazó por la maqueta que se mueve y se agranda con las manos: aquí quedan las indicaciones */
    var xr = FFX.immersive(), big = Math.abs(MQ.s - 1) > 0.02;
    P.tools.set({ w: 280, bg: "rgba(10,24,32,.86)", radius: 18, pad: [12, 14, 14, 14], items: [
      { t: "kicker", color: C.peach, text: "Free Frequency" },
      xr ? { t: "text", size: 13, weight: 600, lh: 1.35, color: "#fff", mb: 6, text: "✋ Mover: pon las dos palmas hacia arriba junto a la maqueta y llévala donde quieras." } : null,
      xr ? { t: "text", size: 13, weight: 600, lh: 1.35, color: "#fff", mb: 8, text: "🔍 Agrandar: palmas enfrentadas y sepáralas, o pellizca las dos esquinas de adelante y estíralas." } : null,
      { t: "buttons", size: 13, gap: 6, list: [{ id: "sound", label: AU.enabled() ? "🔊 Sonido" : "🔇 Sin sonido", kind: "light" }, big ? { id: "maq-reset", label: "Tamaño original", kind: "light" } : null] }
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
      (W.mi || worldEl.object3D).add(CONF.g);   // dentro de la maqueta: crece con ella
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
  /* PRESENTACIÓN (copia «iwsdk-mateo»), tres globos seguidos:
     1) Mateo SOLO (sin la radio ni la linterna): «¡Hola, soy Mateo!» durante 5 s.
     2) «Y el día de hoy no tengo señal. ¿Me podrían ayudar?» durante 7 s; al mismo tiempo aparecen la radio (a su izquierda) y la linterna
        (a su derecha), creciendo sobre sus bases.
     3) «¿Cuál de estas dos alternativas me ayudarán?»: se queda hasta que el usuario elige un objeto (solo desde aquí se puede elegir). */
  var INTRO = { start: 700, first: 5000, second: 7000 };
  function hub(intro) {
    go("hub"); S.item = null; S.phase = null; S.hover = null; S.canChoose = false;
    if (intro) {
      hideSlotsNow();   // al empezar, solo Mateo
      later(INTRO.start, function () { say("¡Hola, soy Mateo!", INTRO.first); mateoWave(3500); });
      later(INTRO.start + INTRO.first, function () {
        say("Y el día de hoy no tengo señal. ¿Me podrían ayudar?", INTRO.second); if (W.char.api) W.char.api.gesture("ask");
        showSlots(ORDER); ORDER.forEach(function (id) { kick(W.slots[id], 1.2); }); AU.click(true);   // aparecen los objetos
      });
      later(INTRO.start + INTRO.first + INTRO.second, askChoice);
    } else { showSlots(ORDER); later(400, askChoice); }
  }
  function askChoice() {
    S.canChoose = true; hubCard();
    say("¿Cuál de estas dos alternativas me ayudarán?");
    var i = 0, loop = function () { if (S.view !== "hub") return; mateoPoint(ORDER[i++ % 2], 1900); later(4200, loop); };
    later(600, loop);
  }
  function hubCard() {
    var xr = FFX.immersive();
    seqCard({ items: [
      { t: "kicker", text: "Cauca · Ayuda a Mateo" },
      { t: "h2", text: "Elige una alternativa" },
      { t: "text", size: 16, weight: 600, lh: 1.45, text: xr ? "Toca un objeto con la punta de tu dedo para elegirlo." : "Haz clic en un objeto de la mesa para elegirlo.", mb: 8 },
      (S.done.radio || S.done.linterna) ? { t: "small", text: (S.done.radio ? "✓ Radio  " : "") + (S.done.linterna ? "✓ Linterna" : "") } : null
    ] });
  }
  function setHover(id, src) {
    if (S.view !== "hub" || !S.canChoose) id = null;   // mientras Mateo se presenta, todavía no se elige
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
      var s = W.slots[id], on = S.view === "hub" && S.hover === id;   // en el cierre Mateo queda solo: sin etiquetas
      if (on) s.tag.set({ w: 300, bg: "rgba(251,245,230,.97)", radius: 16, shadow: true, border: S.view === "hub" ? C.signal : null, pad: [10, 14, 12, 14], items: [
        { t: "text", size: 22, weight: 800, align: "center", color: C.ink, text: HUB.name[id].toUpperCase(), mb: 2 },
        { t: "text", size: 15, weight: 700, align: "center", color: C.moss, text: HUB.verb[id], mb: S.view === "hub" ? 6 : 0 },
        S.view === "hub" ? { t: "text", size: 14, weight: 700, align: "center", color: "#b3261e", text: xr ? "☝ Tócalo con tu dedo para elegirlo" : "Clic para elegirlo" } : null] });
      s.tag.show(on);
    });
  }
  function slotClick(id) {
    if (S.view === "hub") { slotSelect(id); return; }
    /* en el computador, clic sobre el objeto elegido = tomarlo (en el Quest se toma con la mano: grabCheck) */
    if (S.view === "act" && id === S.item && waitingGrab() && !FFX.immersive()) grabObject(null);
  }
  function slotSelect(id) {
    if (S.view !== "hub" || !S.canChoose) return;
    AU.unlock(); AU.click(true); kick(W.slots[id], 1.4);
    startActivity(id);
  }
  /* mano cerca de un objeto (Meta Quest): la punta del índice o la palma a menos de 8 cm → se resalta.
     ELEGIR = TOCAR el objeto con la punta del índice (como si lo tocara de verdad); el pellizco junto a él también sirve. */
  var HH = new V3(), HC = new V3(), TOUCH_R = 0.022;   // la yema a menos de 2,2 cm del centro del objeto (crece con la maqueta)
  function hubHands() {
    if (!S.canChoose) return;   // mientras Mateo se presenta, todavía no se elige
    var H = FFX.hands, best = null, bd = 0.08, bside = null, touched = null;   // se resalta el objeto más cercano
    ["left", "right"].forEach(function (side) {
      if (!H.tracked(side)) return;
      var pts = [];
      if (H.joint(side, "index-finger-tip", HH)) {
        pts.push(HH.clone());
        Object.keys(W.slots).forEach(function (id) {
          var s = W.slots[id]; if (!s.el.object3D.visible || !s.target || s.show < 0.9) return;
          if (HH.distanceTo(slotCenter(s, HC)) < Math.max(0.018, TOUCH_R * MQ.s)) touched = id;
        });
      }
      var g = H.grip(side); if (g) pts.push(g.getWorldPosition(new V3()));
      pts.forEach(function (p) {
        Object.keys(W.slots).forEach(function (id) {
          var s = W.slots[id]; if (!s.el.object3D.visible || !s.target) return;
          var d = p.distanceTo(slotCenter(s, HC)); if (d < bd) { bd = d; best = id; bside = side; }
        });
      });
    });
    if (best) setHover(best, "hand"); else if (S.hoverSrc === "hand") setHover(null);
    if (touched) { slotSelect(touched); return; }
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
  /* mano extendida: distancia yema → nudillo de índice, medio y anular ≥ 0,9 × largo de la palma (muñeca → nudillo del medio) y sin pellizcar */
  var HK3 = new V3();
  function handFlat(side) {
    var H = FFX.hands, n = 0, sum = 0;
    if (!H.joint(side, "wrist", HK3) || !H.joint(side, "middle-finger-phalanx-proximal", HK2)) return false;
    var palm = HK3.distanceTo(HK2); if (palm < 0.03) return false;
    ["index", "middle", "ring"].forEach(function (f) { if (H.joint(side, f + "-finger-tip", HK1) && H.joint(side, f + "-finger-phalanx-proximal", HK2)) { sum += HK1.distanceTo(HK2); n++; } });
    return n >= 2 && sum / n / palm > 0.9 && !H.pinch(side).active;
  }
  /* el pulgar se separó del frente de la radio (más de 2,5 cm de su cuerpo): con la mano extendida, la está soltando */
  function thumbOff() {
    var rig = PR.rig, b = rig && rig.body; if (!b || !FFX.hands.joint(PR.holdSide, "thumb-tip", HK1)) return true;
    rig.piv.updateMatrixWorld(true); var L = rig.piv.worldToLocal(HK1);
    var dx = Math.max(b.x0 - L.x, 0, L.x - b.x1), dy = Math.max(b.y0 - L.y, 0, L.y - b.y1), dz = Math.max(b.z0 - L.z, 0, L.z - b.zf);
    return Math.hypot(dx, dy, dz) * rig.piv.scale.x > 0.025;
  }
  function releaseCheck(dt) {
    var side = S.item === "radio" ? PR.holdSide : W.torchHand; if (!side || !FFX.hands.tracked(side)) { S.openT = 0; return; }
    /* la radio se sostiene con la mano medio abierta (los dedos rodean su lateral): se suelta solo con la mano EXTENDIDA (dedos rectos,
       medidos respecto del largo de la palma, así sirve para manos grandes y pequeñas) durante medio segundo */
    var open = S.item === "radio" ? handFlat(side) && thumbOff() : handOpen(side), wait = S.item === "radio" ? 500 : 330;
    if (open) { S.openT += dt; if (S.openT > wait) releaseObject(); } else S.openT = 0;
  }
  function renderCard() {
    if (S.view !== "act") return;
    var xr = FFX.immersive(), items = [], drop = xr ? null : { id: "drop", label: "Soltar", kind: "outline" };
    /* lo soltó: vuelve a su base y se puede agarrar otra vez (la práctica sigue donde iba) */
    if (S.grabbed && !S.held) {
      items.push({ t: "kicker", text: S.item === "radio" ? "Radio · Recibir información" : "Linterna · Transmitir información" });
      items.push({ t: "h2", text: S.item === "radio" ? "Agarra otra vez la radio" : "Agarra otra vez la linterna" });
      items.push({ t: "text", size: 16, weight: 600, lh: 1.45, mb: 12, text: xr ? (S.item === "radio" ? "Tómala por su lado izquierdo con tu mano izquierda: el pulgar adelante." : "Rodéala con una mano y cierra los dedos.") : "Haz clic en el objeto (o en «Tomar»)." });
      items.push({ t: "buttons", list: [xr ? null : { id: "take", label: "Tomar", kind: "signal" }, { id: "to-hub", label: "Elegir otra", kind: "outline" }] });
      seqCard({ items: items }); return;
    }
    if (S.item === "radio") {
      items.push({ t: "kicker", text: "Radio · Recibir información" });
      if (S.phase === "intro") {
        items.push({ t: "h2", text: "Agarra la radio" });
        items.push({ t: "text", size: 16, weight: 600, lh: 1.45, text: xr ? "Tómala por su lado izquierdo con tu mano izquierda: el pulgar adelante y los demás dedos detrás." : "Haz clic en la radio para tomarla.", mb: 12 });
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
    var gs = W.slots[S.item], mini = MINI[kind] * MQ.s / fullSize(kind), e = W.grow * W.grow * (3 - 2 * W.grow);
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
  /* =====================================================================================
     AGARRE DE LA RADIO CON LA MANO IZQUIERDA (copia «iwsdk-mateo»): reemplaza el agarre por la manija.
     Como en la referencia: la mano izquierda sostiene la radio por su LATERAL IZQUIERDO, la palma detrás (contra la cara posterior), los dedos
     rodeando el borde izquierdo por detrás y el PULGAR apoyado sobre el FRENTE. En realidad mixta la mano que se ve es la real (passthrough;
     la malla de la mano solo tapa lo que está detrás de ella, ver src/main.js): no se mueven dedos virtuales, se calcula la pose de la radio
     para que quede encajada en la mano real. Cuatro partes:
     1) MARCO RÍGIDO DE LA MANO (palmFrame): muñeca + nudillos (falanges proximales). No cambia cuando los dedos se doblan: la radio no tiembla.
        Se filtra con un filtro adaptativo (tipo «one euro»): quieto = muy suave; en movimiento = poca latencia.
     2) AJUSTE DEL AGARRE (gripFit), con las articulaciones XRHand: frente de la radio = hacia el pulgar (la palma detrás, los dedos detrás);
        eje largo = hacia donde apunta el pulgar sobre el frente; la yema del pulgar queda sobre el frente, a RG.thumbIn del borde izquierdo.
        Se guarda como pose RELATIVA al marco rígido (RG.g): durante los primeros RG.lockMs se ajusta en cada fotograma y después solo se
        corrige despacio (si la mano cambia un poco el agarre), nunca mientras la mano derecha está en una perilla.
     3) COLISIONES (gripPush): las 25 articulaciones de la mano izquierda, cada una como una esfera (radio aproximado), contra la caja del
        cuerpo de la radio (medida del modelo: rig.body). Si una entra, la radio se corre lo mínimo por la cara más cercana; la corrección se
        suaviza y vuelve despacio cuando la mano deja espacio. Los dedos nunca quedan dentro del cuerpo.
     4) PÉRDIDA DEL SEGUIMIENTO: la radio se queda quieta donde estaba (no sale disparada ni desaparece); al volver la mano, llega a ella en
        unos 0,25 s. La mano DERECHA no la mueve: solo gira las perillas (radioHands).
     ===================================================================================== */
  var RG = { collide: false, palmGap: 0.012, topOver: 0.012, deep: 0.015, maxSlide: 0.012, thumbIn: 0.032, thumbPad: 0.009, lockMs: 400, refine: 0.012, maxPush: 0.015,
    hp: null, hq: null, gp: null, gq: null, o: new V3(), t0: 0, lostT: 0, reacq: 0 };
  var JOINTS = ["wrist", "thumb-metacarpal", "thumb-phalanx-proximal", "thumb-phalanx-distal", "thumb-tip"];
  ["index", "middle", "ring", "pinky"].forEach(function (f) { ["metacarpal", "phalanx-proximal", "phalanx-intermediate", "phalanx-distal", "tip"].forEach(function (p) { JOINTS.push(f + "-finger-" + p); }); });
  /* radio aproximado (m) de cada articulación, como esferas que tocan la piel (WebXR: radio de la articulación) */
  function jointRad(n) { return n === "wrist" ? 0.014 : /tip$/.test(n) ? 0.0075 : /metacarpal/.test(n) ? 0.013 : 0.0095; }
  var JP = JOINTS.map(function () { return new V3(); }), JOK = JOINTS.map(function () { return false; });
  var GP0 = new V3(), GQ0 = new THREE.Quaternion(), GQI = new THREE.Quaternion(), GT = new V3(), GTP = new V3(), GW = new V3(), GI = new V3(), GMD = new V3();
  var RX = new V3(), RY = new V3(), RZ = new V3(), RP = new V3(), RQ = new THREE.Quaternion(), RL = new V3();
  var PALM0R = { n: 0, f: 0 };
  /* 1) marco rígido de la palma: ejes del puño (FA, FFw, FA×FFw) y centro entre la muñeca y los nudillos */
  /* Con MUCHAS articulaciones rígidas promediadas (muñeca, 4 metacarpianos y 4 nudillos): el ruido de cada una casi se cancela.
     Deja FA, FFw, FN, FK y FJ.w como handFrame (los usa gripFit). Necesita readJoints antes. */
  var PJ = { w: 0, im: 0, ip: 0, mm: 0, mp: 0, rm: 0, rp: 0, pm: 0, pp: 0 }, PA = new V3(), PB = new V3();
  (function () { var f = { im: "index-finger-metacarpal", ip: "index-finger-phalanx-proximal", mm: "middle-finger-metacarpal", mp: "middle-finger-phalanx-proximal",
    rm: "ring-finger-metacarpal", rp: "ring-finger-phalanx-proximal", pm: "pinky-finger-metacarpal", pp: "pinky-finger-phalanx-proximal", w: "wrist" };
    Object.keys(f).forEach(function (k) { PJ[k] = JOINTS.indexOf(f[k]); }); })();
  function palmFrame(H, side, outP, outQ) {
    var ok = true; Object.keys(PJ).forEach(function (k) { if (!JOK[PJ[k]]) ok = false; });
    if (!ok) {   // faltan articulaciones: el marco de siempre
      if (!handFrame(H, side, PALM0R)) return false;
    } else {
      var J = function (k) { return JP[PJ[k]]; };
      /* eje del puño: lado del índice (índice + medio) menos lado del meñique (anular + meñique), con nudillos y metacarpianos */
      PA.copy(J("ip")).add(J("mp")).add(J("im")).add(J("mm")); PB.copy(J("rp")).add(J("pp")).add(J("rm")).add(J("pm"));
      FA.subVectors(PA, PB); if (FA.lengthSq() < 1e-6) return false; FA.normalize();
      FK.copy(J("ip")).add(J("mp")).add(J("rp")).add(J("pp")).multiplyScalar(0.25); FJ.w.copy(J("w"));
      /* muñeca → nudillos, con el centro de los metacarpianos para promediar */
      PB.copy(J("im")).add(J("mm")).add(J("rm")).add(J("pm")).multiplyScalar(0.25);
      FFw.subVectors(FK, FJ.w).add(PA.subVectors(FK, PB)); FFw.addScaledVector(FA, -FFw.dot(FA)); if (FFw.lengthSq() < 1e-6) return false; FFw.normalize();
      FN.crossVectors(FA, FFw).multiplyScalar(side === "right" ? 1 : -1);
    }
    RZ.crossVectors(FA, FFw).normalize(); HM.makeBasis(FA, FFw, RZ); outQ.setFromRotationMatrix(HM);
    outP.copy(FK).add(FJ.w).multiplyScalar(0.5);
    return true;
  }
  /* lee las 25 articulaciones de una mano (JP / JOK) */
  function readJoints(H, side) { var n = 0; JOINTS.forEach(function (j, i) { JOK[i] = !!H.joint(side, j, JP[i]); if (JOK[i]) n++; }); return n; }
  /* 2) pose ideal de la radio con la mano actual (mundo): devuelve false si faltan articulaciones */
  /* copia «iwsdk-mateo-modelos» · AGARRE COMO EN LA MANO REAL DEL VISOR (captura del Quest + referencia con puntos XRHand):
     la mano izquierda se pone de lado, con la PALMA mirando hacia la radio (contra su extremo izquierdo), los dedos (5-24) suben y se curvan
     sobre la esquina de arriba a la izquierda y el PULGAR (1-4) queda delante, sobre el frente. Los ejes de la radio salen del marco RÍGIDO de
     la palma (no tiemblan con los dedos):
       X (largo de la radio, hacia la derecha) = normal de la palma (FN, «sale de la palma»)
       Y (arriba)                              = muñeca → nudillos (FFw)
       Z (frente, hacia el usuario)            = X × Y (≈ del meñique al índice: el lado del pulgar)
     Posición: el extremo izquierdo apoyado en la palma (1,2 cm delante del centro de la palma), la cara de arriba 1,2 cm sobre los nudillos
     (los dedos la rodean) y el frente bajo la yema del pulgar, sin que el centro de la mano quede fuera del grosor de la radio. */
  function gripFit(b, outP, outQ) {
    var I = function (n) { return JOINTS.indexOf(n); };
    var it = I("thumb-tip"), iw = I("wrist");
    if (!JOK[iw]) return false;
    RX.copy(FN).normalize();
    RY.copy(FFw).addScaledVector(RX, -FFw.dot(RX)); if (RY.lengthSq() < 1e-6) return false; RY.normalize();
    RZ.crossVectors(RX, RY).normalize();
    HM.makeBasis(RX, RY, RZ); outQ.setFromRotationMatrix(HM);
    GQI.copy(outQ).invert();
    /* coordenadas en los ejes de la radio */
    var pc = RL.copy(FK).add(FJ.w).multiplyScalar(0.5).applyQuaternion(GQI), pcx = pc.x, pcy = pc.y, pcz = pc.z;
    var kn = GMD.copy(FK).applyQuaternion(GQI), kny = kn.y, knz = kn.z;
    var xL = pcx + RG.palmGap, yT = kny + RG.topOver;
    /* frente: bajo la yema del pulgar; el centro de la mano (nudillos) siempre dentro del grosor, a 1 cm de cada cara */
    var th = b.zf - b.z0, zF = JOK[it] ? GT.copy(JP[it]).applyQuaternion(GQI).z - RG.thumbPad : knz + th / 2;
    zF = clamp(zF, knz + 0.01, knz + th - 0.01);
    outP.set(xL - b.x0, yT - b.y1, zF - b.zf).applyQuaternion(outQ);
    return true;
  }
  /* 3) cuánto hay que correr la radio (en sus coordenadas) para que ninguna articulación quede dentro del cuerpo; out = corrección total */
  /* PRIORIDAD: el pulgar (lo que se ve, sobre el frente) se resuelve al final y manda: si la mano real está más cerrada que el grosor de la
     radio (6,2 cm) y no caben a la vez el pulgar delante y la palma detrás, cede la parte de atrás, que queda oculta detrás de la radio.
     (La base del pulgar, «thumb-metacarpal», está junto a la palma: va con las demás.) */
  function gripPush(p, q, b, out) {
    GQI.copy(q).invert(); var minD = 1e9;
    var solve = function (i, measure, xy) {
      var r = jointRad(JOINTS[i]);
      RL.copy(JP[i]).sub(p).applyQuaternion(GQI).sub(out);   // articulación en el espacio de la radio ya corrida
      var pl = RL.x - (b.x0 - r), pr = b.x1 + r - RL.x, pb = RL.y - (b.y0 - r), pt = b.y1 + r - RL.y, pk = RL.z - (b.z0 - r), pf = b.zf + r - RL.z;
      if (measure) { var dx = Math.max(-pl, -pr, 0), dy = Math.max(-pb, -pt, 0), dz = Math.max(-pk, -pf, 0); minD = Math.min(minD, Math.hypot(dx, dy, dz)); return false; }
      if (pl <= 0 || pr <= 0 || pb <= 0 || pt <= 0 || pk <= 0 || pf <= 0) return false;   // fuera de la caja
      var m = xy ? Math.min(pl, pr, pb, pt) : Math.min(pl, pr, pb, pt, pk, pf);   // xy: sin tocar el grosor (lo fija el pulgar)
      /* copia «iwsdk-mateo-modelos»: la mano real se cierra más de lo que mide la radio (no hay nada que la detenga). Un dedo HUNDIDO más de
         1,5 cm no empuja (antes sacaba la radio de la mano, que se veía al lado sin agarrar nada): queda tapado por la radio, como si la rodeara */
      if (m > RG.deep) return false;
      if (xy && m > RG.maxSlide) return false;   // deslizar mucho sacaría el pulgar del frente: ese roce queda oculto detrás de la radio
      if (m === pl) out.x += pl; else if (m === pr) out.x -= pr; else if (m === pb) out.y += pb; else if (m === pt) out.y -= pt; else if (m === pk) out.z += pk; else out.z -= pf;
      return true;
    };
    var i, moved;
    for (var pass = 0; pass < 2; pass++) { moved = false; for (i = 0; i < JOINTS.length; i++) if (JOK[i] && solve(i)) moved = true; if (!moved) break; }
    for (pass = 0; pass < 2; pass++) for (i = 2; i <= 4; i++) if (JOK[i]) solve(i);   // el pulgar visible (falanges y yema) manda
    /* si aún queda un dedo dentro (la mano más cerrada que la radio), se resuelve deslizando la radio hacia arriba, abajo o a los lados,
       sin cambiar su distancia al pulgar: el pulgar sigue apoyado en el frente */
    for (pass = 0; pass < 2; pass++) for (i = 0; i < JOINTS.length; i++) if (JOK[i] && (i < 2 || i > 4)) solve(i, false, true);
    for (i = 2; i <= 4; i++) if (JOK[i]) solve(i);
    if (out.length() > RG.maxPush) out.setLength(RG.maxPush);
    for (i = 0; i < JOINTS.length; i++) if (JOK[i]) solve(i, true);
    return minD;   // distancia de la articulación más cercana al cuerpo (0 = tocándolo)
  }
  /* filtro del marco rígido (radio y linterna; st guarda hp, hq, v, lastT, lostT, reacq) */
  function frameFilter(st, P0, Q0, now) {
    var dtS = clamp((now - (st.lastT || now - 16)) / 1000, 0.004, 0.1); st.lastT = now;
    if (!st.hp) { st.hp = P0.clone(); st.hq = Q0.clone(); st.v = 0; return; }
    var raw = (P0.distanceTo(st.hp) + st.hq.angleTo(Q0) * 0.1) / dtS;
    st.v += (raw - st.v) * 0.25;
    var a = clamp(0.15 + Math.max(0, st.v - 0.25) * 1.6, 0.15, 0.9);
    if (st.lostT) { st.reacq = now + 350; st.lostT = 0; }
    if (now < st.reacq) a = 0.12;
    st.hp.lerp(P0, a); st.hq.slerp(Q0, a);
  }
  var CPUSH = new V3();
  function radioPose(H) {
    var side = PR.holdSide, rig = PR.rig, b = rig && rig.body, now = performance.now();
    if (!W.radioPose) { RG.hp = null; RG.gp = null; RG.o.set(0, 0, 0); RG.t0 = now; }   // agarre nuevo
    if (b && side && H.tracked(side) && readJoints(H, side) >= 12 && palmFrame(H, side, GP0, GQ0)) {
      /* 1) marco rígido con filtro adaptativo (tipo «one euro»): se estima la velocidad de la mano (filtrada, en m/s; el giro cuenta como
         el movimiento de un punto a 10 cm) y el alfa sube con ella: quieta o con temblor del seguimiento ≈ 0,15 (estable); moviéndose
         rápido → 0,9 (casi sin retraso). Al recuperar la mano tras perderla: alfa 0,12 durante 0,35 s (llega sin saltos). */
      frameFilter(RG, GP0, GQ0, now);
      /* 2) agarre relativo al marco: se ajusta al empezar y luego se corrige despacio (nunca con la mano derecha en una perilla) */
      var fitting = !RG.gp || now - RG.t0 < RG.lockMs;
      if ((fitting || !PR.nearKnob) && gripFit(b, RP, RQ)) {
        /* copia «iwsdk-mateo-modelos»: el agarre se mide contra el marco de ESTE fotograma (GP0, GQ0), no contra el filtrado (que va unos
           milisegundos atrás): así, al mover la mano rápido, el agarre no se corre */
        GQI.copy(GQ0).invert();
        var gp = RP.sub(GP0).applyQuaternion(GQI), gq = GQI.multiply(RQ);
        if (!RG.gp) { RG.gp = gp.clone(); RG.gq = gq.clone(); }
        else { var k = fitting ? 0.35 : RG.refine; RG.gp.lerp(gp, k); RG.gq.slerp(gq, k); }
      }
      if (RG.gp) {
        HQ.copy(RG.hq).multiply(RG.gq); HP2.copy(RG.gp).applyQuaternion(RG.hq).add(RG.hp);
        /* 3) colisiones: la corrección mínima se calcula de cero en cada fotograma (no se acumula: si la mano deja espacio, la radio vuelve
           sola a su agarre) y solo se suaviza el resultado (sin saltos ni temblor) */
        /* copia «iwsdk-mateo-modelos»: sin empujes (RG.collide = false). La mano real se dibuja delante de la radio hasta 2,2 cm (FFX.handBias):
           los roces ya se ven bien y la radio queda firme en la palma (los empujes la separaban 1,4 cm de la mano) */
        if (RG.collide) gripPush(HP2, HQ, b, CPUSH.set(0, 0, 0)); else CPUSH.set(0, 0, 0); RG.o.lerp(CPUSH, 0.25);
        HP2.add(tmpV.copy(RG.o).applyQuaternion(HQ));
        if (W.radioPose) { W.radioPose.p.copy(HP2); W.radioPose.q.copy(HQ); } else W.radioPose = { p: HP2.clone(), q: HQ.clone() };
      }
    } else if (W.radioPose && !RG.lostT) RG.lostT = now;   // 4) sin mano: se queda donde estaba
    if (!W.radioPose) return false;
    HP2.copy(W.radioPose.p); HQ.copy(W.radioPose.q);
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
    if (patch.pos !== undefined && s.pos !== b.pos) { if (s.on) AU.dial(s.pos); if (!PR.byKnob) PR.knob = (DIAL0 - s.pos) / KNOB_POS; }   // la perilla y el dial siempre coinciden (girando con los dedos, la perilla sigue el ángulo exacto de los dedos: no salta al redondear el dial)
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
    if (pos !== TU.state.pos) { PR.byKnob = true; radioSet({ pos: pos }); PR.byKnob = false; }
  }
  /* girar la perilla izquierda (encendido): la radio ya se enciende al tomar cualquier perilla; la perilla queda en «encendido» */
  var POWER_ON = 0.6, POWER_REST = 0.9;
  function turnPower(d) {
    PR.pknob = clamp(PR.pknob + d, -1.6, 1.6);
    if (!TU.state.on && Math.abs(PR.pknob) >= POWER_ON) { PR.pknobSign = PR.pknob < 0 ? -1 : 1; radioSet({ on: true }); }
  }
  /* la otra mano sobre las perillas: tomar una perilla entre el pulgar y el índice (o pellizcar sobre ella) y girar la muñeca.
     La radio no se mueve con esta mano: la sostiene la izquierda (radioPose). */
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
    /* copia «iwsdk-mateo»: la mano derecha ya NO empuja la radio (antes PR.push la corría hacia atrás y PR.dropY la bajaba): la radio sigue
       solo a la mano izquierda (radioPose), así no se desestabiliza mientras se giran las perillas. */
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
    var prof = torchProfile(piv, o);
    if (box.isEmpty()) return { rb: 0.016, yb: 0.04, btns: btns, rest: null, pressed: false, prof: prof };
    return { rb: box.max.x, yb: (box.min.y + box.max.y) / 2, btns: btns, rest: null, pressed: false, prof: prof };
  }
  /* PERFIL REAL DE LA LINTERNA (copia «iwsdk-mateo»): radio del cuerpo a lo largo de su eje (Y del pivote; la cabeza con la lente, arriba),
     medido con los vértices del modelo Linterna.glb en 24 tramos. «grip»: radio del mango (la parte de abajo, donde la rodean los dedos). */
  function torchProfile(piv, o) {
    var N = 24, r = [], y0 = 1e9, y1 = -1e9, pts = [], M = new THREE.Matrix4(), v = new V3();
    piv.updateMatrixWorld(true); var inv = new THREE.Matrix4().copy(piv.matrixWorld).invert();
    o.traverse(function (n) {
      if (!n.isMesh || !n.geometry || !n.geometry.attributes.position) return;
      M.multiplyMatrices(inv, n.matrixWorld); var pa = n.geometry.attributes.position;
      for (var i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(M); pts.push(v.y, Math.hypot(v.x, v.z)); if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y; }
    });
    for (var k = 0; k < N; k++) r.push(0);
    for (var j = 0; j < pts.length; j += 2) { var b = Math.min(N - 1, Math.floor((pts[j] - y0) / (y1 - y0) * N)); if (pts[j + 1] > r[b]) r[b] = pts[j + 1]; }
    /* el modelo solo tiene vértices en los anillos de cada tramo: entre anillos, el radio se interpola (la superficie es continua) */
    var raw = r.slice();
    for (k = 0; k < N; k++) {
      var lo = k, hi = k; while (lo > 0 && !raw[lo]) lo--; while (hi < N - 1 && !raw[hi]) hi++;
      var it = raw[lo] && raw[hi] && hi > lo ? raw[lo] + (raw[hi] - raw[lo]) * (k - lo) / (hi - lo) : raw[lo] || raw[hi];
      r[k] = Math.max(raw[k], it || 0);
    }
    var hand = r.slice(0, Math.round(N * 0.6)).filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });
    return { y0: y0, y1: y1, n: N, r: r, grip: hand.length ? hand[Math.floor(hand.length / 2)] : 0.016 };
  }
  function profR(pf, y) { if (!pf || y < pf.y0 || y > pf.y1) return 0; return pf.r[Math.min(pf.n - 1, Math.floor((y - pf.y0) / (pf.y1 - pf.y0) * pf.n))]; }
  function pressBtn(rg, on) { rg.btns.forEach(function (b) { b.m.position.x = on ? b.x0 - 0.07 : b.x0; }); }
  /* ¿qué mano la tiene? La que la agarró. Si la otra mano se acerca a la linterna (palma a menos de 6 cm), pasa a esa mano. */
  var TORCH_GRIP = { n: 0.028, f: -0.008 }, TX = new V3(), TC = new V3();
  function torchHand(H) {
    var cur = W.torchHand, now = performance.now(), other = cur === "left" ? "right" : "left";
    if (cur && H.tracked(cur)) {
      W.torchSeen = now;
      var og = H.tracked(other) && H.grip(other);
      if (og && og.getWorldPosition(TC).distanceTo(W.heldEl.object3D.getWorldPosition(TX)) < 0.06) { W.torchHand = other; W.torchPose = null; TG.switching = true; if (PR.trig) { PR.trig.rest = null; PR.trig.pressed = false; } return other; }
      return cur;
    }
    if (cur && now - (W.torchSeen || 0) < 700) return null;
    var pick = H.tracked("right") ? "right" : H.tracked("left") ? "left" : null;
    /* copia «iwsdk-mateo»: sin ninguna mano, la linterna se queda quieta donde estaba (antes volvía a su base y luego saltaba a la mano) */
    if (!pick) return null;
    if (pick !== cur) { W.torchHand = pick; W.torchPose = null; TG.switching = !!cur; if (PR.trig) { PR.trig.rest = null; PR.trig.pressed = false; } }
    if (pick) W.torchSeen = now;
    return pick;
  }
  /* =====================================================================================
     AGARRE DE LA LINTERNA (copia «iwsdk-mateo»). Antes el mango iba a una distancia FIJA delante de los nudillos (TORCH_GRIP), sin mirar
     cuánto se cierran los dedos ni el grosor real del modelo: la linterna flotaba o los dedos la atravesaban. Ahora, con las 25 articulaciones
     XRHand (0 muñeca · 1-4 pulgar · 5-9 índice · 10-14 medio · 15-19 anular · 20-24 meñique):
     1) MARCO RÍGIDO de la palma (palmFrame: muñeca, metacarpianos y nudillos) con el filtro adaptativo (frameFilter).
     2) EJE de la linterna = la fila de los dedos cerrados: del meñique (20-24) al índice (5-9), con sus falanges proximal, intermedia y distal
        (la cabeza hacia el índice y el pulgar, como en la referencia).
     3) CENTRO = el del hueco que forman los dedos: un círculo de radio conocido (el del mango, medido en el modelo, más el grosor de cada
        dedo) ajustado a las falanges de índice, medio, anular y meñique. Así cada dedo queda apoyado en la superficie: ni dentro ni separado.
        Se guarda relativo al marco rígido: se ajusta al empezar (0,4 s) y luego se corrige despacio, nunca mientras se hunde el botón.
     4) COLISIONES con el perfil real (profR): si una articulación de los dedos entra en el cuerpo (el mango o la cabeza, más ancha), la
        linterna se corre de lado lo mínimo, suavizado. Nunca hacia el pulgar ni lejos de él: el pulgar (1-4) es el que enciende (torchFit).
     5) Sin articulaciones (control o mano sin datos), el agarre de siempre (TORCH_GRIP). */
  var TG = { collide: false, side: null, hp: null, hq: null, gp: null, gq: null, o: new V3(), t0: 0, seen: 0, lockMs: 400, refine: 0.015, maxPush: 0.012 };
  var TFING = ["index", "middle", "ring", "pinky"], TPH = ["phalanx-proximal", "phalanx-intermediate", "phalanx-distal"], TPHR = [0.0105, 0.0095, 0.0085];
  var TA = new V3(), TCc = new V3(), TD = new V3(), TS = new V3(), TZ = new V3(), TXa = new V3(), TP0 = new V3(), TQ0 = new THREE.Quaternion(), TPU = new V3();
  function jIdx(f, p) { return JOINTS.indexOf(f + "-finger-" + p); }
  /* pose ideal (mundo) del eje de la linterna con la mano actual */
  function torchFitPose(pf, outP, outQ) {
    /* eje: lado del índice menos lado del meñique, en las tres filas de falanges */
    TA.set(0, 0, 0);
    for (var k = 0; k < 3; k++) { var a = jIdx("index", TPH[k]), b = jIdx("pinky", TPH[k]); if (JOK[a] && JOK[b]) TA.add(TD.subVectors(JP[a], JP[b])); }
    if (TA.lengthSq() < 1e-6) return false; TA.normalize(); if (TA.dot(FA) < 0) TA.negate();
    /* centro: círculo de radio conocido ajustado a las falanges (punto fijo de Kåsa con radio dado); empieza del lado de la palma */
    var Rk = pf.grip, c0 = TS.copy(FK).addScaledVector(FN, Rk + 0.011), c = TCc.copy(c0), n = 0;
    for (var it = 0; it < 14; it++) {
      TPU.set(0, 0, 0); n = 0;
      TFING.forEach(function (f) { for (var q = 0; q < 3; q++) {
        var i = jIdx(f, TPH[q]); if (!JOK[i]) continue;
        TD.subVectors(c, JP[i]); TD.addScaledVector(TA, -TD.dot(TA)); var L = TD.length(); if (L < 1e-4) continue;
        TPU.add(JP[i]).addScaledVector(TD, (Rk + TPHR[q]) / L); n++;
      } });
      if (n < 6) return false;
      c.copy(TPU.multiplyScalar(1 / n));
    }
    if (c.distanceTo(c0) > 0.06) c.copy(c0);   // mano muy abierta o datos raros: el centro de siempre, en la palma
    /* copia «iwsdk-mateo-modelos»: PUÑO MÁS CERRADO QUE EL MANGO (la mano real no tiene nada que la detenga y se cierra del todo). Entonces
       el círculo de radio fijo quedaba FUERA del puño, delante de los dedos, y la linterna se dibujaba encima de ellos. Se ajusta un círculo
       de radio libre (Kåsa, mínimos cuadrados) a las mismas falanges: si el hueco real es más chico que el mango, la linterna va al centro
       de ese hueco (los dedos quedan alrededor, delante y detrás; la mano se dibuja delante gracias a FFX.handBias). */
    var fr = fistCircle(TA);
    if (fr && fr.r < Rk + 0.009 && fr.c.distanceTo(c0) < 0.06) c.copy(fr.c);
    /* orientación: Y = eje; Z = muñeca → nudillos (sin el componente del eje); X = Y × Z (como antes) */
    TZ.copy(FFw).addScaledVector(TA, -FFw.dot(TA)); if (TZ.lengthSq() < 1e-6) return false; TZ.normalize();
    TXa.crossVectors(TA, TZ); HM.makeBasis(TXa, TA, TZ); outQ.setFromRotationMatrix(HM);
    outP.copy(c);
    return true;
  }
  /* círculo de radio libre (método de Kåsa) en el plano perpendicular al eje, con las falanges de índice, medio, anular y meñique */
  var KU = new V3(), KV = new V3(), KC = new V3();
  function fistCircle(A) {
    KU.copy(FFw).addScaledVector(A, -FFw.dot(A)); if (KU.lengthSq() < 1e-6) return null; KU.normalize(); KV.crossVectors(A, KU);
    var n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sz = 0, sxz = 0, syz = 0, ax = 0;
    TFING.forEach(function (f) { for (var q = 0; q < 3; q++) {
      var i = jIdx(f, TPH[q]); if (!JOK[i]) continue;
      var x = JP[i].dot(KU), y = JP[i].dot(KV), z = x * x + y * y;
      n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sz += z; sxz += x * z; syz += y * z; ax += JP[i].dot(A);
    } });
    if (n < 6) return null;
    /* x² + y² + D x + E y + F = 0 → sistema normal 3 × 3 (regla de Cramer) */
    var M = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]], v = [-sxz, -syz, -sz];
    var det = function (m) { return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]); };
    var d0 = det(M); if (Math.abs(d0) < 1e-14) return null;
    var col = function (k) { return M.map(function (row, r) { return row.map(function (x, c) { return c === k ? v[r] : x; }); }); };
    var D = det(col(0)) / d0, E = det(col(1)) / d0, F = det(col(2)) / d0;
    var cx = -D / 2, cy = -E / 2, r2 = cx * cx + cy * cy - F; if (!(r2 > 0)) return null;
    KC.copy(KU).multiplyScalar(cx).addScaledVector(KV, cy).addScaledVector(A, ax / n);
    return { c: KC, r: Math.sqrt(r2) };
  }
  /* 4) cuánto correr la linterna de lado (en su espacio, XZ) para que ningún dedo quede dentro del cuerpo */
  function torchPush(p, q, rg, out) {
    var pv = W.heldObj && W.heldObj.piv; if (!pv || !rg.prof) return out;
    GQI.copy(q).invert(); var ax = pv.position.x, az = pv.position.z, sy = pv.position.y;
    for (var pass = 0; pass < 2; pass++) for (var i = 0; i < JOINTS.length; i++) {
      if (!JOK[i] || (i >= 1 && i <= 4)) continue;   // el pulgar no empuja: está sobre el botón
      RL.copy(JP[i]).sub(p).applyQuaternion(GQI).sub(out);
      var R = profR(rg.prof, RL.y - sy); if (!R) continue;
      var dx = RL.x - ax, dz = RL.z - az, d = Math.hypot(dx, dz), pen = R + jointRad(JOINTS[i]) - d;
      if (pen <= 0 || d < 1e-4 || pen > 0.01) continue;   // hundido más de 1 cm (puño cerrado): queda dentro del puño, no empuja
      out.x -= dx / d * pen; out.z -= dz / d * pen;
    }
    if (rg.rest) { var th = Math.atan2(-rg.rest.z, rg.rest.x), cx = Math.cos(th), cz = -Math.sin(th), dd = out.x * cx + out.z * cz; out.x -= cx * dd; out.z -= cz * dd; }
    out.y = 0; if (out.length() > TG.maxPush) out.setLength(TG.maxPush);
    return out;
  }
  function torchFrame(H, side) {
    var now = performance.now(), rg = PR.trig, pf = rg && rg.prof;
    if (TG.side !== side || !W.torchPose) {
      /* agarre nuevo o cambio de mano: si ya estaba en otra mano, llega a la nueva en 0,3 s (sin saltos) */
      TG.from = TG.switching && TG.last ? { p: TG.last.p.clone(), q: TG.last.q.clone(), t: now } : null; TG.switching = false;
      TG.side = side; TG.hp = null; TG.gp = null; TG.o.set(0, 0, 0); TG.t0 = now; TG.lostT = 0;
    }
    else if (now - TG.seen > 120) TG.lostT = now;   // la mano vuelve tras perderse: llega suave (frameFilter)
    TG.seen = now;
    if (!pf || readJoints(H, side) < 12 || !palmFrame(H, side, TP0, TQ0)) {
      /* sin articulaciones: el agarre de siempre (el mango a una distancia fija de los nudillos) */
      if (!handFrame(H, side, TORCH_GRIP)) return false;
      TG.o.set(0, 0, 0); HP2.copy(FC);
      TX.crossVectors(FA, FFw); HM.makeBasis(TX, FA, FFw); HQ.setFromRotationMatrix(HM);   // Y del agarre = eje de la linterna
      var tp = W.torchPose;
      if (tp && tp.side === side) { tp.p.lerp(HP2, 0.5); tp.q.slerp(HQ, 0.5); HP2.copy(tp.p); HQ.copy(tp.q); }
      else tp = W.torchPose = { side: side, p: HP2.clone(), q: HQ.clone() };
      return true;
    }
    frameFilter(TG, TP0, TQ0, now);
    var fitting = !TG.gp || now - TG.t0 < TG.lockMs;
    if ((fitting || !rg.pressed) && torchFitPose(pf, RP, RQ)) {
      GQI.copy(TQ0).invert();   // contra el marco de este fotograma (ver radioPose)
      var gp = RP.sub(TP0).applyQuaternion(GQI), gq = GQI.multiply(RQ);
      if (!TG.gp) { TG.gp = gp.clone(); TG.gq = gq.clone(); }
      else { var k = fitting ? 0.35 : TG.refine; TG.gp.lerp(gp, k); TG.gq.slerp(gq, k); }
    }
    if (!TG.gp) return false;
    /* pose SIN filtrar (la mano en este instante): con ella se mide el pulgar sobre el botón (torchFit), así el retraso del filtro no se
       confunde con un pulsado al mover la mano rápido */
    if (!TG.raw) TG.raw = { p: new V3(), q: new THREE.Quaternion() };
    TG.raw.q.copy(TQ0).multiply(TG.gq); TG.raw.p.copy(TG.gp).applyQuaternion(TQ0).add(TP0); TG.rawT = now;
    HQ.copy(TG.hq).multiply(TG.gq); HP2.copy(TG.gp).applyQuaternion(TG.hq).add(TG.hp);
    /* sin empujes (TG.collide = false): los dedos que rodean el mango se dibujan delante (FFX.handBias); la linterna queda en el centro del puño */
    if (TG.collide) torchPush(HP2, HQ, rg, CPUSH.set(0, 0, 0)); else CPUSH.set(0, 0, 0); TG.o.lerp(CPUSH, 0.25);
    HP2.add(tmpV.copy(TG.o).applyQuaternion(HQ));
    if (TG.from) { var e = clamp((now - TG.from.t) / 300, 0, 1); e = e * e * (3 - 2 * e); HP2.lerpVectors(TG.from.p, HP2, e); HQ.slerpQuaternions(TG.from.q, HQ, e); if (e >= 1) TG.from = null; }
    if (TG.last) { TG.last.p.copy(HP2); TG.last.q.copy(HQ); } else TG.last = { p: HP2.clone(), q: HQ.clone() };
    if (W.torchPose && W.torchPose.side === side) { W.torchPose.p.copy(HP2); W.torchPose.q.copy(HQ); }
    else W.torchPose = { side: side, p: HP2.clone(), q: HQ.clone() };
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
    var now = performance.now(), T;
    /* el pulgar respecto de la linterna EN ESTE INSTANTE (pose sin filtrar, ver torchFrame): mover la mano rápido no enciende la luz */
    if (TG.raw && now - TG.rawT < 100) T = ft.sub(TG.raw.p).applyQuaternion(GQI.copy(TG.raw.q).invert()).add(TG.o);
    else T = h.worldToLocal(ft).add(TG.o);   // sin la corrección lateral de las colisiones (no cambia el encendido)
    if (!rg.rest) rg.rest = T.clone();
    var rT = Math.hypot(T.x, T.z), rR = Math.hypot(rg.rest.x, rg.rest.z);
    if (!rg.pressed && rT < rR - 0.006) { rg.pressed = true; rg.since = now; }
    else if (rg.pressed && (rT > rR - 0.003 || now - rg.since > 4000)) { rg.pressed = false; if (now - rg.since > 4000) rg.rest.copy(T); }
    if (!rg.pressed) rg.rest.lerp(T, 0.05);
    var th = Math.atan2(-rg.rest.z, rg.rest.x);
    pv.quaternion.setFromAxisAngle(YUP, th);
    /* copia «iwsdk-mateo-modelos»: la linterna ya no se aparta del pulgar (antes hasta 6 mm, hacia los dedos de adelante, que quedaban
       tapados): si el pulgar está más adentro que el botón, la mano se dibuja delante (FFX.handBias) */
    var sr = clamp(rR - rg.rb - 0.004, 0, 0.012), sy = clamp(rg.rest.y - rg.yb, -0.09, 0.03);
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
      var dx = (hit.x - MATEO.x) / (DIO.s * MQ.s), dz = (hit.z - MATEO.z) / (DIO.s * MQ.s);   // la maqueta crece desde los pies de Mateo
      if (dx > -17.6 && dx < 16 && dz > -29 && dz < 5.9) { t = (DIO.base * MQ.s - lp.y) / ld.y; hit = lp.clone().addScaledVector(ld, t); }
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
      attachBeam(piv, o, 0.08); s.demo = piv;   // haz corto, proporcional a la linterna de la base
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
  /* copia «iwsdk-mateo»: al terminar la radio y la linterna, Mateo queda SOLO (la radio y la linterna se encogen y desaparecen) con su globo
     de agradecimiento. Cuando ya se leyó (unos 7 s), aparece la tarjeta del cierre con «Volver a empezar». */
  var END_LINE = "¡Muchas gracias por haberme acompañado en este recorrido de tanto aprendizaje!";
  function closing() {
    go("end"); S.item = null; showSlots([]);
    say(END_LINE, 7000); mateoWave(3500);
    later(300, celebrate);
    updateTags();
    later(7000, endCard);
  }
  function endCard() {
    if (S.view !== "end") return;
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
    if (id === "maq-reset") { maqScale(1); toolsCard(); return; }
    if (id === "sound") { AU.setEnabled(!AU.enabled()); toolsCard(); return; }
    if (id === "to-hub") { hub(false); return; }
    if (id === "restart") { S.done = { radio: false, linterna: false }; hub(true); return; }
    if (id.indexOf("choose:") === 0) { if (S.view !== "hub") { hub(false); showSlots(ORDER); } S.canChoose = true; slotSelect(id.slice(7)); return; }
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
  window.FFApp = { act: function (id) { act(id); }, state: function () { return { view: S.view, item: S.item, phase: S.phase, done: S.done, mode: PR.mode, log: PR.log, light: W.lightOn, radio: TU.state, hover: S.hover, grabbed: S.grabbed, heldKind: W.heldKind }; }, debug: function () { return { PR: PR, W: W, S: S }; },
    /* maqueta: tamaño (1 = original) y gesto activo; FFApp.maqueta.scale(2) la agranda para probar sin el casco */
    maqueta: { scale: function (s) { maqScale(s); toolsCard(); return MQ.s; }, state: function () { return { scale: MQ.s, mode: MG.mode, cand: MG.cand, pos: root.position.toArray(), yaw: root.rotation.y }; }, hands: function (dt) { maqHands(dt || 16, performance.now() / 1000); return MG.mode; } } };
  AFRAME.registerComponent("vr-hit", {});
  AFRAME.registerComponent("ff-app", {
    init: function () {
      sceneEl = this.el; root = sceneEl.object3D; camEl = FFX.byId("cam");
      lobbyEl = FFX.byId("lobby"); worldEl = FFX.byId("world");
      var start = function () {
        buildWorldPanels(); buildScanPanel();
        UI.loadFonts().then(function () { var l = FFX.byId("ff-loading"); if (!l) return; l.style.opacity = 0; setTimeout(function () { l.remove(); }, 700); });   // la portada (index.html) reemplaza la pantalla de carga
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
      /* copia «iwsdk-mateo-modelos»: con la radio o la linterna en la mano, la mano real se dibuja delante de ellas hasta 2,2 cm (ver
         FFX.handBias en src/main.js): los dedos que las rodean se ven encima, como al agarrar un objeto de verdad */
      if (FFX.handBias) FFX.handBias(S.held && (W.grow || 0) > 0.5 ? 0.022 : 0.004);
      maqHands(dt, t);                     // mover y agrandar la maqueta con las manos
      if (!MG.mode) { handGestures(dt); panelTouch(); }   // mientras se mueve o se agranda, las manos no eligen, ni agarran, ni pulsan
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
    var o = P.bubble.el.object3D; o.position.set(MATEO.x + 0.02 * MQ.s, BUBBLE_Y * MQ.s, MATEO.z);   // sobre los techos, aunque la maqueta crezca
    var me = worldEl.object3D.worldToLocal(camPos.clone()); o.rotation.set(0, Math.atan2(me.x - o.position.x, me.z - o.position.z), 0);
  }

  /* =====================================================================================
     GESTOS CON LAS MANOS (Meta Quest, hand tracking)
     ===================================================================================== */
  /* BOTONES CON LOS DEDOS: la yema de cada índice pulsa los botones de todas las tarjetas al tocarlas (ver UI.touch en ui.js); suena un clic */
  var FT = { left: new V3(), right: new V3() };
  function panelTouch() {
    if (!FFX.immersive()) return;
    var H = FFX.hands;
    UI.touch(["left", "right"].map(function (side) { return { id: side, p: H.isHand(side) && H.joint(side, "index-finger-tip", FT[side]) ? FT[side] : null }; }),
      function () { AU.unlock(); AU.click(true); });
  }
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
     MAQUETA CON LAS MANOS (Meta Quest, hand tracking) — reemplaza a «Mover a otra mesa».
     Primero se escanea la mesa y se coloca la experiencia como antes (src/main.js). Después:
     · MOVER: las dos manos abiertas con las PALMAS HACIA ARRIBA junto a la maqueta, como si la sostuviera → la maqueta sigue a las manos
       (posición, altura y giro). Al voltear las manos o retirarlas, se queda EXACTAMENTE donde el usuario la dejó.
     · AGRANDAR / ACHICAR: a) las PALMAS ENFRENTADAS (como un marco) cerca de la maqueta: al separarlas crece y al juntarlas se achica;
       b) PELLIZCAR LAS DOS ESQUINAS DE ADELANTE (marcas amarillas) y estirarlas o juntarlas.
       Crece desde los pies de Mateo, con todos sus elementos: escenario, Mateo, casas, árboles, montañas, la radio y la linterna.
     Las tarjetas se corren hacia los lados para no quedar dentro de la maqueta. Mientras se mueve o se agranda, las manos no eligen ni
     agarran objetos; con la radio o la linterna en la mano, estos gestos no se activan.
     ===================================================================================== */
  var MG = { mode: null, cand: null, candT: 0, lost: 0, corner: {}, marks: null };
  var MPL = { c: new V3(), n: new V3() }, MPR = { c: new V3(), n: new V3() }, PALM0 = { n: 0, f: 0 };
  var MA = new V3(), MB = new V3(), MC = new V3(), MD = new V3(), ME = new V3(), MPP = { left: new V3(), right: new V3() };
  /* huella de la base del diorama en las coordenadas de siempre (dentro de miEl): ver buildWorld */
  var FP = (function () {
    var bw = 33.6 * DIO.s + 0.012, bd = 34.9 * DIO.s + 0.012, cx = MATEO.x - 0.8 * DIO.s, cz = MATEO.z - 11.55 * DIO.s;
    return { x0: cx - bw / 2, x1: cx + bw / 2, z0: cz - bd / 2, z1: cz + bd / 2 };
  })();
  /* palma de una mano: centro y normal (sale de la palma), con el mismo marco de la mano que usan la radio y la linterna */
  function palmOf(side, o) {
    var H = FFX.hands; if (!H.isHand(side) || !handFrame(H, side, PALM0)) return false;
    o.n.copy(FN); o.c.copy(FK).add(FJ.w).multiplyScalar(0.5);
    return true;
  }
  /* punto del pellizco: entre las yemas del pulgar y del índice */
  function pinchPt(side, out) {
    var H = FFX.hands; if (!H.isHand(side) || !H.joint(side, "thumb-tip", MC) || !H.joint(side, "index-finger-tip", MD)) return null;
    return out.copy(MC).add(MD).multiplyScalar(0.5);
  }
  /* ¿el punto (mundo) está junto a la maqueta? margen horizontal en metros reales, altura sobre la mesa entre yLo y yHi */
  function nearMaq(p, margin, yLo, yHi) {
    var L = W.mi.worldToLocal(ME.copy(p)), s = MQ.s;
    var dx = Math.max(FP.x0 - L.x, 0, L.x - FP.x1), dz = Math.max(FP.z0 - L.z, 0, L.z - FP.z1);
    return Math.hypot(dx, dz) * s < margin && L.y * s > yLo && L.y * s < yHi;
  }
  function cornerWorld(i, out) { return W.mi.localToWorld(out.set(i ? FP.x1 : FP.x0, 0, FP.z1)); }
  function maqScale(s) {
    MQ.s = clamp(s, MQ.min, MQ.max);
    if (W.maqEl) W.maqEl.object3D.scale.setScalar(MQ.s);
    placeCards();
  }
  /* las tarjetas van DENTRO de la maqueta, a unos 4 cm de los objetos (CARD): su punto se agranda con la maqueta (crece desde los pies de
     Mateo, sin giro), pero la tarjeta conserva su tamaño para que se lea igual. Se apoyan en el pasto (DIO.base). */
  function placeCards() {
    var s = MQ.s, put = function (a, x, z, yaw) {
      if (!a) return;
      a.object3D.position.set(MATEO.x + (x - MATEO.x) * s, DIO.base * s, MATEO.z + (z - MATEO.z) * s);
      a.object3D.rotation.set(0, (yaw || 0) * Math.PI / 180, 0);
    };
    put(A.seq, CARD.seq.x, CARD.seq.z, CARD.seq.yaw);
    put(A.tools, CARD.tools.x, CARD.tools.z, CARD.tools.yaw);
    put(A.loading, MATEO.x, SLOT.radio[1] + 0.045, 0);
  }
  /* marcas amarillas en las esquinas de adelante (para pellizcar y estirar) y borde que se ilumina mientras se mueve o se agranda */
  function maqMarks() {
    if (MG.marks || !W.mi) return MG.marks;
    var mat = new THREE.MeshBasicMaterial({ color: 0xf5b335, transparent: true, opacity: 0.7, depthWrite: false });
    var list = [0, 1].map(function (i) {
      var g = new THREE.Group(), sg = i ? -1 : 1;
      var a = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.006), mat); a.position.set(sg * 0.015, 0, -0.003); g.add(a);
      var b = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.004, 0.03), mat); b.position.set(0, 0, -0.015); g.add(b);
      var dot = new THREE.Mesh(new THREE.SphereGeometry(0.006, 16, 10), mat); dot.position.y = 0.004; g.add(dot);
      g.position.set(i ? FP.x1 : FP.x0, DIO.base * 0.5, FP.z1); g.visible = false; g.renderOrder = 6; W.mi.add(g); return g;
    });
    var pts = [[FP.x0, FP.z0], [FP.x1, FP.z0], [FP.x1, FP.z1], [FP.x0, FP.z1]].map(function (p) { return new V3(p[0], DIO.base + 0.002, p[1]); });
    var frame = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xf5b335, transparent: true, opacity: 0.95, depthTest: false }));
    frame.visible = false; frame.renderOrder = 7; W.mi.add(frame);
    MG.marks = { list: list, frame: frame, mat: mat };
    return MG.marks;
  }
  function maqStart(mode, data) {
    MG.mode = mode; MG.lost = 0; MG.cand = null; Object.assign(MG, data);
    if (S.view === "hub") setHover(null);
    AU.click(true);
  }
  function maqEnd() {
    if (!MG.mode) return;
    MG.mode = null; MG.corner = {}; AU.click(false);
    toolsCard();   // muestra u oculta «Tamaño original»
  }
  /* un gesto candidato debe sostenerse ~0,3 s para empezar (así no se activa al pasar las manos cerca) */
  function maqCandidate(name, dt, data) {
    if (MG.cand !== name) { MG.cand = name; MG.candT = 0; }
    MG.candT += dt; if (MG.candT > 300) maqStart(name, data());
  }
  function maqHands(dt, t) {
    var on = !!(FFX.immersive() && FFX.placement.state === "placed" && W.mi);
    var busy = S.held || (W.heldEl && W.heldEl.object3D.visible);
    var mk = maqMarks();
    if (mk) { mk.list.forEach(function (g) { g.visible = on && !busy; g.scale.setScalar(1 / MQ.s); }); mk.frame.visible = on && !!MG.mode; }
    if (!on || busy) { maqEnd(); MG.cand = null; MG.corner = {}; return; }
    var H = FFX.hands; W.mi.updateMatrixWorld(true);
    var okL = palmOf("left", MPL), okR = palmOf("right", MPR);
    var pl = pinchPt("left", MPP.left), pr = pinchPt("right", MPP.right);
    var c0 = cornerWorld(0, MA), c1 = cornerWorld(1, MB);
    /* las marcas de las esquinas se encienden al acercar la punta de los dedos */
    var nearC = [pl, pr].some(function (p) { return p && (p.distanceTo(c0) < 0.07 || p.distanceTo(c1) < 0.07); });
    mk.mat.opacity = MG.mode ? 1 : nearC ? 1 : 0.55 + 0.15 * Math.sin(t * 3);

    if (MG.mode === "move") {
      var ok = okL && okR && MPL.n.y > 0.2 && MPR.n.y > 0.2;
      MG.lost = ok ? 0 : MG.lost + dt; if (MG.lost > 250) { maqEnd(); return; }
      if (!ok) return;
      var mid = MC.copy(MPL.c).add(MPR.c).multiplyScalar(0.5), v = MD.subVectors(MPR.c, MPL.c);
      var phi = Math.atan2(v.x, v.z) - MG.a0;
      var target = ME.copy(MG.off).applyAxisAngle(YUP, phi).add(mid);
      root.position.lerp(target, 0.35);
      var dy = MG.y0 + phi - root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); root.rotation.y += dy * 0.35;
      return;
    }
    if (MG.mode === "frame") {
      var dir = MD.subVectors(MPR.c, MPL.c), d = dir.length(); dir.normalize();
      var okf = okL && okR && MPL.n.dot(dir) > 0.2 && -MPR.n.dot(dir) > 0.2;
      MG.lost = okf ? 0 : MG.lost + dt; if (MG.lost > 250) { maqEnd(); return; }
      if (okf) maqScale(MQ.s + (MG.s0 * d / MG.d0 - MQ.s) * 0.4);
      return;
    }
    if (MG.mode === "corners") {
      if (!pl || !pr || !H.pinch("left").active || !H.pinch("right").active) { maqEnd(); return; }
      maqScale(MQ.s + (MG.s0 * pl.distanceTo(pr) / MG.d0 - MQ.s) * 0.4);
      return;
    }

    /* --- sin gesto activo: ¿empieza alguno? --- */
    /* b) pellizco en las dos esquinas de adelante */
    ["left", "right"].forEach(function (side) {
      var p = side === "left" ? pl : pr, pin = H.pinch(side);
      if (!p || !pin.active) { delete MG.corner[side]; return; }
      if (pin.start) { if (p.distanceTo(c0) < 0.07) MG.corner[side] = 0; else if (p.distanceTo(c1) < 0.07) MG.corner[side] = 1; }
    });
    if (MG.corner.left != null && MG.corner.right != null && MG.corner.left !== MG.corner.right && pl && pr) {
      maqStart("corners", { s0: MQ.s, d0: Math.max(0.02, pl.distanceTo(pr)) }); return;
    }
    if (!okL || !okR || handClosed("left") || handClosed("right")) { MG.cand = null; return; }
    var hd = MPL.c.distanceTo(MPR.c);
    /* MOVER: las dos palmas hacia arriba, junto a la maqueta (a los lados o debajo del borde), como sosteniendo una bandeja */
    if (MPL.n.y > 0.55 && MPR.n.y > 0.55 && hd > 0.1 && nearMaq(MPL.c, 0.18, -0.15, 0.3) && nearMaq(MPR.c, 0.18, -0.15, 0.3)) {
      maqCandidate("move", dt, function () {
        var mid = MC.copy(MPL.c).add(MPR.c).multiplyScalar(0.5), v = MD.subVectors(MPR.c, MPL.c);
        return { a0: Math.atan2(v.x, v.z), y0: root.rotation.y, off: root.position.clone().sub(mid) };
      });
      return;
    }
    /* AGRANDAR: palmas enfrentadas (como en un marco), cerca de la maqueta */
    var dir2 = MD.subVectors(MPR.c, MPL.c).normalize(), mid2 = MC.copy(MPL.c).add(MPR.c).multiplyScalar(0.5);
    if (hd > 0.04 && hd < 0.9 && MPL.n.dot(dir2) > 0.45 && -MPR.n.dot(dir2) > 0.45 && Math.abs(MPL.n.y) < 0.65 && Math.abs(MPR.n.y) < 0.65 && nearMaq(mid2, 0.3, -0.1, 0.6)) {
      maqCandidate("frame", dt, function () { return { s0: MQ.s, d0: Math.max(0.03, hd) }; });
      return;
    }
    MG.cand = null;
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
