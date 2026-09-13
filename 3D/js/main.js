import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { DRACOLoader } from '../vendor/DRACOLoader.js';
import { CSS3DRenderer, CSS3DObject } from '../vendor/CSS3DRenderer.js';
const HEX = (v, f) => (v = String(v ?? '').trim(), /^#([A-Fa-f\d]{3}|[A-Fa-f\d]{6})$/.test(v) ? v : f);
const CSSV = getComputedStyle(document.documentElement);
const tok = (n, f) => HEX(CSSV.getPropertyValue(n), f);
const BG = tok('--BACKGROUND', '#e0e0e0');
const FG = tok('--COLOR', '#000');
const LN = tok('--OUTLINE', '#c5c5c5');
const DEFAULTS = {
  scenery: '/assets/scene/studio.gltf', scenerySize: 14, sceneryY: 0,
  fogColor: BG, fogNear: 8, fogFar: 16,
  camHeight: 3.25, camZ: 1.75, camYaw: 90, camPitch: -0.6, camTarget: 0.15,
  fov: 50, fovMax: 82, near: 0.1, far: 50, aspectBase: 1.7778,
  antialias: 1, pixelRatio: 2, exposure: 1,
  envSize: 20, envHeight: 12, envTop: 12, envTopY: 5.9, envTopColor: BG, envBlur: 0.04,
  ambient: 0.15, hemi: 0.3, hemiGround: LN,
  keyColor: BG, keyPower: 16, keyW: 1.3, keyH: 1.7, keyScale: 1,
  keyColor2: BG, key2Power: 9, key2W: 1.1, key2H: 1.4,
  shadowPower: 22, shadowAngle: 0.55, shadowPenumbra: 0.6, shadowDecay: 2,
  shadowMap: 4096, shadowBias: -0.0002, shadowBlur: 6,
  spotPower: 7, spotAngle: 0.5, spotPenumbra: 0.55, spotDecay: 2,
  spotMax: 10, spotDrop: 0.1, spotThrow: 3, spotVertical: 0.35, emissive: 2.2,
  ceiling: 4.3,
  panelWidth: 2.4, panelPx: 480, panelPhase: 1.37,
  swayAmount: 0.035, swayTilt: 0.02, swayTiltRate: 0.7, swaySpeed: 0.6, swayStep: 0.13,
  hoverScale: 0.07, hoverEase: 9,
  focusDur: 1, focusFrac: 0.52, focusFracPortrait: 0.86, focusOffset: 0.14,
  focusPortraitAspect: 0.95, focusSway: 0.75,
  parallax: 1, parallaxX: 0.32, parallaxY: 0.16, parallaxFocus: 0.9,
  ease: 0.035,
  follow: 'camera',
};
const cfg = (() => {
  const d = { ...document.body.dataset };
  new URLSearchParams(location.search).forEach((v, k) => {
    d[k.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())] = v;
  });
  const o = {};
  for (const k in DEFAULTS) {
    const v = d[k];
    o[k] = v === undefined ? DEFAULTS[k]
      : typeof DEFAULTS[k] === 'number' ? parseFloat(v)
        : typeof DEFAULTS[k] === 'string' && DEFAULTS[k][0] === '#' ? HEX(v, DEFAULTS[k])
          : v;
  }
  return o;
})();
const stage = document.getElementById('STAGE');
const scene = new THREE.Scene();
scene.background = new THREE.Color(cfg.fogColor);
scene.fog = new THREE.Fog(cfg.fogColor, cfg.fogNear, cfg.fogFar);
const camera = new THREE.PerspectiveCamera(cfg.fov, innerWidth / innerHeight, cfg.near, cfg.far);
camera.position.set(0, cfg.camHeight, cfg.camZ);
function applyResponsiveFov() {
  const a = innerWidth / innerHeight;
  if (a >= cfg.aspectBase) {
    camera.fov = cfg.fov;
  } else {
    const hFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(cfg.fov / 2)) * cfg.aspectBase);
    camera.fov = Math.min(cfg.fovMax, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hFov / 2) / a)));
  }
  camera.aspect = a;
  camera.updateProjectionMatrix();
  cssCamera.fov = camera.fov;
  cssCamera.aspect = a;
  cssCamera.updateProjectionMatrix();
}
const gl = new THREE.WebGLRenderer({ antialias: !!cfg.antialias });
gl.setPixelRatio(Math.min(devicePixelRatio, cfg.pixelRatio));
gl.setSize(innerWidth, innerHeight);
gl.outputColorSpace = THREE.SRGBColorSpace;
gl.toneMapping = THREE.ACESFilmicToneMapping;
gl.toneMappingExposure = cfg.exposure;
gl.shadowMap.enabled = true;
gl.shadowMap.type = THREE.PCFSoftShadowMap;
gl.shadowMap.autoUpdate = false;
const pmrem = new THREE.PMREMGenerator(gl);
const envScene = new THREE.Scene();
envScene.add(new THREE.Mesh(
  new THREE.BoxGeometry(cfg.envSize, cfg.envHeight, cfg.envSize),
  new THREE.MeshBasicMaterial({ color: new THREE.Color(cfg.fogColor), side: THREE.BackSide })
));
const envTop = new THREE.Mesh(
  new THREE.PlaneGeometry(cfg.envTop, cfg.envTop),
  new THREE.MeshBasicMaterial({ color: new THREE.Color(cfg.envTopColor) })
);
envTop.rotation.x = Math.PI / 2;
envTop.position.y = cfg.envTopY;
envScene.add(envTop);
scene.environment = pmrem.fromScene(envScene, cfg.envBlur).texture;
pmrem.dispose();
envScene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
stage.appendChild(gl.domElement);
const CSS_SCALE = 160;
const cssScene = new THREE.Scene();
const cssCamera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 1, 60000);
const css = new CSS3DRenderer();
css.setSize(innerWidth, innerHeight);
css.domElement.classList.add('CSS3D-LAYER');
css.domElement.style.position = 'absolute';
css.domElement.style.inset = '0';
stage.appendChild(css.domElement);
css.domElement.firstElementChild.style.pointerEvents = 'auto';
applyResponsiveFov();
import { RectAreaLightUniformsLib } from '../vendor/RectAreaLightUniformsLib.js';
RectAreaLightUniformsLib.init();
scene.add(new THREE.AmbientLight(0xffffff, cfg.ambient));
scene.add(new THREE.HemisphereLight(0xffffff, new THREE.Color(cfg.hemiGround), cfg.hemi));
const softboxR = new THREE.RectAreaLight(new THREE.Color(cfg.keyColor), cfg.keyPower, cfg.keyW, cfg.keyH);
softboxR.position.set(-1.1, 2.6, 2.3);
softboxR.lookAt(-3.55, 1.7, -0.1);
scene.add(softboxR);
const softboxL = new THREE.RectAreaLight(new THREE.Color(cfg.keyColor2), cfg.key2Power, cfg.key2W, cfg.key2H);
softboxL.position.set(-1.7, 2.85, -2.4);
softboxL.lookAt(-3.55, 1.9, 0.2);
scene.add(softboxL);
const shadowSpot = new THREE.SpotLight(0xffffff, cfg.shadowPower, 0, cfg.shadowAngle, cfg.shadowPenumbra, cfg.shadowDecay);
shadowSpot.position.copy(softboxR.position);
shadowSpot.target.position.set(-3.55, 1.7, -0.1);
shadowSpot.castShadow = true;
shadowSpot.shadow.mapSize.set(cfg.shadowMap, cfg.shadowMap);
shadowSpot.shadow.bias = cfg.shadowBias;
shadowSpot.shadow.radius = cfg.shadowBlur;
scene.add(shadowSpot, shadowSpot.target);
function attachFixtureLights(root) {
  const heads = [];
  const diffusers = [];
  const bodies = [];
  const aimBox = new THREE.Box3();
  let hasAim = false;
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (/Backdrop_\d/i.test(o.name)) { aimBox.expandByObject(o); hasAim = true; }
    if (/Softbox_Diffuser|Umbrella|Octa/i.test(o.name)) diffusers.push(o);
    else if (/Softbox_\d/i.test(o.name) && !/Adapter/i.test(o.name)) bodies.push(o);
    else if (/Spotlight_\d/i.test(o.name) && !/Ceiling|Flap/i.test(o.name)) {
      const p = o.getWorldPosition(new THREE.Vector3());
      if (!heads.some(h => h.p.distanceToSquared(p) < 0.05)) heads.push({ p, o });
    }
  });
  const AIM = hasAim
    ? aimBox.getCenter(new THREE.Vector3())
    : new THREE.Vector3(0, cfg.camHeight, 0);
  const _axis = new THREE.Vector3();
  const _size = new THREE.Vector3();
  for (const h of cfg.spotPower > 0 ? heads.slice(0, cfg.spotMax) : []) {
    const l = new THREE.SpotLight(0xffffff, cfg.spotPower, 0, cfg.spotAngle, cfg.spotPenumbra, cfg.spotDecay);
    l.position.copy(h.p);
    l.position.y -= cfg.spotDrop;
    let bestY = 0;
    for (let i = 0; i < 3; i++) {
      _size.setFromMatrixColumn(h.o.matrixWorld, i).normalize();
      if (Math.abs(_size.y) > Math.abs(bestY)) { bestY = _size.y; _axis.copy(_size); }
    }
    if (_axis.y > 0) _axis.negate();
    if (Math.abs(_axis.y) < cfg.spotVertical) l.target.position.copy(AIM);
    else l.target.position.copy(h.p).addScaledVector(_axis, cfg.spotThrow);
    scene.add(l, l.target);
  }
  for (const d of diffusers) {
    d.material = d.material.clone();
    d.material.emissive = new THREE.Color(cfg.fogColor);
    d.material.emissiveIntensity = cfg.emissive;
  }
  const free = diffusers.slice();
  const _p = new THREE.Vector3(), _b = new THREE.Box3(), _s = new THREE.Vector3(), _n = new THREE.Vector3();
  for (const r of [softboxR, softboxL]) {
    let bd = Infinity, bi = -1;
    free.forEach((d, i) => {
      const dd = d.getWorldPosition(_p).distanceToSquared(r.position);
      if (dd < bd) { bd = dd; bi = i; }
    });
    if (bi < 0) { scene.remove(r); continue; }
    const d = free[bi];
    free.splice(bi, 1);
    _b.setFromObject(d);
    _b.getCenter(r.position);
    _b.getSize(_s);
    let bb = Infinity, body = null;
    for (const o of bodies) {
      const dd = o.getWorldPosition(_p).distanceToSquared(r.position);
      if (dd < bb) { bb = dd; body = o; }
    }
    if (body) _n.copy(r.position).sub(body.getWorldPosition(_p));
    else _n.copy(AIM).sub(r.position);
    if (_n.lengthSq() < 1e-6) _n.copy(AIM).sub(r.position);
    _n.normalize();
    if (_n.dot(_p.copy(AIM).sub(r.position)) < 0) _n.negate();
    r.width = Math.max(0.2, Math.max(_s.x, _s.z) * cfg.keyScale);
    r.height = Math.max(0.2, _s.y * cfg.keyScale);
    r.lookAt(_p.copy(r.position).add(_n));
    if (r === softboxR) {
      shadowSpot.position.copy(r.position);
      shadowSpot.target.position.copy(r.position).addScaledVector(_n, cfg.spotThrow);
    }
  }
}
const draco = new DRACOLoader();
draco.setDecoderPath('vendor/draco/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(draco);
if (/^(none|off|0)$/i.test(cfg.scenery)) {
  Object.assign(window.SET ??= {}, { scene, camera, cfg, root: null });
} else gltfLoader.load(
  cfg.scenery,
  (gltf) => {
    const root = gltf.scene;
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    root.scale.setScalar(cfg.scenerySize / Math.max(size.x, size.y, size.z));
    box.setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box.min.y - cfg.sceneryY;
    const lum = (c) => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
    const PAL = [BG, LN, FG].map((h) => new THREE.Color(h)).sort((a, b) => lum(b) - lum(a));
    const LV = PAL.map(lum);
    const hi = (LV[0] + LV[1]) / 2, lo = (LV[1] + LV[2]) / 2;
    const done = new Set();
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      const mat = o.material;
      if (!mat || !mat.color || done.has(mat)) return;
      done.add(mat);
      const v = lum(mat.color);
      mat.color.copy(v >= hi ? PAL[0] : v >= lo ? PAL[1] : PAL[2]);
    });
    attachFixtureLights(root);
    scene.add(root);
    gl.shadowMap.needsUpdate = true;
    Object.assign(window.SET ??= {}, { scene, camera, cfg, root });
  },
  undefined,
  (err) => {
    console.error('Errore caricamento scenografia:', err);
  }
);
const hitGeo = new THREE.PlaneGeometry(1, 1);
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const hangers = [];
document.querySelectorAll('#PROJECTS .PROJECT').forEach((el, i) => {
  const [x, y, z] = (el.dataset.pos ?? '0 1.6 0').split(/\s+/).map(Number);
  const rotY = THREE.MathUtils.degToRad(parseFloat(el.dataset.rotY ?? 0));
  const widthM = parseFloat(el.dataset.width ?? cfg.panelWidth);
  const sway = parseFloat(el.dataset.sway ?? 1);
  const phase = parseFloat(el.dataset.phase ?? i * cfg.panelPhase);
  el.style.display = 'block';
  const pxW = el.offsetWidth || cfg.panelPx;
  const pxH = el.offsetHeight || pxW * 9 / 16;
  const k = widthM / pxW;
  const hM = pxH * k;
  const pivot = new THREE.Group();
  pivot.position.set(x, y + hM / 2, z);
  pivot.rotation.y = rotY;
  scene.add(pivot);
  const cssPivot = new THREE.Group();
  cssScene.add(cssPivot);
  const cssObj = new CSS3DObject(el);
  cssObj.scale.setScalar(k * CSS_SCALE);
  cssObj.position.y = -(hM / 2) * CSS_SCALE;
  cssPivot.add(cssObj);
  const hitPlane = new THREE.Mesh(hitGeo, hitMat);
  hitPlane.scale.set(widthM, hM, 1);
  hitPlane.position.y = -hM / 2;
  pivot.add(hitPlane);
  const hanger = {
    el, pivot, cssPivot, cssObj, hitPlane, sway, phase,
    speed: cfg.swaySpeed + (i % 3) * cfg.swayStep, hM, widthM,
    basePos: pivot.position.clone(), baseRotY: rotY,
    baseCssScale: k * CSS_SCALE,
    hotE: 0,
  };
  hitPlane.userData.hanger = hanger;
  hangers.push(hanger);
});
Object.assign(window.SET ??= {}, { hangers });
const activePlanes = hangers.map(h => h.hitPlane);
const cursorLabel = document.getElementById('CURSOR');
let focus = null;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function openFocus(article) {
  if (focus) return;
  const h = hangers.find(x => x.el === article);
  if (!h) return;
  focus = { h, e: 0, dir: 1 };
  article.classList.add('IS-FOCUSED');
  document.body.classList.add('FOCUS-OPEN');
}
function closeFocus() {
  if (!focus || focus.dir < 0) return;
  focus.dir = -1;
  focus.h.el.classList.remove('IS-FOCUSED');
  document.body.classList.remove('FOCUS-OPEN');
}
const raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _hits = [];
function pickHanger(clientX, clientY) {
  if (clientX < -9e3) return null;
  _ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(_ndc, camera);
  _hits.length = 0;
  raycaster.intersectObjects(activePlanes, false, _hits);
  return _hits[0]?.object.userData.hanger ?? null;
}
let hotHanger = null;
function setHot(h) {
  if (hotHanger === h) return;
  hotHanger?.el.classList.remove('IS-HOT');
  hotHanger = h;
  hotHanger?.el.classList.add('IS-HOT');
  document.body.classList.toggle('PANEL-HOT', !!h);
}
addEventListener('click', (e) => {
  if (document.body.classList.contains('FOCUS-OPEN')) { closeFocus(); return; }
  const h = pickHanger(e.clientX, e.clientY);
  if (h) openFocus(h.el);
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFocus(); });
const _n = new THREE.Vector3(), _center = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
function focusCamPose(h, out) {
  _n.set(Math.sin(h.baseRotY), 0, Math.cos(h.baseRotY));
  _center.copy(h.basePos).addScaledVector(UP, -h.hM / 2);
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const portrait = camera.aspect < cfg.focusPortraitAspect;
  const frac = portrait ? cfg.focusFracPortrait : cfg.focusFrac;
  const d = h.widthM / (frac * 2 * Math.tan(hFov / 2));
  const scrH = (h.widthM / frac) / camera.aspect;
  out.pos.copy(_center).addScaledVector(_n, d);
  out.target.copy(_center);
  if (portrait) out.target.addScaledVector(UP, -cfg.focusOffset * scrH);
}
const _fc = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
const mouse = new THREE.Vector2(0, 0);
const target = new THREE.Vector2(0, 0);
let pointerX = -1e4, pointerY = -1e4;
addEventListener('pointermove', (e) => {
  pointerX = e.clientX; pointerY = e.clientY;
  target.x = (e.clientX / innerWidth) * 2 - 1;
  target.y = (e.clientY / innerHeight) * 2 - 1;
  if (focus) {
    cursorLabel.style.left = e.clientX + 'px';
    cursorLabel.style.top = e.clientY + 'px';
  }
});
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const followSign = cfg.follow === 'scene' ? 1 : -1;
const yaw = THREE.MathUtils.degToRad(cfg.camYaw);
const basePos = new THREE.Vector3(
  Math.sin(yaw) * cfg.camZ, cfg.camHeight, Math.cos(yaw) * cfg.camZ
);
const baseTarget = new THREE.Vector3(0, cfg.camHeight + cfg.camTarget + cfg.camPitch, 0);
const fwd = baseTarget.clone().sub(basePos).setY(0).normalize();
const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
const _camPos = new THREE.Vector3(), _camTgt = new THREE.Vector3();
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  if (focus) {
    focus.e = THREE.MathUtils.clamp(focus.e + (dt / cfg.focusDur) * focus.dir, 0, 1);
    if (focus.e === 0 && focus.dir < 0) focus = null;
  }
  const ease = focus ? easeInOut(focus.e) : 0;
  mouse.lerp(target, cfg.ease);
  const px = cfg.parallax * (1 - ease * cfg.parallaxFocus) * followSign;
  const lateral = mouse.x * cfg.parallaxX * px;
  _camPos.copy(basePos).addScaledVector(right, lateral);
  _camPos.y = cfg.camHeight - mouse.y * cfg.parallaxY * px;
  _camTgt.copy(baseTarget);
  if (focus) {
    focusCamPose(focus.h, _fc);
    _camPos.lerp(_fc.pos, ease);
    _camTgt.lerp(_fc.target, ease);
  }
  camera.position.copy(_camPos);
  camera.lookAt(_camTgt);
  setHot(focus ? null : pickHanger(pointerX, pointerY));
  for (const h of hangers) {
    const swayScale = (reduceMotion ? 0 : 1) *
      (focus && focus.h === h ? 1 - ease * cfg.focusSway : 1);
    const rz = Math.sin(t * h.speed + h.phase) * cfg.swayAmount * h.sway * swayScale;
    const rx = Math.sin(t * h.speed * cfg.swayTiltRate + h.phase) * cfg.swayTilt * h.sway * swayScale;
    h.pivot.rotation.set(rx, h.baseRotY, rz);
    const L = cfg.ceiling - h.basePos.y;
    const offX = Math.sin(rz) * L;
    const offZ = Math.sin(rx) * L;
    const offY = (1 - Math.cos(rz) * Math.cos(rx)) * L;
    const cY = Math.cos(h.baseRotY), sY = Math.sin(h.baseRotY);
    h.pivot.position.set(
      h.basePos.x + offX * cY + offZ * sY,
      h.basePos.y + offY,
      h.basePos.z - offX * sY + offZ * cY
    );
    const hotTarget = (hotHanger === h && !focus) ? 1 : 0;
    h.hotE += (hotTarget - h.hotE) * Math.min(1, dt * cfg.hoverEase);
    const hs = 1 + cfg.hoverScale * h.hotE;
    h.cssObj.scale.setScalar(h.baseCssScale * hs);
    h.hitPlane.scale.set(h.widthM * hs, h.hM * hs, 1);
    h.cssPivot.quaternion.copy(h.pivot.quaternion);
    h.cssPivot.position.copy(h.pivot.position).multiplyScalar(CSS_SCALE);
  }
  gl.render(scene, camera);
  cssCamera.position.copy(camera.position).multiplyScalar(CSS_SCALE);
  cssCamera.quaternion.copy(camera.quaternion);
  css.render(cssScene, cssCamera);
  requestAnimationFrame(tick);
}
tick();
addEventListener('resize', () => {
  applyResponsiveFov();
  gl.setSize(innerWidth, innerHeight);
  css.setSize(innerWidth, innerHeight);
});
