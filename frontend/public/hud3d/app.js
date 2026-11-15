// Beyond Horizons — Space Health Monitoring System (HUD front-end)
// Vanilla JS + three.js. Mission scenario readings are SIMULATED; research tabs read the Beyond Horizons API.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { initResearch, onTab, logScan, getGenesData, getMissionData } from './research.js?v=15';
import { chips, initSources } from './sources.js?v=15';

/* ============================================================
   CONFIG
   ============================================================ */
const CONFIG = {
  mission: 'STS-1187',
  astronaut: 'J. KELLER',
  // The NASA insignia ("meatball") is restricted for Space Apps projects.
  // Keep false for the submission; set true only for private mock-ups.
  useNasaInsignia: false,
  startElapsed: 124 * 3600 + 32 * 60 + 17,
  startNextCheckpoint: 2 * 3600 + 15 * 60 + 43,
  bloom: true,
  // anatomy placement inside the astronaut (astronaut-space units)
  anat: { scale: 1.62, x: 0, y: 0.09, z: 0.0 },
};
const qs = new URLSearchParams(location.search);
if (qs.has('nasa')) CONFIG.useNasaInsignia = qs.get('nasa') !== '0';
if (qs.get('bloom') === '0') CONFIG.bloom = false;

/* ============================================================
   REFERENCE RANGES + SCENARIOS (simulated)
   ============================================================ */
const RANGES = {
  hr:   { label: 'Heart rate', unit: 'bpm',   ok: [60, 100], warn: [50, 120] },
  spo2: { label: 'SpO₂',       unit: '%',     ok: [95, 100], warn: [90, 100] },
  temp: { label: 'Core temp',  unit: '°C',    ok: [36.1, 37.5], warn: [35.5, 38.5] },
  sys:  { label: 'Systolic BP',unit: 'mmHg',  ok: [90, 130], warn: [85, 145] },
  rr:   { label: 'Resp. rate', unit: 'br/min',ok: [12, 20], warn: [10, 24] },
};
const ENV_RANGES = {
  o2:    { ok: [19.5, 23.5], warn: [18.5, 24] },
  co2:   { ok: [0, 0.395], warn: [0, 0.53] },   // % ; 0.395% ≈ 3 mmHg (NASA-STD-3001 V2 6004)
  press: { ok: [14.2, 15.2], warn: [13.9, 15.4] },
  temp:  { ok: [18, 27], warn: [17, 28] },       // NASA-STD-3001 V2 6012
  rad:   { ok: [0, 0.021], warn: [0, 0.084] },  // mSv/h ; ≤0.5 mSv/d (ISS), ≤2 mSv/d (deep-space GCR, MSL RAD 1.8)
};
function classify(v, r) {
  if (v >= r.ok[0] && v <= r.ok[1]) return 'ok';
  if (v >= r.warn[0] && v <= r.warn[1]) return 'warn';
  return 'crit';
}

const BASE_V = { hr: 72, spo2: 98, temp: 36.6, sys: 118, dia: 76, rr: 16 };
const BASE_E = { o2: 21.0, co2: 0.30, press: 14.7, temp: 22.4, rad: 0.015 };
const ALL_OK = { skeletal: 'ok', muscular: 'ok', cardiovascular: 'ok', respiratory: 'ok', neurological: 'ok', digestive: 'ok' };
const SYS_OK = { life: 'ok', thermal: 'ok', rad: 'ok', comm: 'ok' };

const SCENARIOS = [
  { id: 'nominal', name: 'Nominal', level: 'ok',
    desc: 'Baseline crew health during routine Low Earth Orbit operations.',
    v: {}, e: {}, organs: {}, sys: {}, gen: { expr: 98.1, mut: ['Low', 22] }, neural: 92.4, src: ['iss_dose', 'std3001_co2'],
    ai: ['All systems nominal.', 'No immediate health risks detected. Continue current mission profile.'],
    recs: ['Keep the daily exercise block (≈2 h) on schedule.', 'Next routine medical check at the upcoming checkpoint.'] },
  { id: 'hypoxia', name: 'Hypoxia — cabin O₂ drop', level: 'crit',
    desc: 'Oxygen generation fault lowers cabin O₂; blood oxygen saturation falls.',
    v: { hr: 108, spo2: 87, temp: 36.8, sys: 128, dia: 82, rr: 26 }, e: { o2: 17.6, co2: 0.45, press: 14.4 },
    organs: { respiratory: 'crit', neurological: 'warn', cardiovascular: 'warn' }, sys: { life: 'crit' }, src: ['std3001_atm', 'std3001_co2'],
    gen: { expr: 96.9, mut: ['Low', 24] }, neural: 78.2,
    ai: ['<span class="c">SpO₂ 87% — hypoxemia detected.</span>', 'Cabin O₂ below safe range. Don O₂ mask and check the oxygen generation system.'],
    recs: ['Put on emergency O₂ mask immediately.', 'Verify the Oxygen Generation Assembly and cabin pressure.', 'Watch for confusion or headache (early neurological signs).'] },
  { id: 'arrhythmia', name: 'Cardiac arrhythmia', level: 'crit',
    desc: 'Irregular, fast heartbeat detected on the ECG trace.',
    v: { hr: 142, spo2: 95, temp: 36.9, sys: 146, dia: 94, rr: 21 }, irregular: true,
    organs: { cardiovascular: 'crit' }, sys: {}, gen: { expr: 97.4, mut: ['Low', 23] }, neural: 88.0, src: ['hrp_cardiac'],
    ai: ['<span class="c">Irregular R-R intervals · HR 142 bpm.</span>', 'Pattern consistent with atrial fibrillation (a risk NASA tracks). Stop exertion, contact the flight surgeon.'],
    recs: ['Stop all physical exertion.', 'Record a 12-lead ECG and downlink to the flight surgeon.', 'Prepare the medical kit per the cardiac procedure.'] },
  { id: 'radiation', name: 'Solar particle event', level: 'warn',
    desc: 'A solar storm raises the radiation dose rate inside the habitat.',
    v: { hr: 84, temp: 37.0, sys: 122, dia: 80, rr: 17 }, e: { rad: 0.5 }, src: ['iss_dose', 'msl_rad', 'osd720'],
    organs: { skeletal: 'warn', digestive: 'warn' }, sys: { rad: 'warn' },
    gen: { expr: 91.4, mut: ['Elevated', 64] }, neural: 90.1,
    get ai() { const r = radInfo(); return [`<span class="w">Dose rate ${r.total.toFixed(1)} mSv/day — about ${Math.round(r.total / 0.35)}× the ISS average (${r.base} mSv/day ${r.label} + solar event ${r.spe} mSv${r.speSet ? ', set in GENETICS' : ' default; set yours in GENETICS'}).</span>`, 'Move to the shielded storm shelter and log cumulative dose.']; },
    recs: ['Relocate crew to the storm shelter (most shielded module).', 'Track cumulative dose against mission limits (see GENETICS → career total).', 'Bone marrow and the digestive (GI) tract are among the most radiation-sensitive tissues, so they are highlighted.'] },
  { id: 'heat', name: 'Heat stress', level: 'warn',
    desc: 'Thermal control degraded; core temperature and heart rate rise.',
    v: { hr: 118, spo2: 97, temp: 38.7, sys: 100, dia: 64, rr: 22 }, e: { temp: 29.5 }, src: ['std3001_env'],
    organs: { cardiovascular: 'warn', neurological: 'warn' }, sys: { thermal: 'crit' },
    gen: { expr: 95.8, mut: ['Low', 26] }, neural: 84.6,
    ai: ['<span class="w">Core temp 38.7 °C with rising HR.</span>', 'Thermal loop degraded. Increase cooling, rehydrate and pause EVA prep.'],
    recs: ['Increase cabin cooling / switch to the backup thermal loop.', 'Drink ≈500 mL of fluid with electrolytes.', 'Postpone EVA preparation until core temperature normalises.'] },
  { id: 'bone', name: 'Bone density loss', level: 'warn',
    desc: 'Long-duration microgravity trend: gradual loss of bone mineral density.',
    v: { hr: 70 }, organs: { skeletal: 'warn', muscular: 'warn' }, sys: {}, src: ['hrp_bone', 'lang2004', 'lsda_osteo', 'hrp_muscle'],
    gen: { expr: 97.2, mut: ['Low', 25] }, neural: 92.0,
    ai: ['<span class="w">Bone density trend −1.2 %/month.</span>', 'Within NASA’s 1–1.5 %/month for 4–6-month missions. Increase resistive exercise.'],
    recs: ['Increase resistive exercise sessions on the ARED device.', 'Review calcium and vitamin D intake.', 'Schedule a follow-up density estimate.'] },
  { id: 'sans', name: 'SANS — headward fluid shift', level: 'warn',
    desc: 'Spaceflight Associated Neuro-ocular Syndrome: microgravity fluid shift changes eye and brain structure.',
    v: { hr: 68 }, organs: { neurological: 'warn' }, sys: {}, src: ['hrp_sans'],
    gen: { expr: 97.6, mut: ['Low', 23] }, neural: 89.5,
    ai: ['<span class="w">Neuro-ocular changes flagged (SANS pattern).</span>', 'Over half of crewmembers show ≥1 SANS symptom. Schedule an onboard OCT eye exam.'],
    recs: ['Run an onboard OCT / fundoscopy exam and compare with the pre-flight baseline.', 'Log any near-vision blur or headache.', 'Countermeasures under study include lower-body negative pressure and B-vitamin status (research stage).'] },
];
function scen() { return SCENARIOS[state.scen]; }
const BASE_COUNT = SCENARIOS.length;
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
const SET_KEY = 'beyond-horizons:hud-settings', CS_KEY = 'beyond-horizons:custom-scenarios';
const DEFAULT_SET = { astronaut: 'J. KELLER', mission: 'STS-1187', phase: 'Low Earth Orbit ops', crew: 4, elapsedH: 124.54 };
let settings = { ...DEFAULT_SET, ...lsGet(SET_KEY, {}) };
let selfScenario = null;

/* ============================================================
   STATE
   ============================================================ */
const state = {
  mode: 'astronaut', scen: 0, t0: performance.now(),
  v: { ...BASE_V }, e: { ...BASE_E },
  hist: { hr: [], spo2: [], temp: [], sys: [], rr: [] },
  scanProg: 0.87, scanFast: false, neural: 92.4, clock0: performance.now(),
};

/* ============================================================
   LAYOUT — scale the 1920×1080 HUD to the window
   ============================================================ */
const app = document.getElementById('app');
let S = 1;
const ZOOMS = [1, 1.15, 1.3, 1.5, 1.75, 2];
let uiZoom = (() => { try { return +localStorage.getItem('beyond-horizons:ui-zoom') || 1; } catch { return 1; } })();
function layout() {
  const fit = Math.min(innerWidth / 1920, innerHeight / 1080);
  S = fit * uiZoom;
  const W = 1920 * S, H = 1080 * S, ox = Math.max(0, (innerWidth - W) / 2), oy = Math.max(0, (innerHeight - H) / 2);
  app.style.transform = `translate(${ox}px,${oy}px) scale(${S})`;
  const st = document.getElementById('stage');
  st.style.width = Math.max(innerWidth, W) + 'px'; st.style.height = Math.max(innerHeight, H) + 'px';
  document.documentElement.classList.toggle('zoomed', uiZoom > 1);
  const zv = document.getElementById('zoomVal'); if (zv) zv.textContent = Math.round(uiZoom * 100) + '%';
  sizeHolo(); sizeMini(); sizeWaves();
}
function setZoom(dir) {
  const i = Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(uiZoom) + dir));
  uiZoom = ZOOMS[i] ?? 1; try { localStorage.setItem('beyond-horizons:ui-zoom', uiZoom); } catch { /* ignore */ }
  layout();
}
addEventListener('scroll', () => sizeHolo(), { passive: true });

/* ============================================================
   LOADING
   ============================================================ */
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const MODEL_LIST = ['astronaut', 'organs', 'vessels', 'heart', 'brain', 'brain-holo', 'dna', 'earth', 'iss', 'lungs', 'mars', 'station'];
if (CONFIG.useNasaInsignia) MODEL_LIST.push('nasa');
const progress = {};
const models = {};
function setLoad() {
  const vals = MODEL_LIST.map(n => progress[n] || 0);
  const p = vals.reduce((a, b) => a + b, 0) / MODEL_LIST.length;
  document.getElementById('ldBar').style.width = (p * 100).toFixed(0) + '%';
  document.getElementById('ldPct').textContent = (p * 100).toFixed(0) + '%';
}
function load(name) {
  return new Promise((res) => {
    loader.load(`models/${name}.glb`, g => { progress[name] = 1; setLoad(); models[name] = g; res(g); },
      x => { if (x.total) { progress[name] = x.loaded / x.total * 0.95; setLoad(); } },
      err => { console.warn('model failed', name, err); progress[name] = 1; setLoad(); res(null); });
  });
}

/* ============================================================
   HOLOGRAM MATERIAL (fresnel + scan line + reveal), works with skinning
   ============================================================ */
const holoTime = { value: 0 };
const scanY = { value: -10 };      // world-space Y of the scan line
const revealY = { value: 100 };    // fragments above this world Y are hidden
function makeHolo(o = {}) {
  const m = new THREE.MeshLambertMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: o.side ?? THREE.FrontSide,
  });
  const u = {
    uColor: { value: new THREE.Color(o.color ?? 0x39c6ff) },
    uBase: { value: o.base ?? 0.06 }, uRim: { value: o.rim ?? 1.0 }, uPow: { value: o.pow ?? 2.2 },
    uOpacity: { value: o.opacity ?? 1.0 }, uStripe: { value: o.stripe ?? 0.0 },
    uPulse: { value: 0 }, uPulseSpeed: { value: 4.0 },
    uScanW: { value: o.scanW ?? 0.06 }, uScanGain: { value: o.scanGain ?? 1.0 },
    uUseReveal: { value: o.reveal ? 1 : 0 },
    uTime: holoTime, uScanY: scanY, uReveal: revealY,
  };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vHoloY;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvHoloY = (modelMatrix * vec4(transformed,1.0)).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vHoloY; uniform vec3 uColor; uniform float uBase,uRim,uPow,uOpacity,uStripe,uPulse,uPulseSpeed,uScanW,uScanGain,uUseReveal,uTime,uScanY,uReveal;`)
      .replace('#include <dithering_fragment>', `
        if (uUseReveal > 0.5 && vHoloY > uReveal) discard;
        float fr = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
        fr = pow(clamp(fr,0.0,1.0), uPow);
        float s = uBase + fr*uRim;
        float stripe = uStripe > 0.0 ? 0.78 + 0.22*step(0.5, fract(vHoloY*uStripe - uTime*0.6)) : 1.0;
        float scan = smoothstep(uScanW, 0.0, abs(vHoloY-uScanY)) * uScanGain;
        float pulse = 1.0 + uPulse*(0.5+0.5*sin(uTime*uPulseSpeed));
        vec3 col = uColor * s * stripe * pulse + vec3(0.55,0.9,1.0)*scan;
        gl_FragColor = vec4(col, clamp((s*uOpacity + scan*0.7)*pulse, 0.0, 1.0));`);
  };
  m.customProgramCacheKey = () => 'holo-v1';
  return m;
}

/* ============================================================
   MAIN HOLOGRAM SCENE
   ============================================================ */
const holoCanvas = document.getElementById('holoCanvas');
const holo = {};
function initHolo() {
  const r = new THREE.WebGLRenderer({ canvas: holoCanvas, antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  r.setClearColor(0x03112b, 1);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x03112b, 0.02);
  const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 400);
  cam.position.set(0, 1.62, 8.6);
  const ctl = new OrbitControls(cam, holoCanvas);
  ctl.target.set(0, 1.52, 0); ctl.enableZoom = true; ctl.enablePan = true; ctl.screenSpacePanning = true;
  ctl.minDistance = 4.2; ctl.maxDistance = 14; ctl.zoomSpeed = 0.7; ctl.panSpeed = 0.6;
  ctl.minPolarAngle = Math.PI * 0.2; ctl.maxPolarAngle = Math.PI * 0.62; ctl.enableDamping = true;
  ctl.rotateSpeed = 0.6;
  ctl.update();
  ctl.saveState();
  holoCanvas.addEventListener('dblclick', () => ctl.reset());

  scene.add(new THREE.HemisphereLight(0x9fd0ff, 0x0a1830, 1.3));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2.5, 5, 6); scene.add(key);
  const rim1 = new THREE.DirectionalLight(0x39c6ff, 3.0); rim1.position.set(-4, 3, -4); scene.add(rim1);
  const rim2 = new THREE.DirectionalLight(0x5aa8ff, 2.0); rim2.position.set(4, 2, -3); scene.add(rim2);
  const fill = new THREE.PointLight(0x2f8fff, 6, 8); fill.position.set(0, 0.3, 2); scene.add(fill);

  // platform + light column
  const plat = new THREE.Group(); scene.add(plat);
  const addRing = (r0, r1, op, seg = 128, dash = 0) => {
    let g;
    if (dash) {
      g = new THREE.BufferGeometry();
      const parts = [];
      for (let i = 0; i < dash; i++) {
        const a0 = i / dash * Math.PI * 2, a1 = a0 + Math.PI * 2 / dash * 0.6;
        const rg = new THREE.RingGeometry(r0, r1, 8, 1, a0, a1 - a0); parts.push(rg);
      }
      g = mergeGeoms(parts);
    } else g = new THREE.RingGeometry(r0, r1, seg);
    const m = new THREE.MeshBasicMaterial({ color: 0x39c6ff, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, m); mesh.rotation.x = -Math.PI / 2; plat.add(mesh); return mesh;
  };
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.25, 96), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: holoTime },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv; uniform float uT; void main(){ float d=length(vUv-0.5)*2.0;
      float g = smoothstep(1.0,0.0,d)*0.2 + smoothstep(0.04,0.0,abs(fract(d*6.0-uT*0.4)-0.5)-0.44)*0.25*(1.0-d);
      gl_FragColor = vec4(vec3(0.15,0.6,1.0)*g, g); }`,
  }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.005; plat.add(disc);
  addRing(1.18, 1.24, 0.9); addRing(1.32, 1.35, 0.6); addRing(0.9, 0.92, 0.5);
  holo.spinA = addRing(1.42, 1.5, 0.55, 0, 36); holo.spinB = addRing(1.02, 1.08, 0.45, 0, 12);
  addRing(1.62, 1.635, 0.35);
  // light column (open cylinder, vertical fade)
  const col = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 3.9, 96, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uT: holoTime },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv; uniform float uT; void main(){ float a = pow(1.0-vUv.y, 2.4)*0.16;
      a += 0.05*step(0.92, fract(vUv.y*28.0 + uT*0.25))*(1.0-vUv.y);
      gl_FragColor = vec4(vec3(0.2,0.65,1.0)*a, a); }`,
  }));
  col.position.y = 1.95; plat.add(col);
  // floating particles
  const N = 500, pg = new THREE.BufferGeometry(), pp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const a = Math.random() * 6.283, rr = Math.random() * 1.3; pp.set([Math.cos(a) * rr, Math.random() * 3.6, Math.sin(a) * rr], i * 3); }
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  holo.parts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x7fe0ff, size: 0.025, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(holo.parts);
  // scan plane
  const sp = new THREE.Mesh(new THREE.RingGeometry(0.02, 1.25, 96), new THREE.MeshBasicMaterial({ color: 0x5fd8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  sp.rotation.x = -Math.PI / 2; scene.add(sp); holo.scanPlane = sp;

  let composer = null;
  if (CONFIG.bloom) {
    composer = new EffectComposer(r);
    composer.addPass(new RenderPass(scene, cam));
    holo.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.85, 0.55, 0.12);
    composer.addPass(holo.bloom);
    composer.addPass(new OutputPass());
  }
  Object.assign(holo, { r, scene, cam, ctl, composer, plat });
}
function mergeGeoms(list) {
  // tiny merge for non-indexed copies
  const pos = []; const uv = [];
  for (const g of list) { const n = g.index ? g.toNonIndexed() : g; pos.push(...n.attributes.position.array); uv.push(...n.attributes.uv.array); }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}
function sizeHolo() {
  if (!holo.r) return;
  const z = document.getElementById('holoZone').getBoundingClientRect();
  if (z.width < 2 || z.height < 2) return; // overview hidden: keep the last good size
  const padX = 170 * S, padB = 20 * S;
  const x = z.left - padX, y = z.top, w = z.width + padX * 2, h = z.height + padB;
  Object.assign(holoCanvas.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  holo.r.setSize(w, h, false);
  holo.composer?.setSize(w, h);
  holo.cam.aspect = w / h; holo.cam.updateProjectionMatrix();
  holoCanvas.style.webkitMaskImage = holoCanvas.style.maskImage =
    'radial-gradient(ellipse 50% 56% at 50% 52%, #000 62%, transparent 100%)';
}

/* ---------- astronaut + anatomy ---------- */
const SYS_COLORS = {
  skeletal: 0x3fc0ff, cartilage: 0x2a8fd0, lungs: 0xff3a55, bronchi: 0xff7a95,
  heart: 0xff1f35, artery: 0xff3048, vein: 0x3c7dff, organ: 0xff7a3a, digestive: 0xffa040,
  gland: 0xffd25a, neuro: 0x5cc8ff,
};
const STATUS_COLOR = { warn: new THREE.Color(0xffb020), crit: new THREE.Color(0xff2236) };
const anatMats = {};   // key -> holo material
const anatDefaults = {};
function anatMat(key, o) {
  if (!anatMats[key]) { anatMats[key] = makeHolo({ reveal: true, color: SYS_COLORS[key], ...o }); anatDefaults[key] = { ...o, color: SYS_COLORS[key] }; }
  return anatMats[key];
}
// which 3D materials belong to each body-scan system
const SYSTEM_TO_MATS = {
  skeletal: ['skeletal', 'cartilage'], muscular: [], cardiovascular: ['heart', 'artery', 'vein'],
  respiratory: ['lungs', 'bronchi'], neurological: ['neuro'], digestive: ['organ', 'digestive', 'gland'],
};
const MARKERS = [
  { sys: 'respiratory', p: [-0.075, 1.30, 0.03], label: 'LUNGS', side: 'l' },
  { sys: 'cardiovascular', p: [0.02, 1.27, 0.07], label: 'HEART' },
  { sys: 'neurological', p: [0.0, 1.64, 0.0], label: 'BRAIN' },
  { sys: 'digestive', p: [-0.03, 1.02, 0.07], label: 'DIGESTIVE (GI)', side: 'l' },
  { sys: 'skeletal', p: [0.11, 0.62, 0.0], label: 'BONE' },
  { sys: 'muscular', p: [-0.14, 0.7, 0.03], label: 'MUSCLE', side: 'l' },
];

function setupAstronaut() {
  const g = models.astronaut; if (!g) return;
  const root = g.scene; holo.scene.add(root); holo.astro = root;
  holo.mixer = new THREE.AnimationMixer(root);
  const clip = n => g.animations.find(a => a.name === n);
  holo.actions = {};
  for (const a of g.animations) holo.actions[a.name] = holo.mixer.clipAction(a);
  holo.actions.idle?.play();
  holo.mixer.update(0.01);

  holo.suitMeshes = []; holo.holoMeshes = [];
  const suitHolo = makeHolo({ color: 0x39c6ff, base: 0.035, rim: 1.25, pow: 2.0, stripe: 70, scanGain: 1.2 });
  holo.suitHoloMat = suitHolo;
  root.traverse(o => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m => { m.transparent = false; m.userData.baseOpacity = 1; });
    holo.suitMeshes.push(o);
  });
  for (const o of holo.suitMeshes) {
    const c = o.clone(); c.material = suitHolo; c.visible = false; c.renderOrder = 2;
    if (o.isSkinnedMesh) c.bind(o.skeleton, o.bindMatrix);
    o.parent.add(c); holo.holoMeshes.push(c);
  }

  // anatomy group, built in astronaut space then attached to the hip bone
  const anat = new THREE.Group(); anat.name = 'anatomy';
  const A = CONFIG.anat; anat.scale.setScalar(A.scale); anat.position.set(A.x, A.y, A.z);
  holo.anat = anat;
  const tag = (mesh, key, o) => { mesh.material = anatMat(key, o); mesh.renderOrder = 3; mesh.frustumCulled = false; };
  if (models.organs) {
    models.organs.scene.traverse(o => {
      if (!o.isMesh) return;
      const n = (o.material?.name || '').toLowerCase();
      if (n.startsWith('lung')) tag(o, 'lungs', { base: 0.32, rim: 1.4, pow: 1.6 });
      else if (n.startsWith('bronchi') || n.startsWith('mucosa')) tag(o, 'bronchi', { base: 0.18, rim: 0.9 });
      else if (n.startsWith('organ')) tag(o, 'organ', { base: 0.22, rim: 1.0 });
      else if (n.startsWith('intestine') || n.startsWith('peritoneum') || n.startsWith('ligament') || n.startsWith('ductus') || n.startsWith('muscles')) tag(o, 'digestive', { base: 0.10, rim: 0.7 });
      else if (n.startsWith('gland')) tag(o, 'gland', { base: 0.2, rim: 0.9 });
      else if (n.startsWith('cartilage')) tag(o, 'cartilage', { base: 0.02, rim: 0.5 });
      else if (n.startsWith('teeth') || n.startsWith('suture') || n.startsWith('bone')) tag(o, 'skeletal', { base: 0.015, rim: 0.75, pow: 2.4 });
      else o.visible = false;
    });
    anat.add(models.organs.scene);
  }
  if (models.vessels) {
    models.vessels.scene.traverse(o => {
      if (!o.isMesh) return;
      const n = (o.material?.name || '').toLowerCase();
      if (n.startsWith('artery')) tag(o, 'artery', { base: 0.16, rim: 0.55 });
      else if (n.startsWith('vein')) tag(o, 'vein', { base: 0.14, rim: 0.5 });
      else if (n.startsWith('muscles')) o.visible = false; // replaced by the dedicated heart model
      else o.visible = false;
    });
    anat.add(models.vessels.scene);
  }
  if (models.heart) {
    const h = models.heart.scene.clone();
    h.traverse(o => { if (o.isMesh) tag(o, 'heart', { base: 0.4, rim: 1.4, pow: 1.4 }); });
    anat.add(h); holo.heart = h;
  }
  if (models.brain) {
    const b = models.brain.scene.clone();
    b.traverse(o => { if (o.isMesh) tag(o, 'neuro', { base: 0.10, rim: 1.2, pow: 1.8 }); });
    const bb = new THREE.Box3().setFromObject(b), sz = bb.getSize(new THREE.Vector3()), ce = bb.getCenter(new THREE.Vector3());
    const s = 0.142 / sz.x; b.scale.setScalar(s); b.position.set(-ce.x * s, 1.628 - ce.y * s, -0.004 - ce.z * s);
    anat.add(b);
  }
  anat.visible = false;
  root.add(anat);
  // attach to the hips so the anatomy follows the idle sway
  root.updateMatrixWorld(true);
  let hip = null;
  root.traverse(o => { if (!hip && o.isBone && /hip|pelvis/i.test(o.name)) hip = o; });
  if (!hip) root.traverse(o => { if (!hip && o.isBone && /spine/i.test(o.name)) hip = o; });
  holo.hipName = hip?.name;
  if (hip) hip.attach(anat);

  // marker anchors
  const mkRoot = document.getElementById('markers');
  holo.markers = MARKERS.map(m => {
    const el = document.createElement('div'); el.className = 'mk';
    el.innerHTML = `<span class="dot"></span><span class="lbl">${m.label}</span>`; mkRoot.appendChild(el);
    const anchor = new THREE.Object3D(); anchor.position.set(...m.p); anat.add(anchor);
    return { ...m, el, anchor };
  });
}

/* ---------- mode switching ---------- */
const tween = { k: 0, target: 0 }; // 0 = astronaut, 1 = scan
function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('#modeSwitch button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  tween.target = mode === 'scan' ? 1 : 0;
  if (mode === 'scan') { state.scanProg = 0; state.scanFast = true; state.scanStart = performance.now(); }
  else {
    state.scanFast = false;
    const w = holo.actions?.wave, idle = holo.actions?.idle;
    if (w && idle) { w.reset().setLoop(THREE.LoopOnce, 1); w.clampWhenFinished = false; w.fadeIn(0.4).play(); idle.fadeOut(0.4);
      setTimeout(() => { idle.reset().fadeIn(0.6).play(); w.fadeOut(0.6); }, (w.getClip().duration - 0.6) * 1000); }
  }
  updateScanList();
}
function updateModeVisuals(dt) {
  if (!holo.astro) return;
  tween.k += Math.sign(tween.target - tween.k) * Math.min(Math.abs(tween.target - tween.k), dt / 1.1);
  const k = tween.k;
  const suitOp = 1 - THREE.MathUtils.smoothstep(k, 0, 0.6);
  for (const o of holo.suitMeshes) {
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    o.visible = suitOp > 0.01;
    mats.forEach(m => { const tr = suitOp < 0.999; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = suitOp; m.depthWrite = !tr; });
  }
  const hk = THREE.MathUtils.smoothstep(k, 0.15, 1);
  for (const c of holo.holoMeshes) c.visible = hk > 0.01;
  holo.suitHoloMat.userData.u.uOpacity.value = hk * 0.9;
  holo.anat.visible = k > 0.05;

  const H = holo.anatTop ?? 3.0;
  if (state.scanFast) {
    const t = (performance.now() - state.scanStart) / 3200;
    state.scanProg = Math.min(1, t);
    scanY.value = THREE.MathUtils.lerp(-0.05, H + 0.15, state.scanProg);
    revealY.value = scanY.value;
    if (t >= 1) { state.scanFast = false; const v = state.v; logScan({ scenario: scen().name, level: overall(), v: { hr: Math.round(v.hr), spo2: Math.round(v.spo2), temp: +v.temp.toFixed(1), rr: Math.round(v.rr) } }); }
  } else if (state.mode === 'scan') {
    revealY.value = 100;
    scanY.value = (Math.sin(holoTime.value * 0.9) * 0.5 + 0.5) * (H + 0.1);
  } else {
    revealY.value = 100; scanY.value = -10;
  }
  holo.scanPlane.position.y = scanY.value;
  holo.scanPlane.material.opacity = (state.mode === 'scan' && scanY.value > -1) ? 0.05 : 0;
  if (holo.bloom) { holo.bloom.strength = THREE.MathUtils.lerp(0.32, 0.55, k); holo.bloom.threshold = THREE.MathUtils.lerp(0.92, 0.6, k); holo.bloom.radius = 0.5; }
  updateScanList();
}

/* ---------- health highlighting on the 3D anatomy ---------- */
function applyOrganStatus() {
  const st = bodyOrgans();
  for (const key of Object.keys(anatMats)) {
    const u = anatMats[key].userData.u, d = anatDefaults[key];
    u.uColor.value.set(d.color); u.uPulse.value = 0; u.uBase.value = d.base ?? 0.06; u.uRim.value = d.rim ?? 1;
  }
  const anyBad = Object.values(st).some(x => x !== 'ok');
  if (anyBad) {
    const bad = new Set(Object.entries(st).filter(([, x]) => x !== 'ok').flatMap(([k]) => SYSTEM_TO_MATS[k] || []));
    for (const key of Object.keys(anatMats)) if (!bad.has(key)) { const u = anatMats[key].userData.u; u.uBase.value *= 0.4; u.uRim.value *= 0.55; }
  }
  for (const [sys, s] of Object.entries(st)) {
    if (s === 'ok') continue;
    for (const key of SYSTEM_TO_MATS[sys] || []) {
      const m = anatMats[key]; if (!m) continue;
      const u = m.userData.u;
      u.uColor.value.copy(STATUS_COLOR[s]);
      const minor = key === 'artery' || key === 'vein' || key === 'cartilage' || key === 'digestive';
      u.uPulse.value = (s === 'crit' ? 1.4 : 0.7) * (minor ? 0.5 : 1); u.uPulseSpeed.value = s === 'crit' ? 7 : 3.5;
      if (minor) { u.uBase.value = s === 'crit' ? 0.2 : 0.12; u.uRim.value = 0.6; }
      else { u.uBase.value = s === 'crit' ? 0.5 : 0.3; u.uRim.value = 1.4; }
    }
  }
  // suit tint in scan mode follows the overall status
  const lvl = overall();
  holo.suitHoloMat?.userData.u.uColor.value.set(lvl === 'crit' ? 0x5cb8ff : 0x39c6ff);
}
// body systems = health scenario + effects of the situation set in GENETICS (only when the simulator is on "you")
function geneOrgans() {
  const g = gsim.summary; if (!g || !g.body || g.who !== 'you') return { st: {}, why: [] };
  const st = {}, why = [], up = (k, v) => { st[k] = worst(st[k] || 'ok', v); };
  if (g.dose >= 100 || g.spe) { up('skeletal', 'warn'); up('digestive', 'warn'); why.push(`${Math.round(g.dose)} mSv of radiation: bone marrow and the digestive (GI) tract are among the most radiation-sensitive tissues`); }
  if (g.days >= 90 && g.sitKey !== undefined) { up('skeletal', 'warn'); up('muscular', 'warn'); why.push(`${g.days} days in weightlessness: about 1–1.5% bone loss per month and muscle loss (NASA HRP)`); }
  if (g.days >= 180) { up('neurological', 'warn'); why.push('long-duration flight: more than half of crewmembers show SANS eye/brain signs (NASA HRP)'); }
  return { st, why };
}
function bodyOrgans() {
  const st = { ...ALL_OK, ...scen().organs }, g = geneOrgans().st;
  for (const k of Object.keys(g)) st[k] = worst(st[k], g[k]);
  return st;
}
function overall() {
  const st = bodyOrgans();
  const vals = Object.values(st).concat(Object.entries(vitalStatus()).map(([, s]) => s));
  return vals.includes('crit') ? 'crit' : vals.includes('warn') ? 'warn' : 'ok';
}
const _v = new THREE.Vector3();
function updateMarkers() {
  if (!holo.markers) return;
  const st = bodyOrgans();
  const rect = holoCanvas.getBoundingClientRect();
  const showAny = state.mode === 'scan' && !state.scanFast && document.getElementById('view-overview').classList.contains('active');
  for (const m of holo.markers) {
    const s = st[m.sys];
    const on = showAny && s !== 'ok';
    m.el.className = 'mk ' + (m.side || 'r') + ' ' + (on ? 'show ' + s : '');
    if (!on) continue;
    m.anchor.getWorldPosition(_v); _v.project(holo.cam);
    m.el.style.left = (rect.left + (_v.x * 0.5 + 0.5) * rect.width) + 'px';
    m.el.style.top = (rect.top + (-_v.y * 0.5 + 0.5) * rect.height) + 'px';
  }
}

/* ============================================================
   MINI 3D VIEWS (one renderer, scissored into panel slots)
   ============================================================ */
const miniCanvas = document.getElementById('miniCanvas');
const mini = { views: [] };
function initMini() {
  const r = new THREE.WebGLRenderer({ canvas: miniCanvas, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 1.5)); r.setClearColor(0, 0); r.autoClear = false;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  mini.r = r;
}
function sizeMini() { mini.r?.setSize(innerWidth, innerHeight, false); }
function addView(name, scene, cam, update) {
  const el = document.querySelector(`.mini3d[data-view="${name}"]`);
  if (!el) return;
  mini.views.push({ el, scene, cam, update, clipEl: el.closest('.panel') });
}
function frameObject(obj, cam, fill = 1.0, dir = new THREE.Vector3(0, 0, 1)) {
  const b = new THREE.Box3().setFromObject(obj), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const R = sz.length() / 2;
  const d = R / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) / fill;
  cam.position.copy(c).addScaledVector(dir.normalize(), d); cam.lookAt(c);
  cam.near = d / 100; cam.far = d * 10; cam.updateProjectionMatrix();
  return { c, R };
}
function basicLights(s, color = 0x9fd0ff) {
  s.add(new THREE.HemisphereLight(color, 0x05101f, 1.6));
  const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(3, 4, 5); s.add(d);
  return s;
}
function holoClone(src, opts) {
  const c = src.clone(true); const m = makeHolo(opts);
  c.traverse(o => { if (o.isMesh) { o.material = m; } });
  return { obj: c, mat: m };
}
function setDnaStatus(level, n) {
  const col = level === 'crit' ? 0xff2236 : level === 'warn' ? 0xffb020 : 0x4fc4ff;
  for (const d of mini.dna) {
    d.mat.userData.u.uColor.value.set(col); d.mat.userData.u.uPulse.value = level === 'ok' ? 0 : level === 'crit' ? 1.2 : 0.6; d.mat.userData.u.uPulseSpeed.value = level === 'crit' ? 6 : 3;
    d.lesions.forEach((m, i) => { m.visible = level !== 'ok' && i < n; m.material.color.set(level === 'crit' ? 0xff2236 : 0xffb020); });
  }
}
function setupMiniViews() {
  mini.dna = [];
  // brain (body-scan column)
  if (models.brain) {
    const s = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    const { obj } = holoClone(models.brain.scene, { color: 0x3fb4ff, base: 0.12, rim: 1.3, pow: 1.7, stripe: 30 });
    const pivot = new THREE.Group(); pivot.add(obj); s.add(pivot);
    const bb = new THREE.Box3().setFromObject(obj); obj.position.sub(bb.getCenter(new THREE.Vector3()));
    frameObject(pivot, cam, 1.25, new THREE.Vector3(1, 0.25, 0.2));
    addView('brain', s, cam, t => { pivot.rotation.y = t * 0.4; });
  }
  // earth (environmental panel, cropped like the reference)
  if (models.earth) {
    const s = basicLights(new THREE.Scene(), 0xb0d8ff), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 3000);
    const e = models.earth.scene; s.add(e);
    const sun = new THREE.DirectionalLight(0xffffff, 3); sun.position.set(-5, 2, 4); s.add(sun);
    frameObject(e, cam, 1.0, new THREE.Vector3(0.1, 0.25, 1));
    addView('earth', s, cam, t => { e.rotation.y = t * 0.05; });
  }
  // DNA (genetic overview)
  if (models.dna) {
    const mk = (big) => {
      const s = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.01, 200);
      const { obj, mat } = holoClone(models.dna.scene, { color: 0x4fc4ff, base: 0.25, rim: 1.2, pow: 1.6 });
      const tilt = new THREE.Group(), spin = new THREE.Group(); spin.add(obj); tilt.add(spin); s.add(tilt);
      const lesions = [];
      for (let i = 0; i < 7; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff2236, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
        const a = i * 2.3; m.position.set(Math.cos(a) * 0.72, Math.sin(a) * 0.72, -5.4 + i * 1.8); m.visible = false; obj.add(m); lesions.push(m);
      }
      mini.dna.push({ mat, lesions });
      spin.rotation.x = Math.PI / 2; tilt.rotation.z = big ? -0.25 : -0.62;
      const fr = frameObject(tilt, cam, big ? 1.0 : 1.12);
      const orb = big ? orbitable('dnabig', cam, fr.c.clone()) : null;
      return { s, cam, update: t => { obj.rotation.z = t * 0.6; orb?.(); const p = 0.7 + 0.5 * Math.sin(t * 6); mini.dna.forEach(d => d.lesions.forEach(m => m.scale.setScalar(p))); } };
    };
    const a = mk(false); addView('dna', a.s, a.cam, a.update);
    if (models.dna) { const b = mk(true); addView('dnabig', b.s, b.cam, b.update); }
  }
  // AI brain (particle hologram with its own animation)
  if (models['brain-holo']) {
    const g = models['brain-holo'];
    const s = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    s.add(g.scene);
    const mixer = new THREE.AnimationMixer(g.scene); g.animations.forEach(a => mixer.clipAction(a).play());
    let mi = 0; g.scene.traverse(o => { if (o.isMesh && o.material) { const c = new THREE.Color(mi++ % 2 ? 0x45b4ff : 0xc0f0ff); o.material = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }); } });
    frameObject(g.scene, cam, 1.45, new THREE.Vector3(1, 0.15, 0.35));
    let last = 0;
    addView('aibrain', s, cam, t => { mixer.update(Math.min(0.05, t - last)); last = t; g.scene.rotation.y = Math.sin(t * 0.3) * 0.4; });
  }
  // ISS interior (mission overview + simulations)
  if (models.iss) {
    const mk = (big) => {
      const s = new THREE.Scene(), cam = new THREE.PerspectiveCamera(big ? 70 : 75, 1, 0.02, 200);
      const iss = big ? models.iss.scene : models.iss.scene.clone();
      iss.traverse(o => { if (o.isMesh && o.material) { o.material.side = THREE.DoubleSide; o.geometry.computeBoundingBox(); const sz = o.geometry.boundingBox.getSize(new THREE.Vector3()); if (sz.x > 18 || sz.z > 18) o.visible = false; } });
      s.add(iss); s.add(new THREE.AmbientLight(0xffffff, 1.5));
      const P = ISS_PATH, m = { manual: false, yaw: 0, pitch: 0, x: P.a[0], z: P.a[2] };
      if (big) interact('issbig', {
        drag: (dx, dy) => { if (!m.manual) { m.manual = true; m.x = cam.position.x; m.z = cam.position.z; } m.yaw += dx * 0.004; m.pitch = THREE.MathUtils.clamp(m.pitch - dy * 0.004, -0.9, 0.9); },
        wheel: dy => { if (!m.manual) { m.manual = true; m.x = cam.position.x; m.z = cam.position.z; } const st = -dy * 0.0025; m.x = THREE.MathUtils.clamp(m.x + Math.cos(m.yaw) * st, -3.3, 1.4); m.z = THREE.MathUtils.clamp(m.z + Math.sin(m.yaw) * st, -0.7, 0.7); },
        reset: () => { m.manual = false; m.yaw = 0; m.pitch = 0; },
      });
      return { s, cam, update: t => {
        if (m.manual) {
          cam.position.set(m.x, P.a[1], m.z);
          cam.lookAt(m.x + Math.cos(m.yaw) * Math.cos(m.pitch), P.a[1] + Math.sin(m.pitch), m.z + Math.sin(m.yaw) * Math.cos(m.pitch));
          return;
        }
        const u = (Math.sin(t * (big ? 0.05 : 0.07)) * 0.5 + 0.5);
        cam.position.set(THREE.MathUtils.lerp(P.a[0], P.b[0], u), P.a[1], THREE.MathUtils.lerp(P.a[2], P.b[2], u));
        const yaw = Math.sin(t * 0.21) * 0.32 + P.yaw;
        cam.lookAt(cam.position.x + Math.cos(yaw), cam.position.y - 0.05, cam.position.z + Math.sin(yaw));
      } };
    };
    const a = mk(false); addView('iss', a.s, a.cam, a.update);
    const b = mk(true); addView('issbig', b.s, b.cam, b.update);
  }
  // lungs (biometrics)
  if (models.lungs) {
    const s = basicLights(new THREE.Scene(), 0xffd8e0), cam = new THREE.PerspectiveCamera(30, 1, 0.001, 100);
    const l = models.lungs.scene; const piv = new THREE.Group(); piv.add(l); s.add(piv);
    const bb = new THREE.Box3().setFromObject(l); l.position.sub(bb.getCenter(new THREE.Vector3()));
    const lfr = frameObject(piv, cam, 1.0);
    const lorb = orbitable('lungs', cam, lfr.c.clone());
    const tint = new THREE.Color();
    l.traverse(o => { if (o.isMesh) o.material = o.material.clone(); });
    mini.lungs = l;
    addView('lungs', s, cam, t => {
      piv.rotation.y = Math.sin(t * 0.4) * 0.6; lorb();
      const rr = state.v.rr, br = 1 + 0.035 * Math.sin(t * Math.PI * 2 * rr / 60);
      piv.scale.set(br, 1 + (br - 1) * 0.6, br);
      const stv = bodyOrgans().respiratory;
      tint.set(stv === 'crit' ? 0xff2236 : stv === 'warn' ? 0xffb020 : 0x000000);
      const k = stv === 'ok' ? 0 : (0.35 + 0.25 * Math.sin(t * 6));
      l.traverse(o => { if (o.isMesh && o.material.emissive) { o.material.emissive.copy(tint).multiplyScalar(k); } });
    });
  }
  // beating heart (biometrics)
  if (models.heart) {
    const s = basicLights(new THREE.Scene(), 0xffd8e0), cam = new THREE.PerspectiveCamera(30, 1, 0.001, 100);
    const h = models.heart.scene.clone(); const piv = new THREE.Group(); piv.add(h); s.add(piv);
    const mats = [];
    h.traverse(o => { if (o.isMesh) { const n = (o.material?.name || '').toLowerCase(); o.material = new THREE.MeshStandardMaterial({ color: n.startsWith('vein') ? 0x3a5cd0 : n.startsWith('artery') ? 0xd8404a : 0xb0262f, roughness: 0.45, metalness: 0.05, emissive: 0x000000 }); mats.push(o.material); } });
    const bb = new THREE.Box3().setFromObject(h); h.position.sub(bb.getCenter(new THREE.Vector3()));
    const fr = frameObject(piv, cam, 0.72, new THREE.Vector3(0.15, 0.1, 1)); const orb = orbitable('heart', cam, fr.c.clone());
    const tint = new THREE.Color(); let beatT = 0, nextBeat = 0, last = 0;
    addView('heart', s, cam, t => {
      const dt = Math.min(0.1, t - last); last = t; beatT += dt;
      const sc = scen(), period = 60 / Math.max(30, state.v.hr);
      if (beatT >= nextBeat) { beatT = 0; nextBeat = sc.irregular ? period * (0.55 + 0.9 * Math.random()) : period; }
      const ph = beatT / period, k = 1 + 0.07 * Math.exp(-((ph - 0.08) ** 2) / 0.003) + 0.03 * Math.exp(-((ph - 0.32) ** 2) / 0.006);
      piv.scale.setScalar(k); piv.rotation.y = Math.sin(t * 0.3) * 0.4; orb();
      const st = bodyOrgans().cardiovascular;
      tint.set(st === 'crit' ? 0xff2236 : st === 'warn' ? 0xffb020 : 0x000000);
      const g = st === 'ok' ? 0 : (0.35 + 0.3 * Math.exp(-((ph - 0.08) ** 2) / 0.004));
      mats.forEach(m => m.emissive.copy(tint).multiplyScalar(g));
    });
  }
  // transit Earth → Mars
  if (models.mars && models.earth) {
    const s = basicLights(new THREE.Scene(), 0xffffff), cam = new THREE.PerspectiveCamera(35, 1, 0.1, 5000);
    const sun = new THREE.DirectionalLight(0xffffff, 3); sun.position.set(0, 3, 10); s.add(sun);
    const earth = models.earth.scene.clone(); const eb = new THREE.Box3().setFromObject(earth).getSize(new THREE.Vector3()).x;
    earth.scale.setScalar(2.2 / eb); earth.position.set(-6, -0.5, 0); s.add(earth);
    const mars = models.mars.scene; const mb = new THREE.Box3().setFromObject(mars).getSize(new THREE.Vector3()).x;
    mars.scale.setScalar(1.3 / mb); mars.position.set(6, 0.6, -1); s.add(mars);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-4.8, -0.2, 0), new THREE.Vector3(0, 3.4, 1), new THREE.Vector3(5.2, 0.6, -1));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(120)), new THREE.LineDashedMaterial({ color: 0x39c6ff, dashSize: 0.18, gapSize: 0.12 }));
    line.computeLineDistances(); s.add(line);
    const ship = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), new THREE.MeshBasicMaterial({ color: 0x9ff0ff }));
    s.add(ship);
    { const N = 1500, g = new THREE.BufferGeometry(), a = new Float32Array(N * 3); for (let i = 0; i < N; i++) a.set([(Math.random() - 0.5) * 120, (Math.random() - 0.5) * 70, -20 - Math.random() * 60], i * 3);
      g.setAttribute('position', new THREE.BufferAttribute(a, 3)); s.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfe6ff, size: 0.12, transparent: true, opacity: 0.7 }))); }
    const orbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.EllipseCurve(0, 0, 1.6, 1.6).getPoints(80).map(p => new THREE.Vector3(p.x, 0, p.y))), new THREE.LineBasicMaterial({ color: 0x39c6ff, transparent: true, opacity: 0.6 }));
    orbit.position.copy(earth.position); orbit.rotation.x = 0.35; s.add(orbit);
    const ret = new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(new THREE.Vector3(5.2, 0.6, -1), new THREE.Vector3(0, -3.2, 1), new THREE.Vector3(-4.8, -0.6, 0)).getPoints(120)), new THREE.LineDashedMaterial({ color: 0x7fe0ff, dashSize: 0.12, gapSize: 0.16, transparent: true, opacity: 0.5 }));
    ret.computeLineDistances(); s.add(ret);
    const retCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(5.2, 0.6, -1), new THREE.Vector3(0, -3.2, 1), new THREE.Vector3(-4.8, -0.6, 0));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), new THREE.MeshBasicMaterial({ color: 0x39c6ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); s.add(glow);
    cam.position.set(0, 1.5, 15); cam.lookAt(0, 0.6, 0);
    const torb = orbitable('transit', cam, new THREE.Vector3(0, 0.6, 0));
    addView('transit', s, cam, t => { torb();
      earth.rotation.y = t * 0.15; mars.rotation.y = t * 0.1;
      const st = mini.transitState || { key: 'mars', frac: 0 }, leo = st.key === 'leo' || st.key === 'twins';
      orbit.visible = leo; line.visible = !leo; ret.visible = st.key === 'marsrt';
      if (leo) { const a = t * 1.2; ship.position.set(earth.position.x + Math.cos(a) * 1.6, earth.position.y + Math.sin(a) * 1.6 * Math.sin(0.35), earth.position.z + Math.sin(a) * 1.6 * Math.cos(0.35)); }
      else if (st.key === 'marsrt') ship.position.copy(st.frac <= 0.5 ? curve.getPoint(st.frac * 2) : retCurve.getPoint((st.frac - 0.5) * 2));
      else ship.position.copy(curve.getPoint(st.frac));
      glow.position.copy(ship.position); glow.scale.setScalar(1 + 0.3 * Math.sin(t * 4));
    });
  }
  // optional NASA insignia in the logo slot
  if (CONFIG.useNasaInsignia && models.nasa) {
    const slot = document.getElementById('logoSlot');
    slot.innerHTML = '<div class="mini3d" data-view="logo" style="position:absolute;inset:-6px"></div>';
    const s = basicLights(new THREE.Scene(), 0xffffff), cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    const n = models.nasa.scene; const piv = new THREE.Group(); piv.add(n); s.add(piv);
    const bb = new THREE.Box3().setFromObject(n); n.position.sub(bb.getCenter(new THREE.Vector3()));
    frameObject(piv, cam, 1.05);
    addView('logo', s, cam, t => { piv.rotation.y = Math.sin(t * 0.6) * 0.35; });
  }
}
// camera path inside the ISS photogrammetry (computed from the model bounds at load)
const ISS_PATH = { a: [0, 1.2, 0], b: [6, 1.2, 0], yaw: 0 };
function computeIssPath() {
  if (!models.iss) return;
  const env = qs.get('iss');
  if (env) { const v = env.split(',').map(Number); ISS_PATH.a = v.slice(0, 3); ISS_PATH.b = v.slice(3, 6); ISS_PATH.yaw = v[6] || 0; return; }
  Object.assign(ISS_PATH, ISS_DEFAULT);
}
const ISS_DEFAULT = { a: [-2.8, 1.15, 0], b: [-0.9, 1.15, 0], yaw: 0 };

function renderMini(t) {
  const r = mini.r; if (!r) return;
  r.setScissorTest(false); r.clear(); r.setScissorTest(true);
  const H = innerHeight;
  for (const v of mini.views) {
    const rc = v.el.getBoundingClientRect();
    if (rc.width < 2 || rc.height < 2) continue;
    const cl = v.clipEl ? v.clipEl.getBoundingClientRect() : rc;
    const x0 = Math.max(rc.left, cl.left + 1), y0 = Math.max(rc.top, cl.top + 1);
    const x1 = Math.min(rc.right, cl.right - 1), y1 = Math.min(rc.bottom, cl.bottom - 1);
    if (x1 <= x0 || y1 <= y0) continue;
    v.update?.(t);
    v.cam.aspect = rc.width / rc.height; v.cam.updateProjectionMatrix();
    r.setViewport(rc.left, H - rc.bottom, rc.width, rc.height);
    r.setScissor(x0, H - y1, x1 - x0, y1 - y0);
    r.render(v.scene, v.cam);
  }
}

/* ============================================================
   WAVEFORMS (2D canvas)
   ============================================================ */
const waves = [];
function regWave(canvas, fn) { waves.push({ c: canvas, ctx: canvas.getContext('2d'), fn }); }
function sizeWaves() {
  const dpr = Math.min(devicePixelRatio, 2);
  for (const w of waves) { const r = w.c.getBoundingClientRect(); w.c.width = Math.max(10, r.width * dpr); w.c.height = Math.max(10, r.height * dpr); }
}
const hash = n => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
function ecg(t, hr, irregular) {
  // beat timeline with optional irregular R-R intervals
  let period = 60 / hr, beatStart, beatIdx;
  if (irregular) {
    // walk beats: deterministic jittered periods
    beatIdx = Math.floor(t / period); let tt = 0;
    const base = Math.max(0, beatIdx - 3); tt = base * period;
    let i = base, p = period * (0.6 + 0.8 * hash(i));
    while (tt + p < t) { tt += p; i++; p = period * (0.6 + 0.8 * hash(i)); }
    beatStart = tt; period = p; beatIdx = i;
  } else { beatIdx = Math.floor(t / period); beatStart = beatIdx * period; }
  const x = (t - beatStart) / (60 / hr);
  const g = (c, w, a) => a * Math.exp(-((x - c) ** 2) / (2 * w * w));
  let y = 0;
  if (!irregular) y += g(0.12, 0.025, 0.12);                 // P
  else y += (hash(Math.floor(t * 40)) - 0.5) * 0.06;           // fibrillatory baseline
  y += g(0.25, 0.008, -0.12) + g(0.27, 0.010, 1.0) + g(0.295, 0.010, -0.25); // QRS
  y += g(0.5, 0.05, 0.28);                                     // T
  return y;
}
function pleth(t, hr, amp = 1) {
  const x = (t * hr / 60) % 1;
  const g = (c, w, a) => a * Math.exp(-((x - c) ** 2) / (2 * w * w));
  return amp * (g(0.18, 0.07, 0.9) + g(0.42, 0.08, 0.35));
}
function drawWave(w, t, color, fn, opts = {}) {
  const { ctx, c } = w, W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);
  // grid
  ctx.strokeStyle = 'rgba(57,198,255,0.08)'; ctx.lineWidth = 1;
  for (let gx = 0; gx < W; gx += W / 12) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
  const span = opts.span ?? 4, n = Math.floor(W / 2);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const tt = t - span + span * i / n, y = fn(tt);
    const px = i / n * W, py = H * (opts.mid ?? 0.62) - y * H * (opts.gain ?? 0.5);
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, H / 40); ctx.shadowColor = color; ctx.shadowBlur = 8;
  ctx.stroke(); ctx.shadowBlur = 0;
  // head dot
  const y = fn(t); ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(W - 3, H * (opts.mid ?? 0.62) - y * H * (opts.gain ?? 0.5), Math.max(2, H / 30), 0, 7); ctx.fill();
}
const COL = { ok: '#39c6ff', warn: '#ffb020', crit: '#ff3b4e' };
function drawTrend(w, arr, color, r, dots) {
  const { ctx, c } = w, W = c.width, H = c.height; ctx.clearRect(0, 0, W, H);
  if (arr.length < 2) return;
  const lo = Math.min(r.warn[0], ...arr) - 1, hi = Math.max(r.warn[1] === 100 ? 100 : r.warn[1], ...arr) + 1;
  const Y = v => H - (v - lo) / (hi - lo) * H;
  ctx.fillStyle = 'rgba(45,255,138,0.06)'; ctx.fillRect(0, Y(r.ok[1]), W, Y(r.ok[0]) - Y(r.ok[1]));
  const n = dots ? arr.length : 240, X = i => dots ? 10 + i / Math.max(1, n - 1) * (W - 20) : i / (n - 1) * W;
  ctx.beginPath(); arr.forEach((v, i) => { const x = X(i), y = Y(v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
  if (dots) arr.forEach((v, i) => { ctx.fillStyle = classify(v, r) === 'ok' ? '#fff' : COL[classify(v, r)]; ctx.beginPath(); ctx.arc(X(i), Y(v), 4, 0, 7); ctx.fill(); });
}

/* ============================================================
   UI BINDINGS
   ============================================================ */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
function vitalStatus() {
  const v = state.v;
  const es = scen().evalStatus; if (es) return { ...es };
  return { hr: classify(v.hr, RANGES.hr), spo2: classify(v.spo2, RANGES.spo2), temp: classify(v.temp, RANGES.temp), bp: classify(v.sys, RANGES.sys), rr: classify(v.rr, RANGES.rr) };
}
function targetV() { return { ...BASE_V, ...scen().v }; }
// habitat radiation follows the situation chosen in GENETICS / MISSION (ISS 0.2–0.5, deep space 1.8 mSv/day) and its solar-event dose
function radInfo() {
  const k = $('#gsSit')?.value || 'leo', sit = (typeof SIT !== 'undefined' && SIT[k]) || { rate: 0.35, label: 'ISS (LEO)' };
  const speSet = !!$('#gsSpe')?.checked, spe = speSet ? +$('#gsSpeDose').value : 12;
  return { base: sit.rate, label: sit.label, spe, speSet, total: sit.rate + spe };
}
function targetE() {
  const sc = scen(), r = radInfo(), e = { ...BASE_E, rad: r.base / 24, ...sc.e };
  if (sc.id === 'radiation') e.rad = r.total / 24;
  return e;
}
function fmtDelta(d, dec) {
  const a = Math.abs(d);
  if (a < Math.pow(10, -dec) / 2) return ['flat', '— ' + (0).toFixed(dec)];
  return d > 0 ? ['up', '▲ +' + a.toFixed(dec)] : ['down', '▼ -' + a.toFixed(dec)];
}
function past(arr, n) { return arr.length > n ? arr[arr.length - 1 - n] : arr[0]; }
function updateVitalsUI() {
  const v = state.v, st = vitalStatus(), h = state.hist;
  const set = (k, val, dec, histKey) => {
    const row = $(`.vrow[data-k="${k}"]`); if (!row) return;
    row.querySelector('.vval b').textContent = val;
    row.classList.remove('warn', 'crit'); if (st[k] !== 'ok') row.classList.add(st[k]);
    const em = row.querySelector('.d');
    const arr = h[histKey]; const d = arr.length ? arr[arr.length - 1] - past(arr, 20) : 0;
    const [cls, txt] = fmtDelta(d, dec); em.className = 'd ' + cls + (st[k] !== 'ok' ? ' bad' : ''); em.textContent = txt;
  };
  set('hr', Math.round(v.hr), 0, 'hr');
  set('spo2', Math.round(v.spo2), 1, 'spo2');
  set('temp', v.temp.toFixed(1), 1, 'temp');
  set('bp', `${Math.round(v.sys)}/${Math.round(v.dia)}`, 0, 'sys');
  set('rr', Math.round(v.rr), 0, 'rr');
}
function updateEnvUI() {
  const e = state.e, tgt = targetE();
  const tiles = { o2: [e.o2.toFixed(1) + '%', 1], co2: [(e.co2 * 7.6).toFixed(1) + ' <small>mmHg</small>', 2], press: [e.press.toFixed(1) + ' <small>psi</small>', 1], temp: [e.temp.toFixed(1) + ' <small>°C</small>', 1], rad: [(e.rad * 24).toFixed(2) + ' <small>mSv/d</small>', 2] };
  for (const [k, [txt, dec]] of Object.entries(tiles)) {
    const el = $(`.etile[data-e="${k}"]`); el.querySelector('b').innerHTML = txt;
    const s = classify(e[k], ENV_RANGES[k]); el.classList.remove('warn', 'crit'); if (s !== 'ok') el.classList.add(s);
    const [cls, t] = fmtDelta((tgt[k] - e[k]) * 0.1 + (state.envJit[k] || 0), dec);
    const em = el.querySelector('.d'); em.className = 'd ' + cls; em.textContent = t;
  }
  const r = radInfo(), rl = $('.etile[data-e="rad"] .lim');
  if (rl) rl.textContent = scen().id === 'radiation' ? `${r.label} + solar event` : scen().e?.rad !== undefined ? 'your scenario' : `${r.label} · from GENETICS`;
}
function updateStatusUI() {
  const lvl = overall();
  const pill = $('#hdStatus'); pill.className = 'status-pill ' + (lvl === 'ok' ? '' : lvl);
  pill.querySelector('b').textContent = lvl === 'ok' ? 'STABLE' : lvl === 'warn' ? 'WARNING' : 'CRITICAL';
  const sys = { ...SYS_OK, ...scen().sys };
  $$('.sys').forEach(el => { const s = sys[el.dataset.sys]; el.classList.remove('warn', 'crit'); if (s !== 'ok') el.classList.add(s);
    el.querySelector('b').textContent = s === 'ok' ? 'Nominal' : s === 'warn' ? 'Degraded' : 'Fault'; });
  const sc = scen();
  const gsum = gsim.summary, gst = geneStatus(), gflag = Object.values(gst).filter(x => x !== 'ok').length;
  const genLine = gsum && (gsum.careerPct >= 70 || gst.dna !== 'ok') ? `<p class="${gsum.careerPct >= 100 || gst.dna === 'crit' ? 'c' : 'w'}">Genetics: ${Math.round(gsum.dose)} mSv on this mission (${Math.round(gsum.careerPct)}% of NASA career limit) · ${gflag} marker${gflag === 1 ? '' : 's'} flagged.</p>` : '';
  const gw = geneOrgans().why;
  const baseAi = sc.level === 'ok' && gw.length ? ['Vital signs are normal right now.', 'The mission situation set in GENETICS adds long-term risks to watch (below).'] : sc.ai;
  $('#aiText').innerHTML = baseAi.map(p => `<p>${p}</p>`).join('') + genLine + (gw.length ? `<p class="w">Body effects from GENETICS: ${gw.map(esc).join('; ')}.</p>` : '');
  const key = sc.id + '|' + (sc.src || []).join(',');
  if (updateStatusUI._k !== key) { updateStatusUI._k = key; $('#aiSrc').innerHTML = chips(sc.src); $('#scenSrc').innerHTML = chips(sc.src); }
  renderGenOverview();
  const ls = bodyOrgans().respiratory;
  const cs = bodyOrgans().cardiovascular;
  $('#heartLegend').innerHTML = `Cardiac status: <b style="color:var(--${cs === 'ok' ? 'ok' : cs})">${cs === 'ok' ? 'NOMINAL' : cs === 'warn' ? 'WATCH' : 'ALERT'}</b> · ${Math.round(state.v.hr)} bpm${sc.irregular ? ' · irregular' : ''}`;
  $('#lungLegend').innerHTML = `Lung tissue status: <b style="color:var(--${ls === 'ok' ? 'ok' : ls})">${ls === 'ok' ? 'NOMINAL' : ls === 'warn' ? 'WATCH' : 'ALERT'}</b>`;
  renderGeneList();
}
// body scan list: in scan mode, items resolve as the scan line passes their height
const SCAN_ORDER = { skeletal: 0.15, muscular: 0.35, digestive: 0.55, cardiovascular: 0.7, respiratory: 0.78, neurological: 0.93 };
function updateScanList() {
  const st = bodyOrgans();
  const p = state.scanProg;
  $$('#scanList li').forEach(li => {
    const k = li.dataset.s, s = st[k];
    const pending = state.mode === 'scan' && state.scanFast && p < SCAN_ORDER[k];
    li.className = pending ? 'pending' : (s === 'ok' ? '' : s);
    li.querySelector('b').textContent = pending ? '···' : s === 'ok' ? 'OK' : s === 'warn' ? 'WATCH' : 'ALERT';
  });
  const pct = Math.round(p * 100);
  $('#scanPct').textContent = pct + '%';
  $('#scanArc').style.strokeDashoffset = (251.3 * (1 - p)).toFixed(1);
  const lvl = overall(); $('#scanArc').style.color = `var(--${lvl === 'ok' ? 'ok' : lvl})`;
  $('#pScan h3').innerHTML = (state.mode === 'scan' && !state.scanFast) ? 'BODY SCAN<br>COMPLETE' : 'BODY SCAN<br>IN PROGRESS';
}
function goTab(name) {
  $$('.tab').forEach(x => x.classList.toggle('active', x.dataset.tab === name));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  const ov = name === 'overview'; holoCanvas.style.display = ov ? 'block' : 'none';
  if (ov) last = performance.now();
  requestAnimationFrame(() => { layout(); onTab(name); });
}
function setScenario(i) {
  state.scen = i; $('#scenarioSel').value = i;
  $$('.card').forEach((c, j) => c.classList.toggle('on', j === i));
  applyOrganStatus(); updateStatusUI(); updateScanList();
  if (state.mode === 'scan') { state.scanProg = 0; state.scanFast = true; state.scanStart = performance.now(); }
}
const GENE_INFO = {
  telomere: { name: 'Telomere length', short: 'Chromosome-end length; shifted in long-duration flight', src: ['twins'],
    what: 'Telomeres are protective caps at the ends of chromosomes; they shorten with age and cellular stress.',
    nasa: 'In the NASA Twins Study, telomeres lengthened during the year in space and shortened rapidly after return; more short telomeres persisted afterwards.',
    act: 'Track over the mission; combine with radiation dose and oxidative-stress markers.' },
  dna: { name: 'DNA damage response', short: 'Double-strand break repair activity', src: ['twins', 'osd720', 'nag9_1024'],
    what: 'Space radiation can break both DNA strands; cells switch on repair genes when this happens.',
    nasa: 'The Twins Study recorded DNA damage and genome instability in flight. NASA-funded radiation studies (OSD-720, NAG9-1024) show lasting gene-expression changes after simulated space radiation.',
    act: 'Limit further dose (storm shelter), log cumulative dose, repeat the marker after the event.' },
  expr: { name: 'Gene expression drift', short: 'Stability vs. pre-flight baseline', src: ['twins'],
    what: 'How far the overall pattern of active genes has moved from the crew member\'s own pre-flight baseline.',
    nasa: 'In the Twins Study gene expression changed far more in the second half of the year-long mission; most changes returned toward baseline within about 6 months after landing, but some persisted.',
    act: 'Compare with the baseline sample; correlate with sleep, workload and dose.' },
  immune: { name: 'Immune gene activity', short: 'Inflammation-related expression', src: ['twins'],
    what: 'Expression of genes that drive inflammation and immune responses.',
    nasa: 'The Twins Study found immune-related changes in flight, and some T-cell activation changes were still present after return.',
    act: 'Watch for infection signs; review heat load, sleep and stress.' },
  oxid: { name: 'Oxidative stress', short: 'Oxidative damage markers', src: ['twins'],
    what: 'Damage from reactive oxygen molecules produced under radiation, low oxygen or heavy workload.',
    nasa: 'The Twins Study reported DNA methylation changes in oxidative-stress-related pathways during spaceflight.',
    act: 'Reduce the trigger (radiation, hypoxia); track with the DNA-damage marker.' },
  mito: { name: 'Mitochondrial function', short: 'Cellular energy pathways', src: ['twins'],
    what: 'Genes of the mitochondria, the part of the cell that produces energy.',
    nasa: 'The Twins Study observed changes in mitochondrial gene activity during long-duration flight.',
    act: 'Relevant under low oxygen; correlate with SpO₂ and fatigue.' },
};
function geneStatus() {
  const sc = scen(), id = sc.id, radC = sc.e && sc.e.rad !== undefined ? classify(sc.e.rad, ENV_RANGES.rad) : 'ok';
  const rad = id === 'radiation' || radC !== 'ok', radCrit = id === 'radiation' || radC === 'crit';
  const base = {
    telomere: rad ? 'warn' : 'ok',
    dna: radCrit ? 'crit' : rad ? 'warn' : 'ok',
    expr: sc.gen.expr < 93 ? 'warn' : 'ok',
    immune: id === 'heat' ? 'warn' : 'ok',
    oxid: rad || id === 'hypoxia' ? 'warn' : 'ok',
    mito: id === 'hypoxia' ? 'warn' : 'ok',
  };
  const g = gsim.status || {};
  for (const k of Object.keys(base)) base[k] = worst(base[k], g[k] || 'ok');
  return base;
}
// ---------- mission control (MISSION tab), shares its profile with the gene simulator ----------
const ms = { day: 1, playing: false, acc: 0 };
function msPhase(key, day, days) {
  if (day === 0) return 'Pre-launch';
  if (key === 'leo' || key === 'twins') return day >= days ? 'Return to Earth' : day <= 1 ? 'Launch & ISS docking' : 'ISS operations (Low Earth Orbit)';
  if (day <= 1) return 'Launch & trans-Mars injection';
  if (key === 'marsrt') return day < days / 2 ? 'Outbound cruise to Mars' : day >= days ? 'Earth return' : 'Return cruise to Earth';
  return day >= days ? 'Mars arrival' : 'Deep-space cruise to Mars';
}
const EVT_SCEN = { evt_radiation_storm: 'radiation', evt_exercise_failure: 'bone' };
function msTimeline(key, days) {
  const ev = [['Launch', 0]];
  SCENARIOS.filter(s => s.custom && s.form?.mday !== '' && s.form?.mday != null && +s.form.mday <= days).forEach(s => ev.push([`Your scenario: ${s.name}`, +s.form.mday, { scen: s.id }]));
  if (key === 'leo' || key === 'twins') {
    ev.push(['ISS docking', 1], ['Mid-mission medical check', Math.round(days / 2)]);
    if (key === 'twins') ev.push(['Twins Study: in-flight sample (gene expression, telomeres)', Math.round(days * 0.5) + 10]);
    ev.push(['Return to Earth', days]);
  } else if (key === 'mars') {
    ev.push(['Trans-Mars injection', 1]);
    (gsim.events || []).filter(e => e.type !== 'communication_delay' && e.day_start <= days).forEach(e => ev.push([`${e.description} (Ares-180)`, e.day_start, { evt: e.id, end: e.day_end }]));
    if (!(gsim.events || []).length) [['Solar particle event (Ares-180)', 143, { evt: 'evt_radiation_storm', end: 143 }], ['Critical EVA (Ares-180)', 145, { evt: 'evt_eva_critical', end: 145 }]].filter(x => x[1] <= days).forEach(x => ev.push(x));
    ev.push(['Mars arrival', days]);
  } else {
    ev.push(['Trans-Mars injection', 1], ['Mars flyby / turnaround', Math.round(days / 2)], ['Earth return', days]);
  }
  return ev.sort((a, b) => a[1] - b[1]);
}
function msRender() {
  const key = $('#msProf').value, sit = SIT[key], days = +$('#gsDays').value || sit.days, day = Math.min(ms.day, days);
  $('#msDay').max = days; $('#msDay').value = day; $('#msDayV').textContent = `${day} / ${days}`;
  const dose = sit.rate * day, lo = (sit.lo ?? sit.rate) * day, hi = (sit.hi ?? sit.rate) * day, prior = +$('#gsPrior').value, pct = (prior + dose) / 6;
  const phase = msPhase(key, day, days);
  $('#tDay').textContent = day; $('#tPhase').textContent = phase;
  $('#tDose').textContent = sit.lo ? `${Math.round(lo)}–${Math.round(hi)} mSv` : `${Math.round(dose)} mSv`;
  const cCls = pct >= 100 ? 'crit' : pct >= 70 ? 'warn' : 'ok';
  $('#msInfo').innerHTML = `<div class="kv"><span>Phase</span><b>${phase}</b></div>
    <div class="kv"><span>Dose rate</span><b>${sit.lo ? `${sit.lo}–${sit.hi}` : sit.rate} mSv/day</b></div>
    <div class="kv"><span>Dose so far</span><b>${$('#tDose').textContent}</b></div>
    <div class="kv"><span>Career total vs NASA limit</span><b class="${cCls}">${Math.round(prior + dose)} mSv · ${Math.round(pct)}%</b></div>
    <div class="gd-bar career"><i class="${cCls}" style="width:${Math.min(100, pct)}%"></i></div>
    <div class="srcrow">${chips([sit.src, 'std3001_rad'])}</div>`;
  const tl = msTimeline(key, days);
  $('#timeline').innerHTML = tl.map(([n, d, x]) => { const act = x?.end != null ? day >= d && day <= x.end : day === d;
    return `<li data-day="${d}" class="${act ? 'now' : d < day ? 'done' : ''}"><b>${esc(n)}</b><span>Day ${d}${x?.end && x.end !== d ? '–' + x.end : ''}</span>${x?.evt === 'evt_eva_critical' ? '<button class="hud-btn mini" data-eva>OPEN EVA DECISION →</button>' : ''}</li>`; }).join('');
  $$('#timeline li').forEach(li => li.onclick = e => { if (e.target.closest('[data-eva]')) { goTab('eva'); return; } ms.day = +li.dataset.day; ms.playing = false; $('#msPlay').textContent = '▶'; msRender(); });
  $('#tTitle').textContent = key === 'leo' || key === 'twins' ? 'LOW EARTH ORBIT · ISS' : key === 'marsrt' ? 'TRANSIT: EARTH → MARS → EARTH' : 'TRANSIT: EARTH → MARS · ARES-180';
  mini.transitState = { key, frac: days ? day / days : 0 };
  msFollowScen(key, day, tl);
  const cur = SCENARIOS[state.scen];
  $('#msInfo').insertAdjacentHTML('beforeend', `<div class="kv"><span>Astronaut now (Overview scan)</span><b class="${cur.level === 'crit' ? 'crit' : cur.level === 'warn' ? 'warn' : 'ok'}">${esc(cur.name)}</b></div>`);
  window.dispatchEvent(new CustomEvent('beyond-horizons:mission-day', { detail: { key, day, days } }));
}
let msLastScen;
function msFollowScen(key, day, tl) {
  if (!$('#msFollow')?.checked) return;
  let want = 'nominal';
  const PRI = { radiation: 2, bone: 1, nominal: 0 };
  for (const [, d, x] of tl) {
    const w = x?.evt && EVT_SCEN[x.evt];
    if (w && day >= d && day <= (x.end ?? d) && PRI[w] > PRI[want]) want = w;
  }
  for (const [, d, x] of tl) if (x?.scen && day === d) want = x.scen;
  if (msLastScen === undefined) { msLastScen = want; return; }
  if (want === msLastScen) return;
  msLastScen = want;
  const i = SCENARIOS.findIndex(s => s.id === want);
  if (i >= 0 && i !== state.scen) setScenario(i);
}
function msSync(from) {
  if (from === 'gs') { if ($('#msProf').value !== $('#gsSit').value) { $('#msProf').value = $('#gsSit').value; } }
  msRender();
}
function initMission() {
  $('#msProf').value = $('#gsSit').value;
  $('#msProf').addEventListener('input', () => { gsim.touched = true; $('#gsSit').value = $('#msProf').value; $('#gsDays').value = SIT[$('#msProf').value].days; ms.day = 1; gsUpdate(); });
  $('#msFollow').addEventListener('change', () => { msLastScen = null; msRender(); });
  $('#msDay').addEventListener('input', () => { ms.day = +$('#msDay').value; ms.playing = false; $('#msPlay').textContent = '▶'; msRender(); });
  $('#msPlay').onclick = () => { ms.playing = !ms.playing; $('#msPlay').textContent = ms.playing ? '❚❚' : '▶'; if (ms.playing && ms.day >= +$('#msDay').max) ms.day = 0; };
  msRender();
}
function msTick(dt) {
  if (!ms.playing) return;
  ms.acc += dt; if (ms.acc < 0.08) return; ms.acc = 0;
  const max = +$('#msDay').max; ms.day = Math.min(max, ms.day + Math.max(1, Math.round(max / 150)));
  if (ms.day >= max) { ms.playing = false; $('#msPlay').textContent = '▶'; }
  msRender();
}
// ---------- radiation → gene alteration simulator (NASA rates + published gene data) ----------
const gsim = { status: null, genes: null, crew: null };
const SIT = {
  leo: { rate: 0.35, lo: 0.2, hi: 0.5, days: 180, label: 'ISS (LEO)', src: 'iss_dose' },
  twins: { rate: 0.35, lo: 0.2, hi: 0.5, days: 340, label: 'ISS one-year mission', src: 'iss_dose' },
  mars: { rate: 1.8, days: 180, label: 'deep-space cruise', src: 'msl_rad' },
  marsrt: { rate: 1.8, days: 360, label: 'Mars round-trip transit', src: 'msl_rad' },
};
const GENE_ROLE = {
  'Krt14': 'Structural keratin of basal skin cells',
  'MRP14': 'Inflammation signal (S100A9)',
  'Beta defensin-2': 'Antimicrobial immune peptide',
  'SCC antigen 2 homolog': 'Protease inhibitor raised in squamous-cell tumours',
  'CRBPII': 'Retinol (vitamin A) binding protein',
  'Calcium-binding protein 8 homolog': 'Calcium-binding signalling protein',
  'Involucrin': 'Skin barrier protein',
  'ODC': 'Cell-proliferation enzyme (polyamine synthesis)',
};
const roleOf = sym => { for (const [k, v] of Object.entries(GENE_ROLE)) if (sym.startsWith(k)) return v; return ''; };
function gsUpdate() {
  const sitKey = $('#gsSit').value, sit = SIT[sitKey], days = +$('#gsDays').value, spe = $('#gsSpe').checked, vitA = $('#gsVitA').checked;
  const prior = +$('#gsPrior').value, speDose = spe ? +$('#gsSpeDose').value : 0, who = $('#gsWho').value;
  $('#gsDaysV').textContent = days; $('#gsPriorV').textContent = prior + ' mSv'; $('#gsSpeV').textContent = $('#gsSpeDose').value + ' mSv';
  $('#gsSpeRow').style.display = spe ? '' : 'none';
  if (gsim.touched === undefined) gsim.touched = !!lsGet('beyond-horizons:gsim', {}).touched;
  lsSet('beyond-horizons:gsim', { sit: sitKey, days, spe, speDose: +$('#gsSpeDose').value, vitA, prior, who, touched: gsim.touched, body: $('#gsBody')?.checked });
  const shelter = false, speOpen = spe && speDose >= 100;
  const missionDose = sit.rate * days + speDose, lo = (sit.lo ?? sit.rate) * days + speDose, hi = (sit.hi ?? sit.rate) * days + speDose;
  const dose = missionDose, career = prior + missionDose, careerPct = career / 6;
  const band = dose < 100 ? 0 : dose < 300 ? 1 : dose < 600 ? 2 : 3;
  gsim.summary = { sitKey, label: sit.label, days, dose: missionDose, career, careerPct, who, spe, body: ($('#gsBody') ? $('#gsBody').checked : true) && gsim.touched };
  const bandTxt = ['LOW', 'MODERATE', 'ELEVATED', 'HIGH'][band], bandCls = ['ok', 'warn', 'warn', 'crit'][band];
  const risk = dose / 1000 * 5;
  const crewP = (gsim.crew || []).find(c => c.id === who);
  const sens = crewP?.baseline?.radiation_sensitivity;
  // markers
  gsim.status = {
    dna: band >= 2 || speOpen ? 'crit' : band >= 1 || spe ? 'warn' : 'ok',
    telomere: days >= 300 || band >= 1 ? 'warn' : 'ok',
    expr: days >= 180 ? 'warn' : 'ok',
    immune: days >= 300 || speOpen ? 'warn' : 'ok',
    oxid: band >= 1 || speOpen ? 'warn' : 'ok',
    mito: days >= 300 ? 'warn' : 'ok',
  };
  const crew = (gsim.crew || []).map(c => ({ n: c.display_name, r: c.role, s: c.baseline?.radiation_sensitivity ?? 0 })).sort((a, b) => b.s - a.s);
  const rng = sit.lo ? `${Math.round(lo)}–${Math.round(hi)} mSv` : `${Math.round(dose)} mSv`;
  const cCls = careerPct >= 100 ? 'crit' : careerPct >= 70 ? 'warn' : 'ok';
  const whoName = who === 'you' ? String(settings.astronaut) : crewP?.display_name || '';
  $('#gsDose').innerHTML = `
    <div class="gd-big"><span>This mission's dose · ${esc(whoName)}</span><b class="${bandCls}">${rng}</b><em>${sit.rate} mSv/day × ${days} days · ${sit.label}${spe ? ` + solar event ${speDose} mSv` : ''}</em>${chips([sit.src])}</div>
    <div class="kv"><span>Career total (previous + this mission)</span><b class="${cCls}">${Math.round(career)} mSv · ${Math.round(careerPct)}% of limit</b></div>
    <div class="gd-bar career"><i class="${cCls}" style="width:${Math.min(100, careerPct)}%"></i><span style="left:100%">NASA limit 600 mSv</span></div>
    ${spe ? `<div class="kv"><span>Solar event vs NASA per-event limit (250)</span><b class="${speDose > 250 ? 'crit' : speDose >= 100 ? 'warn' : 'ok'}">${speDose} mSv${speDose > 250 ? ' · OVER LIMIT' : ''}</b></div>` : ''}
    <div class="kv"><span>Added fatal-cancer risk (≈5% per Sv)</span><b class="${bandCls}">≈ ${risk.toFixed(1)}%</b></div>
    ${sens !== undefined ? `<div class="kv"><span>${esc(whoName)}'s radiation sensitivity</span><b class="${sens >= 0.6 ? 'warn' : 'ok'}">${sens.toFixed(2)} ${sens >= 0.6 ? '· higher than crew average' : ''}</b></div>` : ''}
    <div class="srcrow">${chips(['std3001_rad', 'msl_rad'])}</div>`;
  // genes
  if (gsim.genes) {
    const recs = gsim.genes.records, lg = v => Math.log10(1 + Math.max(0, v));
    const mx = Math.max(...recs.map(r => lg(Math.max(r.control, r.dose_9gy, r.dose_18gy))));
    $('#gsGeneNote').textContent = `(published: ${gsim.genes.organism.split(' (')[0].toLowerCase()} ${gsim.genes.tissue.toLowerCase()}, 9–18 Gy — far above a mission dose)`;
    $('#gsGenes').innerHTML = recs.map(r => {
      const sym = r.gene_symbol, cond = vitA ? r.dose_9gy_plus_vitamin_a : r.dose_9gy;
      const fc = r.control > 0 ? cond / r.control : null, up = fc === null ? cond > 0 : fc >= 2, dn = fc !== null && fc <= 0.5;
      const cls = up ? (fc === null || fc >= 10 ? 'crit' : 'warn') : dn ? 'warn' : 'ok';
      const fcTxt = fc === null ? (cond > 0 ? 'switched ON' : '—') : fc >= 1 ? `${fc.toFixed(fc >= 10 ? 0 : 1)}× up` : `${(1 / fc).toFixed(1)}× down`;
      return `<div class="gg ${cls}"><div class="gg-h"><b>${sym}</b><span>${roleOf(sym)}</span><em class="${cls}">${fcTxt}</em></div>
        <div class="gg-bars"><div><label>control</label><i style="width:${lg(r.control) / mx * 100}%"></i></div>${vitA ? `<div><label>9 Gy</label><i class="dim" style="width:${lg(r.dose_9gy) / mx * 100}%"></i></div>` : ''}<div><label>${vitA ? '9 Gy + vit A' : '9 Gy'}</label><i class="${cls}" style="width:${lg(cond) / mx * 100}%"></i></div>${!vitA ? `<div><label>18 Gy</label><i class="dim" style="width:${lg(r.dose_18gy) / mx * 100}%"></i></div>` : ''}</div></div>`;
    }).join('') + `<p class="gd-note">${vitA ? 'With dietary vitamin A, most radiation-induced changes are partly reversed (reversal-response genes), as reported by Burns et al. 2002.' : 'Radiation switched on stress-response, immune/inflammation and DNA-repair genes. Tick “Vitamin A” to see the countermeasure.'} ${chips(['nag9_1024'])}</p>`;
  }
  // consequences
  const C = (on, cls, title, body, src) => `<div class="cons ${on ? cls : 'off'}"><h4><span class="dot"></span>${title}</h4><p>${body}</p>${chips(src)}</div>`;
  $('#gsCons').innerHTML =
    C(band >= 1, band >= 3 ? 'crit' : 'warn', `Cancer risk · ≈ +${risk.toFixed(1)}%`, 'NASA/SwRI: 1 Sv of space radiation is associated with about a 5% increase in fatal-cancer risk. A Mars round-trip transit alone is ≈ 0.66 Sv.', ['msl_rad']) +
    C(gsim.status.dna !== 'ok', gsim.status.dna, 'DNA damage & genome instability', 'The NASA Twins Study recorded DNA damage and genome instability in flight. In mice, simulated cosmic rays left the heart\'s gene activity altered 440–660 days later (OSDR OSD-720).', ['twins', 'osd720']) +
    C(gsim.status.telomere !== 'ok', 'warn', 'Telomeres', 'Twins Study: telomeres lengthened during the year in space, then shortened quickly after landing; more short telomeres persisted.', ['twins']) +
    C(gsim.status.expr !== 'ok', 'warn', 'Gene expression keeps changing with time', 'Twins Study: far more genes changed in the second half of the year-long mission; most returned toward baseline within ~6 months after landing, some did not.', ['twins']) +
    C(gsim.status.immune !== 'ok' || band >= 1, 'warn', 'Inflammation & immune genes', 'Radiation switched on stress-response, immune/inflammation and DNA-repair genes (NAG9-1024); some T-cell activation changes persisted after the Twins mission.', ['nag9_1024', 'twins']) +
    C(careerPct >= 70, careerPct >= 100 ? 'crit' : 'warn', `NASA career limit · ${Math.round(careerPct)}% used`, 'NASA-STD-3001: career spaceflight dose must stay below 600 mSv for every astronaut, set at a 3% mean risk of cancer death; a single solar particle event is limited to 250 mSv.', ['std3001_rad']) +
    C(true, 'ok', 'Countermeasures', `Storm shelter during solar events (protects from solar particles, though cosmic rays are hard to stop). Vitamin A partly reversed the radiation gene signature in the study${vitA ? ' (active)' : ''}. Shorter time in deep space lowers the cumulative dose.`, ['msl_rad', 'nag9_1024']);
  renderGenOverview(); applyOrganStatus(); updateStatusUI(); updateScanList(); if (typeof msSync === 'function') msSync('gs');
  renderGeneList();
}
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fillWho() {
  const sel = $('#gsWho'), cur = sel.value || lsGet('beyond-horizons:gsim', {}).who || 'you';
  sel.innerHTML = `<option value="you">${esc(settings.astronaut)} (you)</option>` + (gsim.crew || []).map(c => `<option value="${esc(c.id)}">${esc(c.display_name)} · ${esc(c.role)}</option>`).join('');
  sel.value = [...sel.options].some(o => o.value === cur) ? cur : 'you';
}
function renderGenOverview() {
  const st = geneStatus(), sc = scen(), vals = Object.values(st);
  const nW = vals.filter(x => x === 'warn').length, nC = vals.filter(x => x === 'crit').length;
  const expr = Math.max(80, sc.gen.expr - nW * 1.6 - nC * 3.5);
  $('#gExpr').textContent = expr.toFixed(1) + '%';
  const eb = $('#gExprBar'); eb.style.width = expr + '%'; eb.className = expr < 93 ? 'warn' : '';
  const mut = st.dna === 'crit' ? ['High', 88, 'crit'] : st.dna === 'warn' ? ['Elevated', 60, 'warn'] : [sc.gen.mut[0], sc.gen.mut[1], sc.gen.mut[1] > 50 ? 'warn' : ''];
  $('#gMut').textContent = mut[0]; const mb = $('#gMutBar'); mb.style.width = mut[1] + '%'; mb.className = mut[2];
  const g = gsim.summary;
  if (g) $('#genSimLine').innerHTML = `<span>GENE SIMULATOR</span> ${esc(g.label)} · ${g.days} d · <b class="${g.careerPct >= 100 ? 'crit' : g.careerPct >= 70 ? 'warn' : 'ok'}">${Math.round(g.dose)} mSv · ${Math.round(g.careerPct)}% of NASA career limit</b>${nW + nC ? ` · <b class="${nC ? 'crit' : 'warn'}">${nW + nC} marker${nW + nC > 1 ? 's' : ''} flagged</b>` : ''}`;
}
function gsHow() {
  $('#gsHowBody').innerHTML = `
    <p class="lead">Every number on the simulator comes either from a NASA measurement or standard, or from a published NASA-funded study. The few rules we added are listed as rules.</p>
    <div class="help-grid">
      <div><h4>1 · DOSE RATE (MEASURED)</h4><p>ISS: 0.2–0.5 mSv/day (shown as a range, 0.35 mid-point). Deep space: 1.8 mSv/day, measured by Curiosity's RAD instrument on the way to Mars.</p>${chips(['iss_dose', 'msl_rad'])}</div>
      <div><h4>2 · MISSION DOSE (CALCULATED)</h4><p>Dose rate × days in space, plus the solar-event dose you set. Solar events vary too much to have one number, so you choose it; NASA limits one event to 250 mSv.</p>${chips(['std3001_rad'])}</div>
      <div><h4>3 · CAREER LIMIT (NASA STANDARD)</h4><p>Previous missions + this mission, compared with NASA's 600 mSv career limit (same for every age and sex, 3% mean risk of cancer death).</p>${chips(['std3001_rad'])}</div>
      <div><h4>4 · CANCER RISK (LINEAR ESTIMATE)</h4><p>≈5% more fatal-cancer risk per 1 Sv, as stated with the Curiosity RAD results. A straight-line estimate, not a personal prediction.</p>${chips(['msl_rad'])}</div>
      <div><h4>5 · GENE CHANGES (PUBLISHED DATA)</h4><p>Measured expression of 8 genes in rat skin after 9 and 18 Gy of radiation, with and without vitamin A (NASA grant NAG9-1024). These are lab doses far above a mission dose: they show which genes radiation changes, not the size of the change in a crew member.</p>${chips(['nag9_1024'])}</div>
      <div><h4>6 · MARKERS (RULES WE SET)</h4><p>Display rules based on NASA findings: DNA-damage marker on watch from 100 mSv, alert from 300 mSv or a solar event ≥100 mSv; telomeres, immune and mitochondrial markers on watch from ~300 days (one-year Twins mission); expression drift from 180 days.</p>${chips(['twins', 'osd720'])}</div>
    </div>
    <h4>CREW SENSITIVITY</h4><p class="note" style="padding:0">Atlas, Nova, Lyra and Orion are the synthetic Ares-180 crew; their radiation sensitivity is a modelled trait, not a real person's genetics.</p>`;
  $('#gsHowModal').classList.remove('hidden');
}
async function initGeneSim() {
  const saved = lsGet('beyond-horizons:gsim', null);
  if (saved) { $('#gsSit').value = saved.sit; $('#gsDays').value = saved.days; $('#gsSpe').checked = !!saved.spe; $('#gsSpeDose').value = saved.speDose ?? 50; $('#gsVitA').checked = !!saved.vitA; $('#gsPrior').value = saved.prior ?? 0; if (saved.body === false) $('#gsBody').checked = false; }
  fillWho();
  ['gsWho', 'gsSit', 'gsDays', 'gsSpe', 'gsSpeDose', 'gsVitA', 'gsPrior', 'gsBody'].forEach(id => $('#' + id).addEventListener('input', () => {
    if (id === 'gsSit') $('#gsDays').value = SIT[$('#gsSit').value].days;
    gsim.touched = true;
    gsUpdate();
  }));
  $('#gsHowBtn').onclick = gsHow;
  addEventListener('beyond-horizons:crew-changed', async () => { try { gsim.crew = (await getMissionData()).crew_profiles; fillWho(); gsUpdate(); } catch { /* ignore */ } });
  $('#gsHowModal').addEventListener('click', e => { if (e.target.id === 'gsHowModal') e.target.classList.add('hidden'); });
  $('#gsTableBtn').onclick = () => { $('#geneTableModal').classList.remove('hidden'); onTab('genetics'); };
  $('#geneTableModal').addEventListener('click', e => { if (e.target.id === 'geneTableModal') e.target.classList.add('hidden'); });
  gsUpdate();
  try { gsim.genes = await getGenesData(); } catch { /* shown as unavailable */ }
  try { const md = await getMissionData(); gsim.crew = md.crew_profiles; gsim.events = md.events || []; fillWho(); } catch { /* optional */ }
  if (!gsim.genes) $('#gsGenes').innerHTML = '<p class="note">Gene data unavailable right now.</p>';
  gsUpdate();
}
let geneSel = null;
function renderGeneList() {
  const st = geneStatus(), sc = scen();
  const lbl = s => s === 'ok' ? 'STABLE' : s === 'warn' ? 'WATCH' : 'ALERT';
  $('#geneList').innerHTML = Object.entries(GENE_INFO).map(([k, g]) => `<div class="gene${geneSel === k ? ' sel' : ''}" data-g="${k}"><b>${g.name}</b><span>${k === 'expr' ? `Stability ${sc.gen.expr.toFixed(1)}% vs. pre-flight baseline` : g.short}</span><b style="color:var(--${st[k] === 'ok' ? 'ok' : st[k]})">${lbl(st[k])}</b></div>`).join('');
  $$('#geneList .gene').forEach(r => r.onclick = () => { geneSel = r.dataset.g; renderGeneList(); });
  const flagged = Object.entries(st).filter(([, s]) => s !== 'ok'), level = worst(...Object.values(st));
  setDnaStatus(level, flagged.length + (level === 'crit' ? 2 : 0));
  $('#genStatus').innerHTML = flagged.length ? `<b class="${level}">${flagged.length} MARKER${flagged.length > 1 ? 'S' : ''} ${level === 'crit' ? 'IN ALERT' : 'ON WATCH'}</b><span>highlighted on the DNA model · click a marker for details</span>` : '<b class="ok">GENOME STABLE</b><span>no marker outside the baseline band</span>';
  const k = geneSel || (flagged[0] && flagged[0][0]);
  if (!k) { $('#geneDetail').innerHTML = ''; return; }
  const g = GENE_INFO[k], s = st[k];
  $('#geneDetail').innerHTML = `<h4>${g.name} · <span class="${s}">${lbl(s)}</span></h4><p><b>What it is:</b> ${g.what}</p><p><b>What NASA found:</b> ${g.nasa}</p><p><b>${s === 'ok' ? 'Monitoring' : 'Suggested action'}:</b> ${g.act}</p><div>${chips(g.src)}</div>`;
}
function buildScenarioUI() {
  const sel = $('#scenarioSel');
  sel.innerHTML = SCENARIOS.map((s, i) => `<option value="${i}">${i + 1}. ${s.name}</option>`).join('');
  sel.value = state.scen;
  sel.onchange = () => setScenario(+sel.value);
  const E = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  $('#simCards').innerHTML = SCENARIOS.map((s, i) => `<div class="card${i === state.scen ? ' on' : ''}${s.custom ? ' user' : ''}" data-i="${i}"><span class="lvl ${s.level}">${s.level === 'ok' ? 'NOMINAL' : s.level === 'warn' ? 'WARNING' : 'CRITICAL'}</span>${s.custom ? '<span class="lvl usr">YOUR SCENARIO</span>' : ''}<h3>${i + 1}. ${E(s.name)}</h3><p>${E(s.desc)}</p><div class="srcs">${chips(s.src)}</div><span class="k">${i < 9 ? `key [${i + 1}]` : ''}</span>${s.custom ? `<span class="card-act"><button data-edit="${s.id}" title="Edit">✎ EDIT</button><button data-del="${s.id}" title="Delete">✕ DELETE</button></span>` : ''}</div>`).join('');
  $$('.card').forEach(c => c.onclick = e => {
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) { e.stopPropagation(); openScenarioEditor(ed.dataset.edit); return; }
    if (del) { e.stopPropagation(); if (del.dataset.armed) deleteCustom(del.dataset.del); else { del.dataset.armed = 1; del.textContent = 'CONFIRM?'; setTimeout(() => { if (del.isConnected) { delete del.dataset.armed; del.textContent = '✕ DELETE'; } }, 3000); } return; }
    setScenario(+c.dataset.i);
  });
}
// ---- link between MY VITALS (Beyond Horizons API evaluation) and the hologram ----
const CAT_TO_SYS = { cardiac: 'cardiovascular', temperature: 'cardiovascular', respiratory: 'respiratory', sleep_fatigue: 'neurological', activity_muscle: 'muscular', hydration_other: 'digestive' };
const EV_MAP = { normal: 'ok', attention: 'warn', alert: 'crit' };
const METRIC_INFO = {
  heart_rate: { organ: 'heart (cardiovascular)', hi: 'A fast resting heart rate can come from effort, stress, fever, dehydration or low oxygen.', lo: 'A slow heart rate can be normal in very fit people; with dizziness or fainting it needs attention.',
    warn: 'Rest for 5 minutes, drink water and measure again.', crit: 'Stop any activity, measure again now and contact the flight surgeon.' },
  spo2: { organ: 'lungs and brain', lo: 'Low blood oxygen means less oxygen reaches the brain and muscles. Check the cabin O₂ reading and your breathing.',
    warn: 'Breathe slowly, check cabin O₂ and measure again.', crit: 'Use supplemental oxygen if available and alert the flight surgeon now.' },
  respiratory_rate: { organ: 'lungs', hi: 'Fast breathing can follow effort, anxiety, fever, high cabin CO₂ or low oxygen.', lo: 'Very slow breathing can mean drowsiness or a medication effect.',
    warn: 'Sit, relax and count your breaths again for one full minute.', crit: 'Check cabin CO₂ and O₂, count again for one full minute and alert the flight surgeon.' },
  body_temp: { organ: 'heart and circulation', hi: 'A high temperature can mean fever (infection) or heat stress from a warm cabin or exercise.', lo: 'A low temperature can mean cold exposure.',
    warn: 'Measure again in 15 minutes, drink fluids and check the cabin temperature.', crit: 'Measure again now; if confirmed, cool down (or warm up) and contact the flight surgeon.' },
  sleep: { organ: 'brain (neurological)', lo: 'Short sleep lowers attention and reaction time, a known risk on long missions.', warn: 'Plan a longer sleep period tonight.', crit: 'Avoid critical tasks such as a spacewalk until rested.' },
  sleep_quality: { organ: 'brain (neurological)', lo: 'Poor sleep quality adds up to fatigue even when the hours look fine.', warn: 'Check light, noise and schedule before the next sleep period.', crit: 'Avoid critical tasks until rested and tell the flight surgeon.' },
  activity: { organ: 'muscles', lo: 'Little exercise speeds up muscle and bone loss in weightlessness.', warn: 'Add an exercise session today.', crit: 'Schedule daily exercise sessions.' },
  hydration: { organ: 'digestive (GI) tract — hydration', lo: 'Low hydration can raise heart rate and temperature and cause headaches.', warn: 'Drink water and check again later.', crit: 'Drink water now and keep track of how much you drink.' },
};
const ODD = { respiratory_rate: [6, 40], heart_rate: [30, 180], body_temp: [34, 41], spo2: [80, 100] };
function selfSummary(ev) {
  const rank = { alert: 2, attention: 1, normal: 0 }, flagged = ev.metrics.filter(m => m.status !== 'normal').sort((a, b) => rank[b.status] - rank[a.status]);
  if (!flagged.length) return { ai: ['All your readings are inside the normal resting ranges.', 'Keep logging readings to build a personal trend.'], detail: ['<p>All your readings are inside the general adult resting ranges. Nothing is highlighted on the body scan.</p>'], recs: ['Keep logging readings to build a personal trend.'], flags: '<li>All readings inside normal ranges.</li>' };
  const detail = flagged.map(m => {
    const i = METRIC_INFO[m.metric_id] || {}, cls = m.status === 'alert' ? 'c' : 'w', lvl = m.status === 'alert' ? 'ALERT' : 'WATCH';
    const lowSide = /below|low/i.test(m.note) || (i.lo && !i.hi); const why = (lowSide ? i.lo : i.hi) || i.hi || i.lo || '';
    const odd = ODD[m.metric_id] && (m.value < ODD[m.metric_id][0] || m.value > ODD[m.metric_id][1]) ? ' <em>This value is very unusual at rest — if it was typed by mistake, fix it in MY VITALS.</em>' : '';
    return `<p><span class="${cls}"><b>${m.label}: ${m.value} ${m.unit}</b> — ${lvl}</span> (normal ${m.reference_range}). ${why}${i.organ ? ` <i>Highlighted on the scan: ${i.organ}.</i>` : ''}${odd}</p>`;
  });
  if (flagged.length >= 2) detail.push(`<p><b>${flagged.length} readings are out of range at the same time.</b> Several abnormal values together matter more than one alone: measure them again before deciding, and if they are confirmed, tell the flight surgeon.</p>`);
  const recs = [...new Set(flagged.flatMap(m => [`${m.label}: ${(METRIC_INFO[m.metric_id] || {})[m.status === 'alert' ? 'crit' : 'warn'] || 'Measure again.'}`, ...(m.recommendations || []).map(r => `${m.label}: ${r}`)]))].slice(0, 8);
  const top = flagged[0], cls = top.status === 'alert' ? 'c' : 'w';
  return { ai: [`<span class="${cls}">${flagged.map(m => `${m.label} ${m.value} ${m.unit}`).join(' · ')} out of range.</span>`, (METRIC_INFO[top.metric_id] || {})[top.status === 'alert' ? 'crit' : 'warn'] || 'Measure again.'],
    detail, recs, flags: flagged.map(m => `<li><b style="color:var(--${m.status === 'alert' ? 'crit' : 'warn'})">${m.status === 'alert' ? 'ALERT' : 'WATCH'}</b> — ${m.label}: ${m.value} ${m.unit} <small>(normal ${m.reference_range})</small></li>`).join('') };
}
function registerSelfVitals(entry, ev) {
  const rank = { ok: 0, warn: 1, crit: 2 }, organs = {};
  for (const m of ev.metrics) { const sys = CAT_TO_SYS[m.category], st = EV_MAP[m.status]; if (sys && st !== 'ok' && (!organs[sys] || rank[st] > rank[organs[sys]])) organs[sys] = st; }
  const ms = id => EV_MAP[ev.metrics.find(m => m.metric_id === id)?.status || 'normal'];
  const s = {
    id: 'self', name: 'My vitals (latest reading)', level: EV_MAP[ev.overall_status], self: true,
    desc: 'Your own reading from MY VITALS, evaluated against general adult resting ranges.',
    v: { hr: entry.heart_rate_bpm, spo2: entry.spo2_percent, temp: entry.body_temp_c, rr: entry.respiratory_rate_bpm },
    irregular: entry.heart_rhythm === 'irregular', organs, sys: {}, gen: { expr: 98.1, mut: ['Low', 22] }, neural: 92.4, src: ['clinical'],
    evalStatus: { hr: ms('heart_rate'), spo2: ms('spo2'), temp: ms('body_temp'), rr: ms('respiratory_rate'), bp: 'ok' },
  };
  const sm = selfSummary(ev); s.ai = sm.ai; s.aiDetail = sm.detail; s.recs = sm.recs; s.flagHtml = sm.flags;
  if (!s.recs.length) s.recs = ['Keep logging readings to build a personal trend.'];
  selfScenario = s;
  rebuildScenarioList();
  return SCENARIOS.findIndex(x => x.id === 'self');
}
function applySelfVitals(entry, ev) {
  const i = registerSelfVitals(entry, ev);
  setScenario(i); if (state.mode !== 'scan') setMode('scan');
}
// ---------- customization: mission settings ----------
function applySettings() {
  CONFIG.astronaut = settings.astronaut; CONFIG.mission = settings.mission;
  $('#hdAstro').textContent = String(settings.astronaut).toUpperCase(); $('#hdMission').textContent = String(settings.mission).toUpperCase();
  $('#tCrew').textContent = settings.crew;
  CONFIG.startElapsed = Math.round(+settings.elapsedH * 3600) || 0; state.clock0 = performance.now(); clockTick();
  if (typeof fillWho === 'function' && $('#gsWho')?.options.length) { const w = $('#gsWho').value; fillWho(); $('#gsWho').value = w; gsUpdate(); }
}
function openSettings() {
  const f = $('#cfgForm'); for (const k of Object.keys(DEFAULT_SET)) f.elements[k].value = settings[k];
  $('#cfgModal').classList.remove('hidden'); f.elements.astronaut.focus();
}
function saveSettings() {
  const f = $('#cfgForm'), n = {};
  for (const k of Object.keys(DEFAULT_SET)) n[k] = f.elements[k].value.trim();
  n.crew = Math.max(1, Math.min(12, parseInt(n.crew) || 4)); n.elapsedH = Math.max(0, +n.elapsedH || 0);
  if (!n.astronaut) n.astronaut = DEFAULT_SET.astronaut; if (!n.mission) n.mission = DEFAULT_SET.mission; if (!n.phase) n.phase = DEFAULT_SET.phase;
  settings = n; lsSet(SET_KEY, settings); applySettings(); $('#cfgModal').classList.add('hidden');
}
// ---------- customization: user scenarios ----------
const BODY_SYS = ['skeletal', 'muscular', 'cardiovascular', 'respiratory', 'neurological', 'digestive'];
const SHIP_SYS = [['life', 'Life support'], ['thermal', 'Thermal control'], ['rad', 'Radiation shielding'], ['comm', 'Communication']];
const worst = (...xs) => xs.includes('crit') ? 'crit' : xs.includes('warn') ? 'warn' : 'ok';
function scenarioFromForm(d) {
  const v = { hr: +d.hr, spo2: Math.min(100, +d.spo2), temp: +d.temp, sys: +d.sys, dia: +d.dia, rr: +d.rr };
  const e = { o2: +d.o2, co2: +d.co2 / 7.6, press: 14.7, temp: +d.ctemp, rad: +d.rad / 24 };
  const c = (k, x) => classify(x, RANGES[k]), ce = (k, x) => classify(x, ENV_RANGES[k]);
  const auto = {
    cardiovascular: worst(c('hr', v.hr), c('sys', v.sys), c('temp', v.temp), d.irregular ? 'warn' : 'ok'),
    respiratory: worst(c('spo2', v.spo2), c('rr', v.rr)),
    neurological: c('spo2', v.spo2) === 'crit' || c('temp', v.temp) === 'crit' ? 'warn' : 'ok',
    skeletal: ce('rad', e.rad) === 'crit' ? 'warn' : 'ok', muscular: 'ok', digestive: ce('rad', e.rad) === 'crit' ? 'warn' : 'ok',
  };
  const shipAuto = { life: worst(ce('o2', e.o2), ce('co2', e.co2)), thermal: ce('temp', e.temp), rad: ce('rad', e.rad), comm: 'ok' };
  const organs = {}, sys = {};
  BODY_SYS.forEach(k => { const x = d['b_' + k] === 'auto' ? auto[k] : d['b_' + k]; if (x !== 'ok') organs[k] = x; });
  SHIP_SYS.forEach(([k]) => { const x = d['s_' + k] === 'auto' ? shipAuto[k] : d['s_' + k]; if (x !== 'ok') sys[k] = x; });
  const vs = { hr: c('hr', v.hr), spo2: c('spo2', v.spo2), temp: c('temp', v.temp), bp: c('sys', v.sys), rr: c('rr', v.rr) };
  const level = worst(...Object.values(organs), ...Object.values(sys), ...Object.values(vs));
  const flags = [];
  if (vs.hr !== 'ok') flags.push(`HR ${v.hr} bpm`); if (vs.spo2 !== 'ok') flags.push(`SpO₂ ${v.spo2}%`); if (vs.temp !== 'ok') flags.push(`temp ${v.temp} °C`);
  if (vs.bp !== 'ok') flags.push(`BP ${v.sys}/${v.dia}`); if (vs.rr !== 'ok') flags.push(`RR ${v.rr}`);
  if (ce('o2', e.o2) !== 'ok') flags.push(`cabin O₂ ${e.o2}%`); if (ce('co2', e.co2) !== 'ok') flags.push(`CO₂ ${(+d.co2).toFixed(1)} mmHg (limit 3)`);
  if (ce('temp', e.temp) !== 'ok') flags.push(`cabin ${e.temp} °C`); if (ce('rad', e.rad) !== 'ok') flags.push(`dose ${(+d.rad).toFixed(2)} mSv/day`);
  const cls = level === 'crit' ? 'c' : 'w';
  const ai = d.insight ? [level === 'ok' ? d.insight : `<span class="${cls}">${d.insight.replace(/</g, '&lt;')}</span>`] :
    flags.length ? [`<span class="${cls}">Flagged: ${flags.join(', ')}.</span>`, 'Checked against NASA-STD-3001 habitat limits and clinical vital-sign ranges.'] : ['All readings within limits.', 'Checked against NASA-STD-3001 habitat limits and clinical vital-sign ranges.'];
  const recs = (d.recs || '').split('\n').map(x => x.trim()).filter(Boolean);
  const src = ['clinical'];
  if (ce('co2', e.co2) !== 'ok') src.push('std3001_co2'); if (ce('o2', e.o2) !== 'ok') src.push('std3001_atm'); if (ce('temp', e.temp) !== 'ok') src.push('std3001_env');
  if (ce('rad', e.rad) !== 'ok') src.push('iss_dose', 'msl_rad');
  return { id: d.id, custom: true, form: d, name: d.name || 'My scenario', desc: d.desc || 'User-defined scenario.', level, v, e, irregular: !!d.irregular, organs, sys, src,
    gen: { expr: ce('rad', e.rad) === 'crit' ? 92.5 : 97.8, mut: ce('rad', e.rad) === 'crit' ? ['Elevated', 60] : ['Low', 23] }, neural: organs.neurological ? 84 : 91.5,
    ai, recs: recs.length ? recs : ['Review the flagged readings with the flight surgeon.', 'Re-run the body scan after corrective action.'] };
}
function rebuildScenarioList() {
  const cur = SCENARIOS[state.scen]?.id;
  SCENARIOS.splice(BASE_COUNT);
  lsGet(CS_KEY, []).forEach(d => SCENARIOS.push(scenarioFromForm(d)));
  if (selfScenario) SCENARIOS.push(selfScenario);
  const ni = SCENARIOS.findIndex(x => x.id === cur); state.scen = ni >= 0 ? ni : 0;
  buildScenarioUI();
}
function openScenarioEditor(id) {
  const f = $('#scenForm'); f.reset();
  const opt = sel => ['auto', 'ok', 'warn', 'crit'].map(o => `<option value="${o}"${o === sel ? ' selected' : ''}>${{ auto: 'Auto', ok: 'OK', warn: 'Watch', crit: 'Alert' }[o]}</option>`).join('');
  const d = id ? lsGet(CS_KEY, []).find(x => x.id === id) : null;
  $('#scenSys').innerHTML = BODY_SYS.map(k => `<label class="fld"><span>${k[0].toUpperCase() + k.slice(1)}</span><select name="b_${k}">${opt(d?.['b_' + k] || 'auto')}</select></label>`).join('');
  $('#scenShip').innerHTML = SHIP_SYS.map(([k, l]) => `<label class="fld"><span>${l}</span><select name="s_${k}">${opt(d?.['s_' + k] || 'auto')}</select></label>`).join('');
  if (d) for (const [k, v] of Object.entries(d)) { const el = f.elements[k]; if (!el) continue; if (el.type === 'checkbox') el.checked = !!v; else el.value = v; }
  f.dataset.id = id || '';
  $('#scenTitle').textContent = id ? 'EDIT SCENARIO' : 'CREATE SCENARIO';
  $('#scenModal').classList.remove('hidden'); f.elements.name.focus(); scenPreview();
}
function scenFormData() {
  const f = $('#scenForm'), d = { id: f.dataset.id || 'preview' };
  for (const el of f.elements) if (el.name) d[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  return d;
}
function scenPreview() {
  const s = scenarioFromForm(scenFormData()), lv = { ok: 'NOMINAL', warn: 'WATCH', crit: 'ALERT' }[s.level];
  const organs = Object.entries(s.organs).map(([k, v]) => `${k} (${v === 'crit' ? 'alert' : 'watch'})`);
  $('#scenPreview').innerHTML = `<b class="${s.level}">RESULT: ${lv}</b> ` + (s.level === 'ok'
    ? '<span>All values are inside the normal ranges, so the scan will look nominal. Change a value outside its range (e.g. heart rate 140, SpO₂ 86, CO₂ 6) to see an alert.</span>'
    : `<span>${s.ai[0].replace(/<[^>]+>/g, '')}${organs.length ? ' Glowing on the scan: ' + organs.join(', ') + '.' : ''}</span>`);
}
function saveScenarioEditor() {
  const f = $('#scenForm');
  if (!f.reportValidity()) return;
  const d = { id: f.dataset.id || 'user-' + Date.now().toString(36) };
  for (const el of f.elements) if (el.name) d[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  const list = lsGet(CS_KEY, []), i = list.findIndex(x => x.id === d.id);
  if (i >= 0) list[i] = d; else list.push(d);
  lsSet(CS_KEY, list); rebuildScenarioList();
  $('#scenModal').classList.add('hidden');
  const si = SCENARIOS.findIndex(x => x.id === d.id), s = SCENARIOS[si];
  msLastScen = s.id; setScenario(si); goTab('overview'); setMode('scan');
  hudToast(`Scenario “${s.name}” applied: ${{ ok: 'all readings normal', warn: 'WATCH', crit: 'ALERT' }[s.level]}${d.mday !== '' ? ` · placed on mission day ${d.mday}` : ''}.`);
  if ($('#msRender') || true) msRender();
}
function hudToast(t) {
  let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = t; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 4500);
}
function deleteCustom(id) {
  lsSet(CS_KEY, lsGet(CS_KEY, []).filter(x => x.id !== id)); rebuildScenarioList(); setScenario(state.scen);
}
// ---------- drag / zoom for the large 3D views ----------
function interact(name, h) {
  const el = document.querySelector(`.mini3d[data-view="${name}"]`); if (!el) return;
  el.classList.add('interactive'); let down = null;
  el.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); el.classList.add('drag'); });
  el.addEventListener('pointermove', e => { if (!down) return; h.drag?.(e.clientX - down.x, e.clientY - down.y); down = { x: e.clientX, y: e.clientY }; });
  const up = () => { down = null; el.classList.remove('drag'); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => { e.preventDefault(); h.wheel?.(e.deltaY); }, { passive: false });
  el.addEventListener('dblclick', () => h.reset?.());
}
function orbitable(name, cam, target) {
  const base = cam.position.clone().sub(target), u = { yaw: 0, pitch: 0, zoom: 1 };
  interact(name, {
    drag: (dx, dy) => { u.yaw -= dx * 0.006; u.pitch = THREE.MathUtils.clamp(u.pitch + dy * 0.006, -1.2, 1.2); },
    wheel: dy => { u.zoom = THREE.MathUtils.clamp(u.zoom * (1 + dy * 0.001), 0.35, 2.5); },
    reset: () => { u.yaw = 0; u.pitch = 0; u.zoom = 1; },
  });
  const sph = new THREE.Spherical(), off = new THREE.Vector3();
  return () => {
    sph.setFromVector3(base); sph.theta += u.yaw; sph.phi = THREE.MathUtils.clamp(sph.phi + u.pitch, 0.1, Math.PI - 0.1); sph.radius *= u.zoom;
    off.setFromSpherical(sph); cam.position.copy(target).add(off); cam.lookAt(target);
  };
}
function hudSummary() {
  const v = state.v;
  return { scenario: scen().name, text: `HR ${Math.round(v.hr)} bpm, SpO2 ${Math.round(v.spo2)}%, temp ${v.temp.toFixed(1)} C, BP ${Math.round(v.sys)}/${Math.round(v.dia)}, RR ${Math.round(v.rr)}; overall ${overall()}; flagged systems: ${Object.entries(bodyOrgans()).filter(([, x]) => x !== 'ok').map(([k, x]) => k + ' ' + x).join(', ') || 'none'}.` };
}
function buildStatic() {
  initSources();
  $('#helpBtn').onclick = () => $('#helpModal').classList.remove('hidden');
  $('#helpModal').addEventListener('click', e => { if (e.target.id === 'helpModal') e.target.classList.add('hidden'); });
  $('#zoomIn').onclick = () => setZoom(1); $('#zoomOut').onclick = () => setZoom(-1);
  if (!ZOOMS.includes(uiZoom)) uiZoom = 1;
  const put = (id, ids) => { const el = document.getElementById(id); if (el) el.innerHTML = chips(ids); };
  put('envSrc', ['std3001_co2', 'std3001_env', 'std3001_atm', 'iss_dose']); put('genSrc', ['twins']); put('sysSrc', ['std3001_co2', 'std3001_atm']);
  put('misSrc', ['iss_dose']); put('transitSrc', ['msl_rad', 'iss_dose']); put('rangeSrc', ['clinical']); put('markSrc', ['twins']);
  put('crewSrc', ['msl_rad', 'hrp_bone', 'hrp_muscle']);
  buildScenarioUI();
  $('#rangeTable').innerHTML = '<tr><th>READING</th><th>NORMAL</th><th>WATCH</th><th>ALERT</th></tr>' + Object.values(RANGES).map(r =>
    `<tr><td>${r.label}</td><td>${r.ok[0]}–${r.ok[1]} ${r.unit}</td><td>${r.warn[0]}–${r.warn[1]}</td><td>outside watch band</td></tr>`).join('');
  $$('#modeSwitch button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
  $$('.tab').forEach(t => t.onclick = () => goTab(t.dataset.tab));
  $('#viewReset').onclick = () => holo.ctl?.reset();
  ['hdEdit1', 'hdEdit2'].forEach(id => $('#' + id).onclick = openSettings);
  $('#cfgSave').onclick = saveSettings;
  $('#cfgReset').onclick = () => { settings = { ...DEFAULT_SET }; lsSet(SET_KEY, settings); applySettings(); openSettings(); };
  $('#newScen').onclick = () => openScenarioEditor(null);
  $('#scenSave').onclick = saveScenarioEditor;
  { const rt = $('.etile[data-e="rad"]'); rt.style.cursor = 'pointer'; rt.title = 'Radiation follows the situation and solar-event dose chosen in GENETICS — click to change'; rt.onclick = () => goTab('genetics'); }
  $('#scenForm').addEventListener('input', scenPreview); $('#scenForm').addEventListener('change', scenPreview);
  window.BH = { mission: () => { const key = $('#msProf').value, days = +$('#msDay').max; return { key, day: Math.min(ms.day, days), days }; },
    scenario: () => SCENARIOS[state.scen], goTab, goDay: (d, key) => { if (key && $('#msProf').value !== key) { $('#msProf').value = key; $('#msProf').dispatchEvent(new Event('input')); } ms.day = d; msRender(); goTab('mission'); } };
  $$('[data-close]').forEach(b => b.onclick = () => $('#' + b.dataset.close).classList.add('hidden'));
  ['cfgModal', 'scenModal'].forEach(id => $('#' + id).addEventListener('click', e => { if (e.target.id === id) e.target.classList.add('hidden'); }));
  rebuildScenarioList();
  $('#fsBtn').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
  $('#aiBtn').onclick = () => {
    const sc = scen(), st = vitalStatus();
    const tv = targetV(), val = { hr: `${Math.round(tv.hr)} bpm`, spo2: `${Math.round(tv.spo2)} %`, temp: `${tv.temp.toFixed(1)} °C`, bp: `${Math.round(tv.sys)}/${Math.round(tv.dia)} mmHg`, rr: `${Math.round(tv.rr)} br/min` };
    const flags = sc.flagHtml || Object.entries(st).filter(([, s]) => s !== 'ok').map(([k, s]) => { const R = RANGES[k === 'bp' ? 'sys' : k]; return `<li><b style="color:var(--${s})">${s === 'crit' ? 'ALERT' : 'WATCH'}</b> — ${R.label}: ${val[k]} <small>(normal ${R.ok[0]}–${R.ok[1]} ${R.unit})</small></li>`; }).join('') || '<li>All readings inside normal ranges.</li>';
    const orgs = Object.entries(bodyOrgans()).filter(([, v]) => v !== 'ok').map(([k, v]) => `${k === 'digestive' ? 'digestive (GI) tract' : k} (${v === 'crit' ? 'alert' : 'watch'})`);
    $('#mdTitle').textContent = 'AI INSIGHTS — ' + sc.name.toUpperCase();
    $('#mdBody').innerHTML = `<h4>SUMMARY</h4>${(sc.aiDetail || sc.ai.map(p => `<p>${p}</p>`)).join('')}${!sc.aiDetail && orgs.length ? `<p><i>Highlighted on the body scan: ${orgs.join(', ')}.</i></p>` : ''}${geneOrgans().why.length ? `<p><b>From your GENETICS situation:</b> ${geneOrgans().why.map(esc).join('; ')}.</p>` : ''}<h4>FLAGGED READINGS</h4><ul>${flags}</ul><h4>RECOMMENDED ACTIONS</h4><ul>${sc.recs.map(r => `<li>${r}</li>`).join('')}</ul><h4>EVIDENCE</h4><div>${chips(sc.src) || 'General clinical reference ranges.'}</div>`;
    $('#modal').classList.remove('hidden');
  };
  $('#modalX').onclick = () => $('#modal').classList.add('hidden');
  $('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').classList.add('hidden'); };
  addEventListener('keydown', e => {
    if (['SELECT', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'm' || e.key === 'M') setMode(state.mode === 'scan' ? 'astronaut' : 'scan');
    const n = +e.key; if (n >= 1 && n <= SCENARIOS.length) setScenario(n - 1);
    if (e.key === 'Escape') $$('.modal').forEach(m => m.classList.add('hidden'));
  });
  applySettings();

  // waves
  $$('.vrow').forEach(row => {
    const k = row.dataset.k, cv = row.querySelector('canvas');
    regWave(cv, (w, t) => {
      const s = vitalStatus()[k], c = COL[s], v = state.v, sc = scen();
      if (k === 'hr') drawWave(w, t, c, tt => ecg(tt, v.hr, sc.irregular), { gain: 0.55, mid: 0.7, span: 3.5 });
      if (k === 'spo2') drawWave(w, t, c, tt => pleth(tt, v.hr, v.spo2 < 92 ? 0.55 : 1), { gain: 0.6, mid: 0.78, span: 4 });
      if (k === 'temp') drawWave(w, t, c, tt => 0.04 * Math.sin(tt * 0.35) + 0.02 * Math.sin(tt * 1.1 + 1), { gain: 0.5, mid: 0.5, span: 20 });
      if (k === 'bp') drawWave(w, t, c, tt => { const x = (tt * v.hr / 60) % 1; return (x < 0.15 ? x / 0.15 : Math.exp(-(x - 0.15) * 4.5)) * 0.9 + 0.12 * Math.exp(-((x - 0.38) ** 2) / 0.002); }, { gain: 0.55, mid: 0.8, span: 3.5 });
      if (k === 'rr') drawWave(w, t, c, tt => Math.sin(tt * Math.PI * 2 * v.rr / 60) * 0.45, { gain: 0.5, mid: 0.5, span: 12 });
    });
  });
  regWave($('#neuralWave'), (w, t) => drawWave(w, t, '#39c6ff', tt => Math.sin(tt * 9) * 0.25 + Math.sin(tt * 23 + 1) * 0.15 + (hash(Math.floor(tt * 30)) - 0.5) * 0.35, { gain: 0.6, mid: 0.5, span: 3 }));
  regWave($('#bioWave'), (w, t) => drawWave(w, t, scen().id === 'radiation' ? '#ffb020' : '#39c6ff', tt => Math.sin(tt * 2.1) * 0.3 + Math.sin(tt * 5.3) * 0.15 + (scen().id === 'radiation' ? Math.sin(tt * 13) * 0.25 : 0), { gain: 0.6, mid: 0.5, span: 6 }));
  let trendSrc = 'mission';
  $$('#trendSrc button').forEach(b => b.onclick = () => {
    trendSrc = b.dataset.src; $$('#trendSrc button').forEach(x => x.classList.toggle('on', x === b));
    const mine = trendSrc === 'mine';
    $('#trendTitle').textContent = mine ? 'MY VITAL TRENDS · SAVED READINGS' : 'VITAL TRENDS · LAST 60 s';
    $('#trendTag').textContent = mine ? 'YOUR DATA' : 'SIMULATED'; $('#trendTag').classList.toggle('mine', mine);
  });
  const MINE_KEY = { hr: 'heart_rate_bpm', spo2: 'spo2_percent', temp: 'body_temp_c', rr: 'respiratory_rate_bpm', sys: null };
  $$('.trend').forEach(tr => {
    const k = tr.dataset.k, r = RANGES[k];
    regWave(tr.querySelector('canvas'), (w) => {
      if (trendSrc === 'mine') {
        const hist = lsGet('beyond-horizons:vitals-history', []), mk = MINE_KEY[k];
        const arr = mk ? hist.map(x => x.entry?.[mk]).filter(v => typeof v === 'number') : [];
        const b = tr.querySelector('b');
        if (!arr.length) { b.innerHTML = `<small>${mk ? 'no readings yet' : 'not recorded in My Vitals'}</small>`; b.style.color = 'var(--dim)'; const { ctx, c } = w; ctx.clearRect(0, 0, c.width, c.height); return; }
        const lastM = arr[arr.length - 1], sm = classify(lastM, r);
        b.innerHTML = (k === 'temp' ? lastM.toFixed(1) : Math.round(lastM)) + ' ' + r.unit + `<small>${arr.length} reading${arr.length > 1 ? 's' : ''}</small>`; b.style.color = sm === 'ok' ? '#fff' : COL[sm];
        drawTrend(w, arr.length === 1 ? [arr[0], arr[0]] : arr, COL[sm], r, true);
        return;
      }
      const arr = state.hist[k], last = arr[arr.length - 1] ?? 0;
      const s = classify(last, r);
      tr.querySelector('b').textContent = (k === 'temp' ? last.toFixed(1) : Math.round(last)) + ' ' + r.unit;
      tr.querySelector('b').style.color = s === 'ok' ? '#fff' : COL[s];
      drawTrend(w, arr, COL[s], r);
    });
  });
}

/* ============================================================
   SIMULATION TICK
   ============================================================ */
state.envJit = {};
function simTick(dt) {
  const tv = targetV(), te = targetE();
  const k = Math.min(1, dt * 0.9);
  for (const key of Object.keys(tv)) {
    const noise = { hr: 0.35, spo2: 0.03, temp: 0.004, sys: 0.25, dia: 0.2, rr: 0.05 }[key] || 0;
    state.v[key] += (tv[key] - state.v[key]) * k + (Math.random() - 0.5) * noise * dt * 4;
  }
  if (scen().irregular) state.v.hr += (Math.random() - 0.5) * 3 * dt * 4;
  state.v.spo2 = Math.min(100, state.v.spo2);
  for (const key of Object.keys(te)) {
    state.e[key] += (te[key] - state.e[key]) * k * 0.7;
    state.envJit[key] = (Math.random() - 0.5) * ({ o2: 0.1, co2: 0.01, press: 0.02, temp: 0.04, rad: 0.004 }[key]);
  }
  state.neural += (scen().neural - state.neural) * k + (Math.random() - 0.5) * 0.2;
}
let histAcc = 0, uiAcc = 0;
function recordHist(dt) {
  histAcc += dt; if (histAcc < 0.25) return; histAcc = 0;
  const v = state.v, h = state.hist;
  for (const [k, val] of [['hr', v.hr], ['spo2', v.spo2], ['temp', v.temp], ['sys', v.sys], ['rr', v.rr]]) { h[k].push(val); if (h[k].length > 240) h[k].shift(); }
}
const pad = n => String(n).padStart(2, '0');
const hms = s => `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(Math.floor(s) % 60)}`;
function clockTick() {
  const d = new Date();
  $('#clock').textContent = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
  const el = (performance.now() - state.clock0) / 1000;
  $('#mElapsed').textContent = hms(CONFIG.startElapsed + el);
  $('#mNext').textContent = '+ ' + hms(Math.max(0, CONFIG.startNextCheckpoint - el));
  $('#neuralVal').textContent = state.neural.toFixed(1) + '%';
}

/* ============================================================
   MAIN LOOP
   ============================================================ */
let last = performance.now(), waveAcc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const t = (now - state.t0) / 1000;
  holoTime.value = t;
  simTick(dt); recordHist(dt); msTick(dt);
  uiAcc += dt; if (uiAcc > 1.0) { uiAcc = 0; updateVitalsUI(); updateEnvUI(); updateStatusUI(); clockTick(); }
  if (state.mode === 'astronaut') { state.scanProg += dt * 0.004; if (state.scanProg > 1) state.scanProg = 0; }
  waveAcc += dt; if (waveAcc > 1 / 30) { waveAcc = 0; for (const w of waves) if (w.c.offsetParent) w.fn(w, t); }

  if (holoCanvas.style.display !== 'none' && holo.r) {
    holo.mixer?.update(dt);
    if (holo.heart) { const ph = (holoTime.value * state.v.hr / 60) % 1, k = 1 + 0.06 * Math.exp(-((ph - 0.1) ** 2) / 0.004) + 0.03 * Math.exp(-((ph - 0.35) ** 2) / 0.006);
      holo.heart.scale.setScalar(k); holo.heart.position.set(0.023 * (1 - k), 1.29 * (1 - k), 0.025 * (1 - k)); }
    if (anatMats.heart) { const u = anatMats.heart.userData.u; u.uPulseSpeed.value = state.v.hr / 60 * Math.PI * 2; if (u.uPulse.value < 0.5) u.uPulse.value = 0.5; }
    updateModeVisuals(dt);
    holo.spinA.rotation.z = t * 0.25; holo.spinB.rotation.z = -t * 0.4;
    holo.parts.rotation.y = t * 0.05;
    const tg = holo.ctl.target; tg.x = THREE.MathUtils.clamp(tg.x, -1.2, 1.2); tg.y = THREE.MathUtils.clamp(tg.y, 0.2, 3.0); tg.z = THREE.MathUtils.clamp(tg.z, -1, 1);
    holo.ctl.update();
    if (holo.composer) holo.composer.render(); else holo.r.render(holo.scene, holo.cam);
    updateMarkers();
  } else updateMarkers();
  renderMini(t);
}

/* ============================================================
   BOOT
   ============================================================ */
async function boot() {
  // prefill 60 s of trend history around baseline so charts aren't empty on first view
  for (let i = 0; i < 240; i++) { const n = () => Math.random() - 0.5;
    state.hist.hr.push(72 + n() * 3); state.hist.spo2.push(98 + n() * 0.6); state.hist.temp.push(36.6 + n() * 0.08); state.hist.sys.push(118 + n() * 3); state.hist.rr.push(16 + n()); }
  buildStatic();
  initHolo(); initMini();
  layout(); addEventListener('resize', layout);
  setLoad();
  await Promise.all(MODEL_LIST.map(load));
  computeIssPath();
  setupAstronaut();
  // measure anatomy top (world) for the scan sweep
  if (holo.anat) { holo.anat.visible = true; holo.astro.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(holo.anat); holo.anatTop = b.max.y; holo.anat.visible = false; }
  setupMiniViews();
  initResearch({ registerSelfVitals, applySelfVitals, hudSummary, goTab });
  initGeneSim().then(() => initMission());
  applyOrganStatus(); updateStatusUI(); updateVitalsUI(); updateEnvUI(); updateScanList(); clockTick();
  layout();
  if (qs.get('mode') === 'scan') setMode('scan');
  if (qs.has('s')) setScenario(+qs.get('s'));
  if (qs.has('tab')) goTab(qs.get('tab'));
  document.getElementById('loader').classList.add('done');
  if (!lsGet('beyond-horizons:seen-guide', false) && !qs.has('tab') && !qs.has('mode')) { $('#helpModal').classList.remove('hidden'); lsSet('beyond-horizons:seen-guide', true); }
  requestAnimationFrame(loop);
  window.__bh = { holo, state, models, CONFIG, setMode, setScenario };
  setTimeout(() => { document.documentElement.dataset.ready = '1'; }, 1500);
}
boot();
