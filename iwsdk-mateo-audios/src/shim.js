/* Puente entre la lógica de la versión A-Frame (../vr/vr.js y ../vr/ui.js, copiadas en public/ff/) e IWSDK.
   Aquellos archivos usan «entidades» de A-Frame (a-entity, setObject3D, eventos click/mouseenter…). Aquí cada una se vuelve una
   entidad de IWSDK (world.createTransformEntity) y los clics llegan por el sistema de entrada de IWSDK (RayInteractable):
   en el Quest se usa con las manos: tocando con la punta del índice (PokeInteractable) o pellizcando a distancia (RayInteractable).
   En el computador, con el ratón. */
import * as THREE from 'three';
import { RayInteractable, PokeInteractable, VisibilityState } from '@iwsdk/core';

export function installShim(world) {
  const EV = { click: 'click', pointerdown: 'mousedown', pointerup: 'mouseup', pointerenter: 'mouseenter', pointerleave: 'mouseleave', pointermove: 'mousemove' };
  const attrIndex = {};   // atributo → entidades que lo tienen (para «[vr-hit]»)

  class FEl {
    constructor(object3D) {
      this.object3D = object3D || new THREE.Group();
      this.object3D.el = this;
      this.object3DMap = {};
      this.entity = null;
      this.parentEl = null;
      this._ls = {};
      this._interactive = false;
      const self = this;
      this.classList = {
        toggle(c, v) { if (c === 'clickable') self._setInteractive(v === undefined ? !self._interactive : !!v); },
        add(c) { this.toggle(c, true); }, remove(c) { this.toggle(c, false); }, contains(c) { return c === 'clickable' && self._interactive; },
      };
      Object.keys(EV).forEach((type) => {
        this.object3D.addEventListener(type, (e) => {
          const uv = e.uv || (e.intersection && e.intersection.uv);
          /* el punto tocado también llega sin uv (modelos sin coordenadas de textura, como las perillas de la radio) */
          this._fire(EV[type], { detail: { intersection: uv || e.point ? { uv, point: e.point } : null }, stopPropagation() {} });
        });
      });
    }
    _ensureEntity() {
      if (this.entity) return this.entity;
      const parent = this.parentEl ? this.parentEl._ensureEntity() : world.sceneEntity;
      this.entity = world.createTransformEntity(this.object3D, { parent, persistent: true });
      if (this._interactive) { this.entity.addComponent(RayInteractable); this.entity.addComponent(PokeInteractable); }
      return this.entity;
    }
    _setInteractive(v) {
      this._interactive = v;
      if (!this.entity) return;
      /* RayInteractable: pellizcar a distancia (rayo de la mano) · PokeInteractable: tocar con la punta del dedo índice */
      const has = this.entity.hasComponent(RayInteractable);
      if (v && !has) { this.entity.addComponent(RayInteractable); this.entity.addComponent(PokeInteractable); }
      else if (!v && has) { this.entity.removeComponent(RayInteractable); if (this.entity.hasComponent(PokeInteractable)) this.entity.removeComponent(PokeInteractable); }
    }
    _fire(type, evt) { (this._ls[type] || []).slice().forEach((f) => f.call(this, evt)); }
    appendChild(child) { child.parentEl = this; this.object3D.add(child.object3D); child._ensureEntity(); return child; }
    remove() { if (this.entity) { this.entity.destroy(); this.entity = null; } this.object3D.removeFromParent(); }
    setObject3D(name, obj) { this.object3DMap[name] = obj; this.object3D.add(obj); }
    getObject3D(name) { return this.object3DMap[name] || null; }
    addEventListener(type, fn) { (this._ls[type] = this._ls[type] || []).push(fn); }
    removeEventListener(type, fn) { this._ls[type] = (this._ls[type] || []).filter((f) => f !== fn); }
    emit(type, detail) { this._fire(type, { detail: detail || {} }); }
    setAttribute(name) { (attrIndex[name] = attrIndex[name] || new Set()).add(this); }
    hasAttribute(name) { return !!(attrIndex[name] && attrIndex[name].has(this)); }
  }

  /* raíz de todo el contenido: en AR sube o baja hasta el piso real detectado */
  const sceneEl = new FEl();
  sceneEl.object3D.name = 'FreeFrequency';
  sceneEl._ensureEntity();
  sceneEl.hasLoaded = true;
  sceneEl.canvas = world.renderer.domElement;
  let arSession = false;
  const isImmersive = () => world.visibilityState.value !== VisibilityState.NonImmersive;
  sceneEl.is = (state) => {
    if (state === 'vr-mode') return isImmersive();
    if (state === 'ar-mode') {
      if (!isImmersive()) return false;
      const blend = world.session && world.session.environmentBlendMode;
      return arSession || (blend && blend !== 'opaque');
    }
    return false;
  };
  sceneEl.setAttribute = function (name, value) {
    if (name === 'fog') { const v = value || {}; world.scene.fog = new THREE.Fog(v.color || '#000', v.near || 1, v.far || 100); return; }
    FEl.prototype.setAttribute.call(this, name);
  };
  sceneEl.removeAttribute = (name) => { if (name === 'fog') world.scene.fog = null; };

  /* luces: las mismas de la versión A-Frame (llave cálida, relleno de cielo y ambiente) */
  const lights = {
    key: new THREE.DirectionalLight(0xffe2b0, 2.1),
    fill: new THREE.HemisphereLight(0xcfe0ff, 0x2a2230, 1.5),
    amb: new THREE.AmbientLight(0xffffff, 0.45),
  };
  lights.key.position.set(3, 5, 6);
  Object.values(lights).forEach((l) => sceneEl.object3D.add(l));
  const lightEl = (l) => ({ setAttribute(c, p, v) { if (c === 'light' && p === 'intensity') l.intensity = v; } });

  /* cámara: en el navegador es world.camera; dentro del Quest, la cabeza del jugador */
  const camEl = {
    get object3D() { return isImmersive() && world.player && world.player.head ? world.player.head : world.camera; },
    getObject3D() { return world.camera; },
    setAttribute(c, p, v) { if (c === 'camera' && p === 'fov') { world.camera.fov = v; world.camera.updateProjectionMatrix(); } },
    getAttribute() { return { fov: world.camera.fov }; },
  };

  const named = {};
  const byId = (id) => {
    if (id === 'cam') return camEl;
    if (lights[id]) return lightEl(lights[id]);
    if (id === 'lobby' || id === 'world') { if (!named[id]) named[id] = sceneEl.appendChild(new FEl()); if (id === 'world') named[id].object3D.visible = false; return named[id]; }
    return document.getElementById(id);
  };

  /* A-Frame mínimo: los archivos registran «ff-app» (init + tick); aquí se arrancan y se llaman cada fotograma */
  const components = {};
  window.AFRAME = {
    registerComponent(name, def) { components[name] = def; },
    registerSystem() { /* el resaltado al apuntar ahora llega con los eventos de IWSDK (ver ui.js) */ },
  };

  const listeners = { 'enter-vr': [], 'exit-vr': [] };
  const baseAdd = sceneEl.addEventListener.bind(sceneEl);
  sceneEl.addEventListener = (type, fn, opts) => { if (listeners[type]) listeners[type].push(fn); else baseAdd(type, fn, opts); };
  let was = false;
  world.visibilityState.subscribe((s) => {
    const now = s !== VisibilityState.NonImmersive;
    if (now && !was) listeners['enter-vr'].forEach((f) => f());
    if (!now && was) { arSession = false; listeners['exit-vr'].forEach((f) => f()); }
    was = now;
  });

  window.FFX = {
    world, sceneEl, camEl, byId, lights, FEl,
    entity: () => new FEl(),
    query: (attr) => Array.from(attrIndex[attr] || []),
    markAR: (v) => { arSession = !!v; },
    component: (name) => components[name],
  };
  return window.FFX;
}
