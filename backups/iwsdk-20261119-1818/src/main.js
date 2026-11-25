/* Free Frequency · versión de REALIDAD AUMENTADA con el Immersive Web SDK de Meta (IWSDK) para Meta Quest.
   (La versión de realidad virtual se quitó: aquí solo hay AR con passthrough.)
   1) Crea el mundo de IWSDK con WebXR en realidad aumentada: passthrough, manos (hand tracking), detección de planos y hit-test.
   2) ESCANEO DE LA MESA: al entrar en AR se muestra el escaneo del cuarto (los planos que detecta el Quest) y una retícula que sigue la
      mirada sobre las superficies horizontales. Al pellizcar (pulgar + índice) toda la experiencia se coloca sobre esa mesa real:
      personajes, objetos y tarjetas quedan apoyados en la superficie (y = 0 del contenido = superficie de la mesa).
   3) MANOS: FFX.hands da la posición de cada mano (para sostener el teléfono, la radio o la linterna) y el pellizco; los botones se
      tocan con la punta del índice (PokeInteractable, en src/shim.js) o pellizcando a distancia.
   4) En el computador (sin casco) se ve una mesa virtual con el mismo contenido, para probar sin el Quest.
   5) Expone Three.js como variable global, porque los archivos originales de la página (js/*.js) lo usan así, y los carga en orden. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { World, SessionMode, ReferenceSpaceType, VisibilityState, XRPlane, EnvironmentRaycastTarget, RaycastSpace, createSystem, stencilMaterial } from '@iwsdk/core';
import { installShim } from './shim.js';

window.THREE = Object.assign({}, THREE, { GLTFLoader });

const XR_FEATURES = { handTracking: true, planeDetection: true, hitTest: true, anchors: false, layers: false };
const world = await World.create(document.getElementById('scene-container'), {
  xr: {
    sessionMode: SessionMode.ImmersiveAR,
    referenceSpace: { type: ReferenceSpaceType.LocalFloor, fallbackOrder: [ReferenceSpaceType.Local, ReferenceSpaceType.Viewer] },
    features: XR_FEATURES,
    offer: 'none',
  },
  render: { fov: 70, near: 0.02, far: 900, camera: { position: [0, 1.22, 0] } },
  features: { locomotion: false, grabbing: false, physics: false, sceneUnderstanding: true, environmentRaycast: true, spatialUI: false },
});
world.renderer.toneMapping = THREE.NoToneMapping;
/* MANOS QUE TAPAN LOS OBJETOS (oclusión): la malla de cada mano de IWSDK escribe profundidad con color transparente, pero como material
   «transparente» se dibuja DESPUÉS de los objetos opacos y no los tapa: la radio y la linterna se veían encima de los dedos reales, como si
   la mano las atravesara. Opaca, se dibuja con los objetos opacos y abre un hueco (alfa 0) por donde se ve la mano real del passthrough
   delante de la radio o de la linterna, solo donde la mano está de verdad delante. */
stencilMaterial.transparent = false; stencilMaterial.alphaTest = 0; stencilMaterial.needsUpdate = true;
world.renderer.setClearColor(0x14303a, 1);

const FFX = installShim(world);
const root = FFX.sceneEl.object3D;   // raíz de todo el contenido: se coloca sobre la mesa real

/* =====================================================================================
   MESA (en el computador y si en AR no se detecta ninguna superficie): una mesa virtual de madera
   ===================================================================================== */
const DESK = { pos: new THREE.Vector3(0, 0.74, -0.6) };   // en el computador: mesa a 74 cm de alto y 60 cm delante
const vTable = new THREE.Group(); vTable.name = 'MesaVirtual';
{
  const wood = new THREE.MeshLambertMaterial({ color: 0xb98a5a }), dark = new THREE.MeshLambertMaterial({ color: 0x6e4b2c });
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.8), wood); top.position.y = -0.0205; vTable.add(top);
  [[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.05), dark); l.position.set(x, -0.4, z); vTable.add(l); });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshLambertMaterial({ color: 0x3b4a50 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.74; vTable.add(floor);
}
root.add(vTable);

/* =====================================================================================
   ESCANEO Y COLOCACIÓN SOBRE UNA SUPERFICIE REAL
   ===================================================================================== */
const PL = { state: 'desktop', candidate: null, t0: 0, fallback: false, listeners: [] };
/* retícula: anillo amarillo (la señal de la página) que se apoya sobre la superficie que se mira */
const reticle = new THREE.Group(); reticle.visible = false; world.scene.add(reticle);
{
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.075, 0.09, 64), new THREE.MeshBasicMaterial({ color: 0xf5b335, transparent: true, opacity: 0.95, depthTest: false }));
  ring.rotation.x = -Math.PI / 2; ring.renderOrder = 20; reticle.add(ring);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.012, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
  dot.rotation.x = -Math.PI / 2; dot.renderOrder = 20; reticle.add(dot);
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.09, 0.1, 64), new THREE.MeshBasicMaterial({ color: 0xf5b335, transparent: true, opacity: 0.5, depthTest: false }));
  pulse.rotation.x = -Math.PI / 2; pulse.renderOrder = 20; reticle.add(pulse); reticle.userData.pulse = pulse;
  /* silueta de la huella de la experiencia (unos 60 × 40 cm) para ver si cabe en la mesa */
  const foot = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.42), new THREE.MeshBasicMaterial({ color: 0xf5b335, transparent: true, opacity: 0.12, depthWrite: false }));
  foot.rotation.x = -Math.PI / 2; foot.position.z = -0.05; reticle.add(foot); reticle.userData.foot = foot;
}
/* hit-test de WebXR desde la mirada (el sistema de IWSDK mueve este objeto al punto de la superficie real) */
const hitObj = new THREE.Object3D(); hitObj.visible = false;
const hitEnt = world.createTransformEntity(hitObj, { persistent: true });
hitEnt.addComponent(EnvironmentRaycastTarget, { space: RaycastSpace.Viewer, maxDistance: 4 });

/* malla de escaneo: cuadrícula animada sobre cada plano que detecta el Quest (amarilla en mesas, azul tenue en el piso) */
const scanMat = (color, alpha) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uAlpha: { value: alpha } },
  vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: 'uniform float uTime; uniform vec3 uColor; uniform float uAlpha; varying vec3 vW;\n' +
    'void main(){ vec2 g = abs(fract(vW.xz * 10.0) - 0.5); float line = 1.0 - smoothstep(0.0, 0.06, min(g.x, g.y) - 0.44);\n' +
    ' float wave = smoothstep(0.12, 0.0, abs(fract(length(vW.xz) * 0.8 - uTime * 0.45) - 0.5));\n' +
    ' gl_FragColor = vec4(uColor, uAlpha * (0.25 + 0.75 * line) + wave * 0.25); }',
});
const MAT_TABLE = scanMat(0xf5b335, 0.35), MAT_FLOOR = scanMat(0x6fc3df, 0.12);
const scanOverlays = new Map();   // entidad del plano → malla de escaneo

function head() { return world.player && world.player.head ? world.player.head : world.camera; }
function setPlaced(pos, yaw, fallback) {
  root.position.copy(pos); root.rotation.set(0, yaw, 0); root.visible = true;
  PL.fallback = !!fallback; vTable.visible = !!fallback;
  PL.state = 'placed'; reticle.visible = false; showScan(false);
  PL.listeners.forEach((f) => f('placed'));
}
function startPlacing() {
  PL.state = 'placing'; PL.t0 = performance.now(); PL.candidate = null; root.visible = false; vTable.visible = false;
  showScan(true); PL.listeners.forEach((f) => f('placing'));
}
function showScan(v) { scanOverlays.forEach((m) => { m.visible = v; }); }
/* en el computador: la mesa virtual delante de la cámara */
function desktopPose() { PL.state = 'desktop'; root.position.copy(DESK.pos); root.rotation.set(0, 0, 0); root.visible = true; vTable.visible = true; reticle.visible = false; showScan(false); PL.listeners.forEach((f) => f('desktop')); }

const raycaster = new THREE.Raycaster(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
function updatePlacing(planeEntities, t) {
  const h = head(); h.updateMatrixWorld(true);
  const eye = h.getWorldPosition(new THREE.Vector3()), dir = new THREE.Vector3(0, 0, -1).applyQuaternion(h.getWorldQuaternion(tmpQ));
  /* altura del piso: el plano horizontal más bajo (o y = 0 con local-floor) */
  let floorY = 0, low = null;
  planeEntities.forEach((e) => { const p = e.getValue(XRPlane, '_plane'), o = e.object3D; if (!p || !o || p.orientation !== 'horizontal') return; const y = o.getWorldPosition(tmpA).y; if (low === null || y < low) low = y; });
  if (low !== null && low < 0.4) floorY = low;
  /* 1) planos detectados (las mesas del «Space Setup» del Quest): la mirada contra cada plano horizontal por encima del piso */
  const tables = [];
  planeEntities.forEach((e) => {
    const p = e.getValue(XRPlane, '_plane'), o = e.object3D; if (!p || !o || p.orientation !== 'horizontal') return;
    const y = o.getWorldPosition(tmpA).y, isTable = y - floorY > 0.3 || /table|desk|counter|mesa/i.test(p.semanticLabel || '');
    /* la malla del plano de IWSDK es invisible: la cuadrícula va aparte en la escena y copia su posición en cada fotograma */
    let m = scanOverlays.get(e);
    if (!m && o.geometry) { m = new THREE.Mesh(o.geometry, isTable ? MAT_TABLE : MAT_FLOOR); m.matrixAutoUpdate = false; m.renderOrder = 5; world.scene.add(m); scanOverlays.set(e, m); }
    if (m) { m.geometry = o.geometry; m.material = isTable ? MAT_TABLE : MAT_FLOOR; o.updateMatrixWorld(true); m.matrix.copy(o.matrixWorld); m.matrix.elements[13] += 0.003; m.visible = true; }
    if (isTable && o.geometry) tables.push(o);
  });
  raycaster.set(eye, dir); raycaster.far = 4;
  let cand = null;
  /* los planos del Quest pueden estar ocultos: el raycaster de Three.js no mira la visibilidad, así que sirve igual */
  const hits = raycaster.intersectObjects(tables, false);
  if (hits.length) cand = { point: hits[0].point.clone(), table: true };
  /* 2) hit-test de WebXR (cualquier superficie horizontal real, aunque no esté en el Space Setup) */
  if (!cand && hitObj.visible) {
    const n = UP.clone().applyQuaternion(hitObj.getWorldQuaternion(tmpQ)), p = hitObj.getWorldPosition(new THREE.Vector3());
    if (n.y > 0.85) cand = { point: p, table: p.y - floorY > 0.3 };
  }
  PL.candidate = cand;
  if (cand) {
    reticle.visible = true; reticle.position.copy(cand.point);
    const yaw = Math.atan2(eye.x - cand.point.x, eye.z - cand.point.z); reticle.rotation.set(0, yaw, 0);
    const s = 1 + 0.25 * Math.sin(t * 4); reticle.userData.pulse.scale.set(s, s, s);
  } else reticle.visible = false;
  MAT_TABLE.uniforms.uTime.value = MAT_FLOOR.uniforms.uTime.value = t;
  /* confirmar con un pellizco de cualquier mano (o el gatillo si alguien usa control) */
  if (performance.now() - PL.t0 < 700) return;
  const pinch = ['left', 'right'].some((s) => { try { return world.input.xr.getSelectState(s).start; } catch (e) { return false; } });
  if (!pinch) return;
  if (cand) setPlaced(cand.point, Math.atan2(eye.x - cand.point.x, eye.z - cand.point.z), false);
  else if (performance.now() - PL.t0 > 5000) {
    /* no se detectó ninguna superficie: mesa virtual 55 cm delante y 45 cm por debajo de los ojos */
    const f = new THREE.Vector3(dir.x, 0, dir.z).normalize(), p = eye.clone().addScaledVector(f, 0.55); p.y = Math.max(floorY + 0.6, eye.y - 0.45);
    setPlaced(p, Math.atan2(-f.x, -f.z), true);
  }
}

/* =====================================================================================
   MANOS (hand tracking): posición de cada mano y pellizco
   ===================================================================================== */
const hands = {
  /* ¿hay una mano (o control) con posición en ese lado? */
  tracked(side) { try { return !!world.input.xr.getPrimaryInputSource(side); } catch (e) { return false; } },
  isHand(side) { try { const s = world.input.xr.getPrimaryInputSource(side); return !!(s && s.hand); } catch (e) { return false; } },
  grip(side) { return world.player && world.player.gripSpaces ? world.player.gripSpaces[side] : null; },
  tip(side) { return world.player && world.player.indexTipSpaces ? world.player.indexTipSpaces[side] : null; },
  pinch(side) { try { return world.input.xr.getSelectState(side); } catch (e) { return { start: false, end: false, active: false }; } },
  /* posición en el mundo de una articulación de la mano («thumb-tip», «index-finger-tip», «wrist»…). IWSDK guarda cada articulación
     relativa al espacio de agarre (grip) de esa mano: se lleva al mundo con la matriz del grip. Devuelve null si la mano no se ve. */
  joint(side, name, out) {
    try {
      const a = world.input.xr.visualAdapters.hand[side], g = hands.grip(side);
      if (!a || !a.inputSource || !a.jointTransforms || !g || !hands.isHand(side)) return null;
      const i = a.jointSpaces.findIndex((j) => j.jointName === name); if (i < 0) return null;
      const m = a.jointTransforms; out.set(m[i * 16 + 12], m[i * 16 + 13], m[i * 16 + 14]);
      if (!out.x && !out.y && !out.z) return null;   // aún sin datos
      g.updateMatrixWorld(true); return out.applyMatrix4(g.matrixWorld);
    } catch (e) { return null; }
  },
};
const immersive = () => world.visibilityState.value !== VisibilityState.NonImmersive;
FFX.placement = {
  get state() { return PL.state; },
  get fallback() { return PL.fallback; },
  get candidate() { return PL.candidate; },
  since() { return performance.now() - PL.t0; },
  start: startPlacing,
  on(f) { PL.listeners.push(f); },
};
FFX.hands = hands;
FFX.immersive = immersive;
FFX.head = head;

/* archivos originales de la página + lógica del recorrido (scripts clásicos, en este orden) */
function load(src) {
  return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.async = false; s.onload = ok; s.onerror = () => ko(new Error('No se pudo cargar ' + src)); document.head.appendChild(s); });
}
for (const src of ['js/data.js', 'js/toon-shader.js', 'js/characters-3d.js', 'js/scenery.js', 'js/audio.js', 'js/tuner.js', 'ff/ui.js', 'ff/app.js']) await load(src);

/* arranca la app (lo que en A-Frame era el componente «ff-app») y la actualiza en cada fotograma */
const app = Object.create(FFX.component('ff-app'));
app.el = FFX.sceneEl;
app.init();
desktopPose();
class FreeFrequencySystem extends createSystem({ planes: { required: [XRPlane] } }) {
  init() { this.t = 0; }
  update(delta) {
    const dt = delta * 1000; this.t += dt;
    if (PL.state === 'placing') updatePlacing(this.queries.planes.entities, this.t / 1000);
    app.tick(this.t, dt);
  }
}
world.registerSystem(FreeFrequencySystem, { priority: 30 });

/* mirar alrededor con el ratón en el navegador (en el Quest manda la cabeza). Empieza mirando la mesa. */
const cam = world.camera, canvas = world.renderer.domElement, look = { yaw: 0, pitch: -0.6, down: null };
cam.rotation.order = 'YXZ'; cam.rotation.set(look.pitch, look.yaw, 0);
canvas.addEventListener('pointerdown', (e) => { if (e.button === 0) look.down = { x: e.clientX, y: e.clientY, yaw: look.yaw, pitch: look.pitch }; });
window.addEventListener('pointerup', () => { look.down = null; });
window.addEventListener('pointermove', (e) => {
  if (!look.down || immersive()) return;
  const dx = e.clientX - look.down.x, dy = e.clientY - look.down.y;
  if (Math.abs(dx) + Math.abs(dy) < 4) return;
  look.yaw = look.down.yaw + dx * 0.004; look.pitch = Math.max(-1.3, Math.min(1.3, look.down.pitch + dy * 0.004));
  cam.rotation.set(look.pitch, look.yaw, 0);
});

/* botón para entrar en realidad aumentada (solo aparece si el navegador o el visor la admiten) */
const btnAR = document.getElementById('btn-ar'), noAR = document.getElementById('no-ar');
if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-ar').then((ok) => { btnAR.hidden = !ok; noAR.hidden = ok; }).catch(() => { noAR.hidden = false; });
} else noAR.hidden = false;
btnAR.addEventListener('click', () => { window.FFAudio && window.FFAudio.unlock(); FFX.markAR(true); world.launchXR({ sessionMode: SessionMode.ImmersiveAR, features: XR_FEATURES }); });
world.visibilityState.subscribe((s) => {
  const flat = s === VisibilityState.NonImmersive;
  document.getElementById('ff-xr').style.display = flat ? '' : 'none';
  document.getElementById('ff-hint').style.display = flat ? '' : 'none';
  /* en AR el fondo queda transparente para que se vea el cuarto real (passthrough) */
  world.renderer.setClearColor(flat ? 0x14303a : 0x000000, flat ? 1 : 0);
  if (flat) desktopPose();
  else if (PL.state === 'desktop') startPlacing();
});

window.FFWorld = world;   // para depurar desde la consola
