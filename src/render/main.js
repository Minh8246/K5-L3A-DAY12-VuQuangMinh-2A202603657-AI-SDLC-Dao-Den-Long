// Lớp hiển thị Three.js + chuỗi 3 Đêm, tạm dừng, cài đặt, âm thanh, HUD (Ticket-02 Phần 3).
// Không có luật gameplay ở đây — mọi luật nằm trong src/core/sim.js; input gửi đúng định dạng contract.
// Sáng tạo (chỉ hiển thị): đom đóm đang mang bay quanh nón lá, vòng sáng vùng an toàn, cột tiến độ nạp đèn.
import * as THREE from 'three';
import { createGame, step, shadeState, capacityOf } from '../core/sim.js';
import { TUNING, WORLD } from '../core/tuning.js';
import { MAPS } from '../core/maps.js';
import { initAudio, setVolume, sfx } from './audio.js';
import { createBenchGame, benchCamera, benchStats, BENCH } from '../core/bench.js';
import { sortLeaderboard, addEntry, isValidName, isoWithOffset } from '../leaderboard.js';

const $ = (id) => document.getElementById(id);
// Bảng màu chuẩn Ticket-02
const C = {
  sky: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  lampOn: 0xffb347, lampCore: 0xffe9b0, lampOff: 0x5b5f6e, moteCore: 0xfff6c2, moteHalo: 0xffe58a,
  shadeBody: 0x120a1a, shadeEdge: 0x7a3cff, shadeStun: 0x3a3450, robe: 0xe8e2d0, scarf: 0xc8102e,
  gold: 0xf2c14e, drifter: 0x8fa3b8,
};
const INTRO = {
  1: 'Ông Đăng: "Đêm nay sương đen kéo về Đảo Bến. Con gom đom đóm, thắp lại năm ngọn đèn trước khi gà gáy nhé."',
  2: 'Ông Đăng: "Đảo Cau có hai mỏm nối bằng cầu tre. Bục đá sẽ bắn con qua biển mây. Coi chừng Gió Lạc — chúng thích cướp ánh sáng."',
  3: 'Ông Đăng: "Đảo Chuông cao ba tầng, gió thổi mạnh từng cơn. Ngọn đèn trên đỉnh cạnh tháp chuông là ngọn khó nhất."',
};

// ---------- Cài đặt (lưu localStorage) ----------
// Ticket-04 §4: đổi phím cho mọi hành động (được lưu, có "Khôi phục mặc định")
const DEFAULT_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyF', pause: 'Escape' };
const ACTION_NAMES = { up: 'Đi tới', down: 'Đi lùi', left: 'Sang trái', right: 'Sang phải', jump: 'Nhảy', dash: 'Lướt', interact: 'Tương tác (nạp/châm dầu)', pulse: 'Tỏa sáng', pause: 'Tạm dừng' };
const settings = { volume: 0.6, sens: 0.3, cb: false, reduce: false, big: false, keys: { ...DEFAULT_KEYS } }; // cb = "Bảng màu dễ phân biệt" (Ticket-03 §6)
const edgeColor = () => (settings.cb ? 0x00b3ff : C.shadeEdge);
const applyCb = () => document.documentElement.style.setProperty('--danger', settings.cb ? '#ffffff' : '#ff5a5f');
const applyA11y = () => {
  document.documentElement.style.setProperty('--scale', settings.big ? '1.25' : '1');
  document.documentElement.classList.toggle('reduce', !!settings.reduce);
};
const keyName = (code) => (code || '—').replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift').replace('ShiftRight', 'Shift phải').replace('Escape', 'Esc').replace('Space', 'Space');
try {
  Object.assign(settings, JSON.parse(localStorage.getItem('ddl-settings') || '{}'));
} catch {}
const saveSettings = () => {
  try {
    localStorage.setItem('ddl-settings', JSON.stringify(settings));
  } catch {}
};
settings.keys = { ...DEFAULT_KEYS, ...(settings.keys || {}) };
setVolume(settings.volume);
applyCb();
applyA11y();

// ---------- Scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.sky);
scene.fog = new THREE.Fog(C.fog, 25, 90);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
const ambient = new THREE.AmbientLight(0xb8b0ff, 0.15);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0xb8b0ff, 0.35);
moon.position.set(-20, 40, -10);
scene.add(moon);
const sea = new THREE.Mesh(new THREE.CircleGeometry(300, 48), new THREE.MeshStandardMaterial({ color: C.sea, roughness: 1 }));
sea.rotation.x = -Math.PI / 2;
sea.position.y = -6;
scene.add(sea);

let world = new THREE.Group();
scene.add(world);
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 1, ...extra });

function buildTerrain(map) {
  scene.remove(world);
  world = new THREE.Group();
  scene.add(world);
  const disk = (r, x, z, y0, y1, color) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, y1 - y0 + 3, 64), mat(color));
    m.position.set(x, (y0 + y1) / 2 - 1.5, z);
    world.add(m);
    const rim = new THREE.Mesh(new THREE.RingGeometry(r - 1.2, r, 64), mat(C.sand, { side: THREE.DoubleSide }));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(x, y1 + 0.02, z);
    world.add(rim);
  };
  if (map.night === 1) disk(40, 0, 0, 0, 0, C.grass);
  if (map.night === 2) {
    disk(28, 0, 0, 0, 0, C.grass);
    disk(28, 70, 0, 0, 0, C.grass);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), mat(C.wood));
    bridge.position.set(35, -0.15, 0);
    world.add(bridge);
  }
  if (map.night === 3) {
    disk(45, 0, 0, 0, 0, C.grass);
    // tầng 1: nửa vành khăn 12–24 m ở phía z > 0, cao 3 m
    const sh = new THREE.Shape();
    sh.absarc(0, 0, 24, 0, -Math.PI, true);
    sh.lineTo(-12, 0);
    sh.absarc(0, 0, 12, -Math.PI, 0, false);
    const t1 = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false, curveSegments: 32 }), mat(0x3a6b5c));
    t1.rotation.x = -Math.PI / 2;
    world.add(t1);
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), mat(0x467a69));
    t2.position.y = 3;
    world.add(t2);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 24), mat(C.wood));
    tower.position.y = 10;
    world.add(tower);
    const bell = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.8, 24, 1, true), mat(C.gold, { side: THREE.DoubleSide, emissive: 0x332200 }));
    bell.position.y = 15;
    world.add(bell);
    for (const deg of [30, 150]) {
      const a = (deg * Math.PI) / 180;
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, Math.hypot(6, 3)), mat(C.sand));
      ramp.position.set(27 * Math.cos(a), 1.5, 27 * Math.sin(a));
      ramp.lookAt(24 * Math.cos(a), 3, 24 * Math.sin(a));
      world.add(ramp);
    }
  }
  for (const pad of map.pads) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.2, 24), mat(C.gold, { emissive: 0x664400 }));
    m.position.set(pad.pos[0], pad.pos[1] + 0.1, pad.pos[2]);
    world.add(m);
  }
}

// ---------- Nhân vật & thực thể ----------
function makePlayer() {
  const g = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 1.0, 16), mat(C.robe));
  robe.position.y = 0.5;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 8, 16), mat(C.scarf));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.02;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), mat(0xf2d0b0));
  head.position.y = 1.25;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.38, 24), mat(C.sand));
  hat.position.y = 1.55;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), mat(C.lampOn, { emissive: C.lampOn, emissiveIntensity: 2 }));
  lamp.position.set(0.65, 1.2, 0);
  const glow = new THREE.PointLight(C.lampOn, 1.6, 9, 1.5);
  glow.position.copy(lamp.position);
  g.add(robe, scarf, head, hat, lamp, glow);
  return g;
}
const playerMesh = makePlayer();
scene.add(playerMesh);

const views = { lanterns: new Map(), motes: new Map(), shades: new Map(), drifters: new Map(), charms: new Map() };
const moteGeo = new THREE.SphereGeometry(0.12, 10, 8);
const moteMat = mat(C.moteCore, { emissive: C.moteCore, emissiveIntensity: 2 });
const haloMat = new THREE.MeshBasicMaterial({ color: C.moteHalo, transparent: true, opacity: 0.35 });
const haloGeo = new THREE.SphereGeometry(0.28, 10, 8);

function makeMote() {
  const m = new THREE.Mesh(moteGeo, moteMat);
  m.add(new THREE.Mesh(haloGeo, haloMat));
  return m;
}
function makeLantern() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3, 10), mat(C.wood));
  post.position.y = 1.5;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.8, 12), mat(C.lampOff));
  body.position.y = 3.3;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: C.lampOff }));
  core.position.y = 3.3;
  const light = new THREE.PointLight(C.lampOn, 0, 24, 1.2);
  light.position.y = 3.3;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(TUNING.safe_radius - 0.15, TUNING.safe_radius, 64),
    new THREE.MeshBasicMaterial({ color: C.lampOn, transparent: true, opacity: 0, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 8), new THREE.MeshBasicMaterial({ color: C.lampCore }));
  fill.position.x = 0.2;
  g.add(post, body, core, light, ring, fill);
  return { g, body, core, light, ring, fill };
}
function makeShade() {
  const g = new THREE.Group();
  const m = mat(C.shadeBody, { emissive: edgeColor(), emissiveIntensity: 0.25, transparent: true, opacity: 0.92 });
  const blob = new THREE.Mesh(new THREE.SphereGeometry(0.8, 18, 14), m);
  const edge = new THREE.Mesh(new THREE.SphereGeometry(0.86, 18, 14), new THREE.MeshBasicMaterial({ color: edgeColor(), wireframe: true, transparent: true, opacity: 0.25 }));
  const eyeMat = new THREE.MeshBasicMaterial({ color: edgeColor() });
  for (const x of [-0.25, 0.25]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), eyeMat);
    eye.position.set(x, 0.15, 0.7);
    blob.add(eye);
  }
  g.add(blob, edge);
  return { g, blob, m, edge, eyeMat };
}
function makeDrifter() {
  const g = new THREE.Group();
  const ribbon = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.5, 0.06, 64, 6, 2, 3),
    new THREE.MeshStandardMaterial({ color: C.drifter, emissive: C.drifter, emissiveIntensity: 0.3, transparent: true, opacity: 0.85 }),
  );
  g.add(ribbon);
  return { g, ribbon };
}
function makeCharm() {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.05), mat(C.scarf, { emissive: 0x440000 }));
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.03), mat(C.gold, { emissive: 0x443300 }));
  paper.position.y = border.position.y = 1;
  g.add(border, paper);
  return { g };
}
const MAX_SHADES = 256;
const MAX_MOTES = 160;
const dyn = (m) => {
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  m.count = 0;
  scene.add(m);
  return m;
};
const shadeBodyMat = mat(0xffffff, { emissive: C.shadeEdge, emissiveIntensity: 0.25, transparent: true, opacity: 0.92 });
const shadeEdgeMat = new THREE.MeshBasicMaterial({ color: C.shadeEdge, wireframe: true, transparent: true, opacity: 0.25 });
const shadeEyeMat = new THREE.MeshBasicMaterial({ color: C.shadeEdge });
const shadeInst = dyn(new THREE.InstancedMesh(new THREE.SphereGeometry(0.8, 18, 14), shadeBodyMat, MAX_SHADES));
const shadeEdgeInst = dyn(new THREE.InstancedMesh(new THREE.SphereGeometry(0.86, 18, 14), shadeEdgeMat, MAX_SHADES));
const eyeInst = dyn(new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), shadeEyeMat, MAX_SHADES * 2));
const moteInst = dyn(new THREE.InstancedMesh(moteGeo, moteMat, MAX_MOTES));
const haloInst = dyn(new THREE.InstancedMesh(haloGeo, haloMat, MAX_MOTES));
const dummy = new THREE.Object3D();
const eyeDummy = new THREE.Object3D();
const EYES = [new THREE.Vector3(-0.25, 0.15, 0.7), new THREE.Vector3(0.25, 0.15, 0.7)];
const tmpV = new THREE.Vector3();
const COL_BODY = new THREE.Color(C.shadeBody);
const COL_STUN = new THREE.Color(C.shadeStun);
// Tạo thuộc tính màu theo instance TRƯỚC lần render đầu để shader được biên dịch có màu instance
for (let i = 0; i < MAX_SHADES; i++) shadeInst.setColorAt(i, COL_BODY);
shadeInst.instanceColor.setUsage(THREE.DynamicDrawUsage);

const carriedViews = Array.from({ length: TUNING.carry_capacity }, () => {
  const m = makeMote();
  m.visible = false;
  scene.add(m);
  return m;
});
const pulseRing = new THREE.Mesh(
  new THREE.RingGeometry(0.9, 1, 64),
  new THREE.MeshBasicMaterial({ color: C.lampCore, transparent: true, opacity: 0, side: THREE.DoubleSide }),
);
pulseRing.rotation.x = -Math.PI / 2;
scene.add(pulseRing);
let pulseFx = 0;
const leaves = Array.from({ length: 40 }, () => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.15), new THREE.MeshBasicMaterial({ color: 0x9bbf6a, side: THREE.DoubleSide }));
  m.visible = false;
  scene.add(m);
  return m;
});

function clearViews() {
  for (const map of Object.values(views)) {
    for (const v of map.values()) scene.remove(v.g ?? v);
    map.clear();
  }
}

// ---------- Input ----------
const keys = new Set();
let camYaw = 0;
let dragging = false;
let lastX = 0;
let pausePulse = false;
let capturing = null; // hành động đang chờ người dùng nhấn phím mới
addEventListener('keydown', (e) => {
  if (capturing) {
    e.preventDefault();
    settings.keys[capturing] = e.code;
    capturing = null;
    saveSettings();
    renderKeys();
    return;
  }
  keys.add(e.code);
  if (e.code === 'Space') e.preventDefault();
  const isPause = e.code === settings.keys.pause || (e.code === 'KeyP' && !Object.values(settings.keys).includes('KeyP'));
  if (isPause && (screen === 'play' || screen === 'pause')) togglePause();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
renderer.domElement.addEventListener('mousedown', (e) => {
  dragging = true;
  lastX = e.clientX;
});
addEventListener('mouseup', () => (dragging = false));
addEventListener('mousemove', (e) => {
  if (!dragging) return;
  camYaw -= (e.clientX - lastX) * settings.sens;
  lastX = e.clientX;
});
function readInput() {
  const k = (a) => keys.has(settings.keys[a]);
  const x = (k('left') ? 1 : 0) - (k('right') ? 1 : 0); // camera nhìn +Z khi yaw 0 → phải màn hình là −X
  const z = (k('up') ? 1 : 0) - (k('down') ? 1 : 0);
  return { move: [x, z], cam_yaw_deg: camYaw, jump: k('jump'), interact: k('interact'), pulse: k('pulse'), dash: k('dash'), pause: pausePulse };
}

// ---------- Chuỗi màn hình ----------
let screen = 'menu';
let game = null;
let night = 1;
let totalScore = 0;
let nightsWon = 0;
let runSeed = 1;
let prevSettingsScreen = 'menu';
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id);
  $('hud').style.display = screen === 'play' || screen === 'pause' ? 'block' : 'none';
}
function goMenu() {
  screen = 'menu';
  totalScore = 0;
  night = 1;
  show('scr-menu');
}
function goIntro(n) {
  night = n;
  screen = 'intro';
  $('intro-title').textContent = `Đêm ${n} — ${MAPS[n].name}`;
  $('intro-text').textContent = INTRO[n];
  show('scr-intro');
}
function startNight() {
  initAudio();
  clearViews();
  game = createGame({ seed: runSeed + night, night });
  lowFuelSeen.clear();
  tenSecShown = false;
  buildTerrain(game.map);
  camYaw = 0;
  lastSecond = null;
  screen = 'play';
  show(null);
}
function togglePause() {
  pausePulse = true; // gửi cạnh lên của nút pause cho core ở bước kế tiếp
}
function onGameOver({ result }) {
  screen = 'result';
  if (result === 'won') {
    totalScore += game.score;
    nightsWon++;
    sfx.win();
    if (night === 3) {
      screen = 'dawn';
      $('dawn-score').textContent = totalScore;
      return show('scr-dawn');
    }
  } else sfx.lose();
  const why = { dawn_survived: 'Bình minh lên, đảo vẫn sáng!', no_flames: 'Mây đã hết Ngọn Lửa…', dawn: 'Bình minh tới mà đảo chưa đủ đèn sáng…' };
  $('res-title').textContent = result === 'won' ? `Thắng Đêm ${night}!` : `Thua Đêm ${night}`;
  $('res-text').innerHTML = `${why[game.reason]}<br>Điểm Đêm này: <b>${game.score}</b> · Tổng (các Đêm đã thắng): <b>${totalScore}</b>`;
  $('btn-next').style.display = result === 'won' ? 'block' : 'none';
  $('btn-save1').style.display = result === 'won' ? 'none' : 'block'; // thua ở bất kỳ Đêm nào → được lưu điểm
  show('scr-result');
}

// ---------- Bảng xếp hạng (Ticket-04 §3): desktop lưu file qua Electron, web dùng localStorage ----------
const LB_KEY = 'ddl-leaderboard';
const sortLb = sortLeaderboard;
async function lbGet() {
  if (window.ddl && window.ddl.lbGet) return window.ddl.lbGet();
  try {
    return sortLb(JSON.parse(localStorage.getItem(LB_KEY) || '[]'));
  } catch {
    return [];
  }
}
async function lbAdd(entry) {
  if (window.ddl && window.ddl.lbAdd) return window.ddl.lbAdd(entry);
  const all = addEntry(await lbGet(), entry);
  try {
    localStorage.setItem(LB_KEY, JSON.stringify(all));
  } catch {}
  return all;
}
function openNameEntry() {
  $('name-score').textContent = totalScore;
  $('name-nights').textContent = nightsWon;
  $('name-input').value = '';
  $('name-err').textContent = '';
  screen = 'name';
  show('scr-name');
  $('name-input').focus();
}
$('btn-name-ok').onclick = async () => {
  const name = $('name-input').value.normalize('NFC').trim();
  if (!isValidName(name)) {
    $('name-err').textContent = '⚠ Tên cần 3–12 ký tự, chỉ gồm chữ, số hoặc _';
    return;
  }
  await lbAdd({ name, score: totalScore, nights_won: nightsWon, achieved_at: isoWithOffset(new Date()), seed: runSeed });
  openBoard();
};
$('btn-name-cancel').onclick = () => goMenu();
async function openBoard() {
  const rows = await lbGet();
  $('board-rows').innerHTML = rows.length
    ? rows.map((r, i) => `<tr><td>${i + 1}</td><td>${r.name.replace(/[<>&]/g, '')}</td><td>${r.score}</td><td>${r.nights_won}</td><td>${r.achieved_at.slice(0, 10)}</td></tr>`).join('')
    : '<tr><td colspan="5">Chưa có điểm nào</td></tr>';
  screen = 'board';
  show('scr-board');
}
$('btn-board').onclick = openBoard;
$('btn-board-back').onclick = () => goMenu();
$('btn-save1').onclick = openNameEntry;
$('btn-save2').onclick = openNameEntry;

$('btn-start').onclick = () => {
  totalScore = 0;
  nightsWon = 0;
  runSeed = (Date.now() % 1e9) | 0;
  goIntro(1);
};
$('btn-go').onclick = startNight;
$('btn-next').onclick = () => goIntro(night + 1);
$('btn-retry').onclick = () => goIntro(night);
$('btn-menu1').onclick = $('btn-menu2').onclick = $('btn-menu3').onclick = goMenu;
$('btn-resume').onclick = () => togglePause();
$('btn-restart').onclick = () => startNight();
const openSettings = (from) => {
  prevSettingsScreen = from;
  $('set-vol').value = settings.volume;
  $('set-sens').value = settings.sens;
  $('set-cb').checked = !!settings.cb;
  $('set-reduce').checked = !!settings.reduce;
  $('set-big').checked = !!settings.big;
  renderKeys();
  show('scr-settings');
};
$('btn-settings').onclick = () => openSettings('scr-menu');
$('btn-settings2').onclick = () => openSettings('scr-pause');
$('set-vol').oninput = (e) => {
  settings.volume = Number(e.target.value);
  setVolume(settings.volume);
  saveSettings();
};
$('set-sens').oninput = (e) => {
  settings.sens = Number(e.target.value);
  saveSettings();
};
$('set-cb').onchange = (e) => {
  settings.cb = e.target.checked;
  applyCb();
  saveSettings();
};
$('set-reduce').onchange = (e) => {
  settings.reduce = e.target.checked;
  applyA11y();
  saveSettings();
};
$('set-big').onchange = (e) => {
  settings.big = e.target.checked;
  applyA11y();
  saveSettings();
};
function renderKeys() {
  const counts = {};
  for (const c of Object.values(settings.keys)) counts[c] = (counts[c] || 0) + 1;
  $('keys').innerHTML = Object.keys(DEFAULT_KEYS)
    .map((a) => `<span>${ACTION_NAMES[a]}</span><button data-act="${a}" class="${counts[settings.keys[a]] > 1 ? 'dup' : ''}">${capturing === a ? 'Nhấn phím…' : keyName(settings.keys[a])}</button>`)
    .join('');
  for (const b of $('keys').querySelectorAll('button')) {
    b.onclick = () => {
      capturing = b.dataset.act;
      renderKeys();
    };
  }
  const dups = Object.keys(counts).filter((c) => counts[c] > 1);
  $('key-warn').textContent = dups.length
    ? '⚠ Trùng phím: ' + dups.map((c) => `${keyName(c)} (${Object.keys(settings.keys).filter((a) => settings.keys[a] === c).map((a) => ACTION_NAMES[a]).join(', ')})`).join('; ')
    : '';
  $('lbl-dash').innerHTML = `Lướt<br>${keyName(settings.keys.dash)}`;
  $('lbl-pulse').innerHTML = `Tỏa sáng<br>${keyName(settings.keys.pulse)}`;
  $('menu-keys').textContent = `${['up', 'left', 'down', 'right'].map((a) => keyName(settings.keys[a])).join('')} đi · Chuột kéo / ← → xoay · ${keyName(settings.keys.jump)} nhảy · ${keyName(settings.keys.dash)} lướt · ${keyName(settings.keys.interact)} nạp/châm dầu · ${keyName(settings.keys.pulse)} tỏa sáng · ${keyName(settings.keys.pause)}/P tạm dừng`;
}
$('btn-keys-reset').onclick = () => {
  settings.keys = { ...DEFAULT_KEYS };
  saveSettings();
  renderKeys();
};
$('btn-set-back').onclick = () => {
  capturing = null;
  show(prevSettingsScreen);
};
renderKeys();

// ---------- Vòng lặp ----------
const clock = new THREE.Clock();
let acc = 0;
const DT = 1 / WORLD.tick_rate;
let lastSecond = null;
let fpsFrames = 0;
let fpsTime = 0;
window.__fps = [];

// Phụ đề / chỉ báo hình ảnh (Ticket-04 §4)
const lowFuelSeen = new Set();
let tenSecShown = false;
let shadeArrowTarget = null;
let shake = 0;
function caption(text, ms = 2600) {
  const el = document.createElement('div');
  el.className = 'cap';
  el.textContent = text;
  $('captions').appendChild(el);
  setTimeout(() => el.remove(), ms);
}
function handleEvents(events) {
  for (const e of events) {
    if (e.name === 'mote_picked') sfx.pick();
    if (e.name === 'lantern_lit') sfx.lantern();
    if (e.name === 'pulse') {
      pulseFx = 1;
      sfx.pulse();
    }
    if (e.name === 'dash') sfx.dash();
    if (e.name === 'shade_spawned') {
      sfx.shade();
      caption('⚠ Bóng Mực xuất hiện!');
      shadeArrowTarget = { id: e.data.id, until: clock.elapsedTime + 3 };
    }
    if (e.name === 'lantern_out') caption(`🏮 Đèn ${e.data.lantern_id} đã tắt`);
    if (e.name === 'player_hit' || e.name === 'drifter_steal') {
      sfx.hit();
      if (!settings.reduce) {
        // giảm chuyển động: tắt chớp màn hình và rung camera
        $('flash').style.boxShadow = 'inset 0 0 160px 60px rgba(122, 60, 255, 0.8)';
        setTimeout(() => ($('flash').style.boxShadow = 'inset 0 0 160px 40px rgba(122, 60, 255, 0)'), 250);
        shake = 0.3;
      }
    }
    if (e.name === 'paused') {
      screen = 'pause';
      show('scr-pause');
    }
    if (e.name === 'resumed') {
      screen = 'play';
      show(null);
    }
    if (e.name === 'game_over') onGameOver(e.data);
  }
}

// ---------- Cảnh benchmark (Ticket-04 §1) ----------
let benchMode = false;
let bench = null;
let benchT = 0;
const BENCH_INPUT = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
function startBench(seed, duration) {
  benchMode = true;
  renderer.setPixelRatio(1); // render đúng kích thước cửa sổ 1280×720
  renderer.setSize(innerWidth, innerHeight);
  screen = 'bench';
  show(null);
  $('hud').style.display = 'none';
  $('fps').style.display = 'none';
  clearViews();
  game = createBenchGame(seed);
  buildTerrain(game.map);
  bench = { duration, t0: null, last: 0, dts: [], measuring: false, mStart: 0, done: false, firstSent: false };
}
function gpuName() {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
}
function benchFrame() {
  const now = performance.now();
  if (bench.t0 === null) {
    bench.t0 = now;
    bench.last = now;
  }
  const dtMs = now - bench.last;
  bench.last = now;
  acc += Math.min(dtMs / 1000, 0.1);
  while (acc >= DT) {
    acc -= DT;
    step(game, BENCH_INPUT);
  }
  benchT = (now - bench.t0) / 1000;
  sync(benchT);
  renderer.render(scene, camera);
  if (!bench.firstSent) {
    bench.firstSent = true;
    if (window.ddl) window.ddl.benchFirstFrame();
  }
  if (benchT < BENCH.warmupS || bench.done) return; // 3 s khởi động không đo
  if (!bench.measuring) {
    bench.measuring = true;
    bench.mStart = now;
    if (window.ddl) window.ddl.benchMeasureStart();
    return;
  }
  bench.dts.push(dtMs);
  if ((now - bench.mStart) / 1000 >= bench.duration) {
    bench.done = true;
    const r = { ...benchStats(bench.dts), gpu: gpuName(), three: THREE.REVISION };
    window.__bench = r;
    console.log('BENCH', JSON.stringify(r));
    if (window.ddl) window.ddl.benchDone(r);
  }
}

function frame() {
  requestAnimationFrame(frame);
  if (benchMode) return benchFrame();
  const dt = Math.min(clock.getDelta(), 0.1);
  fpsFrames++;
  fpsTime += dt;
  if (fpsTime >= 1) {
    window.__fps.push(fpsFrames / fpsTime);
    $('fps').textContent = `${Math.round(fpsFrames / fpsTime)} FPS`;
    fpsFrames = 0;
    fpsTime = 0;
  }
  if (game && (screen === 'play' || screen === 'pause')) {
    const turn = (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0);
    if (screen === 'play') camYaw += turn * 120 * dt;
    acc += dt;
    while (acc >= DT) {
      acc -= DT;
      if (game.state !== 'playing') break;
      const wasGrounded = game.player.grounded;
      const inp = readInput();
      handleEvents(step(game, inp));
      pausePulse = false;
      if (wasGrounded && game.player.vel[1] > 5 && !game.paused) sfx.jump();
    }
  } else acc = 0;
  if (game) sync(clock.elapsedTime);
  renderer.render(scene, camera);
}

function syncMap(list, map, make, update) {
  const alive = new Set();
  for (const e of list) {
    alive.add(e.id);
    let v = map.get(e.id);
    if (!v) {
      v = make();
      scene.add(v.g ?? v);
      map.set(e.id, v);
    }
    update(v, e);
  }
  for (const [id, v] of map) {
    if (!alive.has(id)) {
      scene.remove(v.g ?? v);
      map.delete(id);
    }
  }
}

function sync(time) {
  const p = game.player;
  playerMesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
  playerMesh.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  playerMesh.visible = p.fallWaitTicks > 0 ? false : p.invulnTicks > 0 ? Math.floor(time * 12) % 2 === 0 : true;
  if (benchMode) {
    camera.position.set(...benchCamera(benchT));
    camera.lookAt(0, 0, 0);
  } else {
    const th = (camYaw * Math.PI) / 180;
    const fy = Math.max(p.pos[1], -2);
    camera.position.set(p.pos[0] - Math.sin(th) * 9, fy + 5.5, p.pos[2] - Math.cos(th) * 9);
    if (shake > 0 && !settings.reduce) {
      shake = Math.max(0, shake - 1 / 60);
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
    }
    camera.lookAt(p.pos[0], fy + 1.2, p.pos[2]);
  }

  let lit = 0;
  syncMap(game.lanterns, views.lanterns, makeLantern, (v, L) => {
    v.g.position.set(...L.pos);
    // Lit: thanh dầu (fuel/100). Tắt: tiến độ nạp (deposited/cost; thắp lại chỉ cần 5).
    const fuel = L.fuelU / WORLD.fuel_units;
    const cost = L.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
    const frac = L.lit ? fuel / TUNING.fuel_max : Math.min(1, L.deposited / cost);
    const h = 0.01 + 2.4 * frac;
    v.fill.scale.y = h;
    v.fill.position.y = h / 2;
    const low = L.lit && fuel < TUNING.low_fuel_threshold;
    const blinkOff = low && Math.floor(time * 2) % 2 === 1; // nhấp nháy chậm 1 Hz
    v.fill.visible = !blinkOff;
    v.fill.material.color.setHex(L.lit ? (low ? C.lampOn : C.lampCore) : C.gold);
    if (L.lit) {
      lit++;
      v.body.scale.set(1, 1, 1);
      v.body.rotation.z = 0;
      v.body.material.color.setHex(C.lampOn);
      v.body.material.emissive.setHex(blinkOff ? 0x221100 : C.lampOn);
      v.body.material.emissiveIntensity = 1.4 + Math.sin(time * 3 + L.pos[0]) * 0.2;
      v.core.material.color.setHex(blinkOff ? C.lampOff : C.lampCore);
      v.light.intensity = blinkOff ? 0.8 : 3;
      v.ring.material.opacity = low || benchMode ? 0 : 0.35 + Math.sin(time * 2) * 0.1; // fuel < 30: mất vùng an toàn; bench: tắt phần sáng tạo
      if (low && !lowFuelSeen.has(L.id) && !benchMode) {
        lowFuelSeen.add(L.id);
        caption(`🏮 ⚠ Đèn ${L.id} sắp cạn dầu!`);
      }
      if (!low) lowFuelSeen.delete(L.id);
    } else {
      // Đèn tắt: xẹp 20% và nghiêng như giấy rách → phân biệt được không cần màu
      v.body.scale.set(1, 0.8, 1);
      v.body.rotation.z = 0.18;
      v.body.material.color.setHex(C.lampOff);
      v.body.material.emissive.setHex(0);
      v.core.material.color.setHex(C.lampOff);
      v.light.intensity = 0;
      v.ring.material.opacity = 0;
    }
  });
  ambient.intensity = 0.15 + 0.55 * (lit / game.lanterns.length); // công thức chuẩn

  let nm = 0;
  for (const m of game.motes) {
    if (nm >= MAX_MOTES) break;
    if (!(m.kind === 'random' || m.ttl > 120 || Math.floor(time * 8) % 2 === 0)) continue; // đom đóm rơi sắp tan thì nhấp nháy
    dummy.position.set(m.pos[0], m.pos[1] + 0.6 + Math.sin(time * 2 + m.pos[0]) * 0.2, m.pos[2]);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    moteInst.setMatrixAt(nm, dummy.matrix);
    haloInst.setMatrixAt(nm, dummy.matrix);
    nm++;
  }
  moteInst.count = haloInst.count = nm;
  moteInst.instanceMatrix.needsUpdate = haloInst.instanceMatrix.needsUpdate = true;
  carriedViews.forEach((v, i) => {
    v.visible = i < p.carried && p.fallWaitTicks === 0;
    const a = time * 2.2 + (i * 2 * Math.PI) / TUNING.carry_capacity;
    v.position.set(p.pos[0] + Math.cos(a) * 0.9, p.pos[1] + 1.8 + Math.sin(time * 3 + i) * 0.1, p.pos[2] + Math.sin(a) * 0.9);
  });
  const ec = edgeColor();
  shadeBodyMat.emissive.setHex(ec);
  shadeEdgeMat.color.setHex(ec);
  shadeEyeMat.color.setHex(ec);
  let ns = 0;
  for (const sh of game.shades) {
    if (ns >= MAX_SHADES) break;
    const st = shadeState(sh);
    const sc = st === 'spawning' ? Math.max(0.05, 1 - sh.spawnTicks / 60) : st === 'stunned' ? 0.75 : 1 + Math.sin(time * 4 + sh.pos[0]) * 0.05;
    dummy.position.set(sh.pos[0], sh.pos[1], sh.pos[2]);
    dummy.scale.setScalar(1);
    dummy.lookAt(p.pos[0], sh.pos[1], p.pos[2]);
    dummy.scale.setScalar(sc);
    dummy.updateMatrix();
    shadeInst.setMatrixAt(ns, dummy.matrix);
    shadeEdgeInst.setMatrixAt(ns, dummy.matrix);
    shadeInst.setColorAt(ns, st === 'stunned' ? COL_STUN : COL_BODY);
    for (let e = 0; e < 2; e++) {
      tmpV.copy(EYES[e]).multiplyScalar(sc).applyQuaternion(dummy.quaternion).add(dummy.position);
      eyeDummy.position.copy(tmpV);
      eyeDummy.updateMatrix();
      eyeInst.setMatrixAt(ns * 2 + e, eyeDummy.matrix);
    }
    ns++;
  }
  shadeInst.count = shadeEdgeInst.count = ns;
  eyeInst.count = ns * 2;
  shadeInst.instanceMatrix.needsUpdate = shadeEdgeInst.instanceMatrix.needsUpdate = eyeInst.instanceMatrix.needsUpdate = true;
  if (shadeInst.instanceColor) shadeInst.instanceColor.needsUpdate = true;
  syncMap(
    game.drifters.filter((d) => d.state !== 'removed'),
    views.drifters,
    makeDrifter,
    (v, d) => {
      v.g.position.set(...d.pos);
      v.ribbon.rotation.y = time * 3;
      v.ribbon.rotation.x = Math.sin(time * 2) * 0.5;
    },
  );
  syncMap(game.charms, views.charms, makeCharm, (v, c) => {
    v.g.position.set(...c.pos);
    v.g.visible = c.available;
    v.g.rotation.y = time * 1.5;
  });
  if (pulseFx > 0) {
    pulseFx = Math.max(0, pulseFx - 0.04);
    pulseRing.scale.setScalar(Math.max(0.01, TUNING.pulse_radius * (1 - pulseFx)));
    pulseRing.position.set(p.pos[0], p.pos[1] + 0.3, p.pos[2]);
    pulseRing.material.opacity = pulseFx;
  }
  // Gió: lá bay khi gió đang thổi hoặc báo trước 2 s
  const warn = game.windEnabled && game.simTick % WORLD.wind_every >= WORLD.wind_every - 120;
  if (warn && game.simTick % WORLD.wind_every === WORLD.wind_every - 120 && !game.paused) {
    sfx.wind();
    caption('🍃 Gió mạnh sắp thổi!');
  }
  const windDir = game.wind.active ? (game.wind.dirDeg * Math.PI) / 180 : time;
  leaves.forEach((l, i) => {
    l.visible = game.wind.active || warn;
    if (!l.visible) return;
    const u = (time * (game.wind.active ? 6 : 2) + i * 1.7) % 20;
    l.position.set(p.pos[0] + Math.cos(windDir) * (u - 10) + Math.sin(i) * 6, p.pos[1] + 1 + (i % 5) * 0.6, p.pos[2] + Math.sin(windDir) * (u - 10) + Math.cos(i) * 6);
    l.rotation.set(time * 3 + i, time * 2, 0);
  });
  if (!benchMode) updateHud(p);
}

function updateHud(p) {
  const lit = game.lanterns.filter((l) => l.lit).length;
  const t = Math.max(0, game.timeLeftTicks) / WORLD.tick_rate;
  $('hud-tl').textContent = '🔥'.repeat(p.flames) || '—';
  const need = Math.ceil(TUNING.win_ratio * game.lanterns.length - 1e-9);
  $('hud-tc').textContent = `${settings.cb && t <= 30 ? '⚠ ' : ''}${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  $('hud-tc').classList.toggle('danger', t <= 30);
  const sec = Math.ceil(t);
  if (t <= 10 && sec !== lastSecond && screen === 'play') sfx.tick();
  if (t <= 10 && t > 0 && !tenSecShown && screen === 'play') {
    tenSecShown = true;
    caption('⏳ ⚠ Còn 10 giây tới bình minh!', 4000);
  }
  lastSecond = sec;
  $('hud-tr').innerHTML = `Đèn sáng <b>${lit}/${game.lanterns.length}</b> (cần ${need})<br>Điểm <b>${totalScore + game.score}</b>`;
  const cap = capacityOf(p);
  $('hud-bc').innerHTML =
    Array.from({ length: cap }, (_, i) => `<div class="slot ${i < p.carried ? 'on' : ''}"></div>`).join('') +
    `<span style="margin-left:8px;font-size:18px">${p.carried}/${cap}</span>`;
  const dashCd = p.charmTicks > 0 ? 0 : p.dashCdTicks / WORLD.dash_cd_ticks;
  $('cd-dash').firstElementChild.style.height = `${dashCd * 100}%`;
  $('cd-dash').style.borderColor = p.charmTicks > 0 ? '#c8102e' : '#f2c14e';
  $('cd-pulse').firstElementChild.style.height = `${p.carried < TUNING.pulse_cost ? 100 : (p.pulseCdTicks / WORLD.pulse_cd_ticks) * 100}%`;
  let hint = '';
  let nearest = null;
  let nd = Infinity;
  for (const L of game.lanterns) {
    const d = Math.hypot(p.pos[0] - L.pos[0], p.pos[2] - L.pos[2]);
    if (L.lit) {
      if (d <= TUNING.interact_radius && L.fuelU < TUNING.fuel_max * WORLD.fuel_units) hint = `E — Châm dầu (${Math.floor(L.fuelU / WORLD.fuel_units)}/100)`;
      continue;
    }
    if (d <= TUNING.interact_radius) hint = `E — Nạp ánh sáng (${L.deposited}/${L.everLit ? TUNING.relight_cost : TUNING.lantern_cost})`;
    if (d < nd) {
      nd = d;
      nearest = L;
    }
  }
  $('hint').textContent = hint;
  // Mũi tên chỉ đèn chưa sáng gần nhất khi nó ở ngoài màn hình; mũi tên tím chỉ Bóng Mực vừa xuất hiện (3 s)
  placeArrow($('arrow'), nearest && [nearest.pos[0], nearest.pos[1] + 3, nearest.pos[2]]);
  let sp = null;
  if (shadeArrowTarget && clock.elapsedTime < shadeArrowTarget.until) {
    const s = game.shades.find((x) => x.id === shadeArrowTarget.id);
    if (s) sp = s.pos;
  }
  placeArrow($('arrow-shade'), sp, true);
}

function placeArrow(el, pos, always = false) {
  el.style.display = 'none';
  if (!pos) return;
  const v = new THREE.Vector3(...pos).project(camera);
  const behind = v.z > 1;
  if (!always && !behind && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1) return;
  let x = behind ? -v.x : v.x;
  let y = behind ? -v.y : v.y;
  const m = Math.max(Math.abs(x), Math.abs(y)) || 1;
  x = (x / m) * 0.85;
  y = (y / m) * 0.85;
  el.style.display = 'block';
  el.style.left = `${((x + 1) / 2) * innerWidth - 14}px`;
  el.style.top = `${((1 - y) / 2) * innerHeight - 14}px`;
  el.style.transform = `rotate(${Math.atan2(x, y)}rad)`;
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ?night=N&autostart → vào thẳng Đêm N (dùng cho chụp bằng chứng)
const qs = new URLSearchParams(location.search);
if (qs.has('bench')) {
  startBench(Number(qs.get('seed') || 42), Number(qs.get('duration') || 30));
} else if (qs.has('autostart')) {
  runSeed = 1;
  night = Number(qs.get('night') || 1);
  startNight();
} else goMenu();
frame();
