// Lớp hiển thị Three.js. Chỉ đọc state từ src/core và gửi input đúng định dạng contract.
// Không có luật gameplay ở đây — mọi luật nằm trong src/core/sim.js.
// Phần "Sáng tạo của tôi" (chỉ hiển thị, không ảnh hưởng headless): đom đóm đang mang bay quanh nón lá,
// vòng sáng an toàn quanh đèn đã thắp, sương đổi từ tím sang cam khi đảo sáng dần.
import * as THREE from 'three';
import { createGame, step } from '../core/sim.js';
import { TUNING, WORLD } from '../core/tuning.js';

const $ = (id) => document.getElementById(id);
const COLORS = { warm: 0xffb347, danger: 0x2a0a4a, fogDark: 0x140a2a, fogWarm: 0x3a2440 };

// ---------- Scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.fogDark);
scene.fog = new THREE.Fog(COLORS.fogDark, 20, 70);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);

const hemi = new THREE.HemisphereLight(0x8a7cc8, 0x1a1030, 0.35);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xb8b0ff, 0.35);
moon.position.set(-20, 40, -10);
scene.add(moon);

// Đảo + biển mây
const island = new THREE.Mesh(
  new THREE.CylinderGeometry(WORLD.island_radius, WORLD.island_radius - 3, 4, 64),
  new THREE.MeshStandardMaterial({ color: 0x3b4a3a, roughness: 1 }),
);
island.position.y = -2;
scene.add(island);
const clouds = new THREE.Mesh(
  new THREE.CircleGeometry(200, 48),
  new THREE.MeshStandardMaterial({ color: 0x2b2550, roughness: 1 }),
);
clouds.rotation.x = -Math.PI / 2;
clouds.position.y = -3;
scene.add(clouds);
// Vài khối đá trang trí (cố định, không ảnh hưởng logic)
for (let i = 0; i < 14; i++) {
  const a = i * 2.39;
  const r = 8 + ((i * 7) % 19);
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.5 + (i % 3) * 0.3),
    new THREE.MeshStandardMaterial({ color: 0x4a4a5a, roughness: 1 }),
  );
  rock.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r);
  scene.add(rock);
}

// ---------- Mây (nhân vật) ----------
function makePlayer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.0, 16), new THREE.MeshStandardMaterial({ color: 0x5b8fd6 }));
  body.position.y = 0.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf2d0b0 }));
  head.position.y = 1.25;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.38, 24), new THREE.MeshStandardMaterial({ color: 0xd9b56c }));
  hat.position.y = 1.55; // nón lá
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff8a1e, emissiveIntensity: 2 }),
  );
  lamp.position.set(0.65, 1.2, 0); // đèn lồng nhỏ treo ở vành nón
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2), new THREE.MeshBasicMaterial({ color: 0x553311 }));
  string.position.set(0.65, 1.35, 0);
  const glow = new THREE.PointLight(0xffa040, 1.6, 9, 1.5);
  glow.position.copy(lamp.position);
  g.add(body, head, hat, lamp, string, glow);
  return g;
}
const playerMesh = makePlayer();
scene.add(playerMesh);

// ---------- Đèn Lồng Lớn ----------
const lanternViews = new Map();
function makeLantern() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3, 10), new THREE.MeshStandardMaterial({ color: 0x5a3a22 }));
  post.position.y = 1.5;
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a2a3a, emissive: 0x000000 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.8, 12), mat);
  body.position.y = 3.3;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.35, 12), new THREE.MeshStandardMaterial({ color: 0x7a2a1a }));
  cap.position.y = 3.9;
  const light = new THREE.PointLight(0xffa040, 0, 22, 1.2);
  light.position.y = 3.3;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(TUNING.safe_radius - 0.15, TUNING.safe_radius, 64),
    new THREE.MeshBasicMaterial({ color: COLORS.warm, transparent: true, opacity: 0, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  // Cột tiến độ nạp đèn (cao 1, co giãn theo deposited)
  const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  fill.position.x = 0.2;
  g.add(post, body, cap, light, ring, fill);
  return { g, mat, light, ring, fill, lit: false };
}

// ---------- Đom đóm & Bóng Mực ----------
const moteGeo = new THREE.SphereGeometry(0.14, 10, 8);
const moteMat = new THREE.MeshStandardMaterial({ color: 0xfff1a0, emissive: 0xffd040, emissiveIntensity: 2.5 });
const moteViews = new Map();
const shadeGeo = new THREE.SphereGeometry(0.8, 18, 14);
const shadeViews = new Map();
function makeShade() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: COLORS.danger, emissive: 0x3a0a60, emissiveIntensity: 0.6, transparent: true, opacity: 0.9 });
  const blob = new THREE.Mesh(shadeGeo, mat);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd9a0ff });
  for (const x of [-0.25, 0.25]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), eyeMat);
    eye.position.set(x, 0.15, 0.7);
    blob.add(eye);
  }
  g.add(blob);
  return { g, blob, mat };
}

// Sáng tạo: đom đóm đang mang bay vòng quanh nón lá
const carriedViews = [];
for (let i = 0; i < TUNING.carry_capacity; i++) {
  const m = new THREE.Mesh(moteGeo, moteMat);
  m.visible = false;
  scene.add(m);
  carriedViews.push(m);
}

// Hiệu ứng vòng tỏa sáng
const pulseRing = new THREE.Mesh(
  new THREE.RingGeometry(0.9, 1, 64),
  new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, side: THREE.DoubleSide }),
);
pulseRing.rotation.x = -Math.PI / 2;
pulseRing.position.y = 0.3;
scene.add(pulseRing);
let pulseFx = 0;

// ---------- Input → định dạng contract ----------
const keys = new Set();
let camYaw = 0; // độ; quay phải = giảm yaw (xem docs/notes/phase-1.md)
let dragging = false;
let lastX = 0;
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyR') restart();
  if (e.code === 'Space') e.preventDefault();
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
  camYaw -= (e.clientX - lastX) * 0.3;
  lastX = e.clientX;
});

function readInput() {
  const k = (c) => keys.has(c);
  // Camera nhìn theo +Z khi yaw = 0 → phía phải màn hình là −X, nên D gửi x = −1.
  const x = (k('KeyA') ? 1 : 0) - (k('KeyD') ? 1 : 0);
  const z = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0);
  return {
    move: [x, z],
    cam_yaw_deg: camYaw,
    jump: k('Space'),
    interact: k('KeyE'),
    pulse: k('KeyF'),
    dash: false,
  };
}

// ---------- Vòng lặp ----------
let game;
function restart() {
  for (const v of lanternViews.values()) scene.remove(v.g);
  for (const v of moteViews.values()) scene.remove(v);
  for (const v of shadeViews.values()) scene.remove(v.g);
  lanternViews.clear();
  moteViews.clear();
  shadeViews.clear();
  game = createGame({ seed: (Date.now() % 1e9) | 0 });
  camYaw = 0;
  $('overlay').style.display = 'none';
}
$('ov-btn').addEventListener('click', restart);
restart();

function handleEvents(events) {
  for (const e of events) {
    if (e.name === 'pulse') pulseFx = 1;
    if (e.name === 'player_hit') {
      $('flash').style.boxShadow = 'inset 0 0 160px 60px rgba(110, 40, 160, 0.85)';
      setTimeout(() => ($('flash').style.boxShadow = 'inset 0 0 160px 40px rgba(110, 40, 160, 0)'), 250);
    }
    if (e.name === 'game_over') showOverlay(e.data);
  }
}

function showOverlay({ result, reason }) {
  const why = { all_lit: 'Cả 5 Đèn Lồng Lớn đã sáng. Đảo Bến ấm trở lại!', no_flames: 'Mây đã hết lửa…', dawn: 'Trời đã sáng mà đảo vẫn còn tối…' };
  $('ov-title').textContent = result === 'won' ? 'Thắng rồi!' : 'Thua rồi';
  $('ov-text').innerHTML = `${why[reason]}<br><br>Điểm: <b>${game.score}</b>`;
  $('overlay').style.display = 'flex';
}

const clock = new THREE.Clock();
let acc = 0;
const DT = 1 / WORLD.tick_rate;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  const turn = (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0);
  camYaw += turn * 120 * dt;
  acc += dt;
  while (acc >= DT) {
    acc -= DT;
    if (game.state === 'playing') handleEvents(step(game, readInput()));
  }
  sync(clock.elapsedTime);
  renderer.render(scene, camera);
}

function sync(time) {
  const p = game.player;
  playerMesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
  // Quay mặt theo hướng di chuyển
  const inp = readInput();
  if (inp.move[0] || inp.move[1]) {
    const th = (camYaw * Math.PI) / 180;
    const wx = inp.move[0] * Math.cos(th) + inp.move[1] * Math.sin(th);
    const wz = -inp.move[0] * Math.sin(th) + inp.move[1] * Math.cos(th);
    playerMesh.rotation.y = Math.atan2(wx, wz);
  }
  playerMesh.visible = p.invulnTicks > 0 ? Math.floor(time * 12) % 2 === 0 : true;

  // Camera góc nhìn thứ ba sau lưng theo yaw
  const th = (camYaw * Math.PI) / 180;
  camera.position.set(p.pos[0] - Math.sin(th) * 9, p.pos[1] + 5.5, p.pos[2] - Math.cos(th) * 9);
  camera.lookAt(p.pos[0], p.pos[1] + 1.2, p.pos[2]);

  // Đèn
  let litCount = 0;
  for (const L of game.lanterns) {
    let v = lanternViews.get(L.id);
    if (!v) {
      v = makeLantern();
      scene.add(v.g);
      lanternViews.set(L.id, v);
    }
    v.g.position.set(L.pos[0], L.pos[1], L.pos[2]);
    const frac = Math.min(1, L.deposited / TUNING.lantern_cost);
    const h = 0.01 + 2.4 * frac;
    v.fill.scale.y = h;
    v.fill.position.y = h / 2;
    if (L.lit) {
      litCount++;
      v.mat.emissive.setHex(0xff9a2e);
      v.mat.emissiveIntensity = 1.6 + Math.sin(time * 3 + L.pos[0]) * 0.2;
      v.light.intensity = 3;
      v.ring.material.opacity = 0.35 + Math.sin(time * 2) * 0.1;
    } else {
      v.mat.emissive.setHex(0x000000);
      v.light.intensity = 0;
      v.ring.material.opacity = 0;
    }
  }
  // Sáng tạo: đảo sáng dần, sương chuyển từ tím sang ấm khi thắp đèn
  const k = litCount / game.lanterns.length;
  hemi.intensity = 0.35 + 0.9 * k;
  scene.fog.color.setHex(COLORS.fogDark).lerp(new THREE.Color(COLORS.fogWarm), k);
  scene.background.copy(scene.fog.color);

  // Đom đóm
  const alive = new Set();
  for (const m of game.motes) {
    alive.add(m.id);
    let v = moteViews.get(m.id);
    if (!v) {
      v = new THREE.Mesh(moteGeo, moteMat);
      scene.add(v);
      moteViews.set(m.id, v);
    }
    const ph = m.pos[0] * 1.7 + m.pos[2];
    v.position.set(m.pos[0], 0.6 + Math.sin(time * 2 + ph) * 0.2, m.pos[2]);
  }
  for (const [id, v] of moteViews) if (!alive.has(id)) (scene.remove(v), moteViews.delete(id));

  // Đom đóm đang mang bay quanh nón
  carriedViews.forEach((v, i) => {
    v.visible = i < p.carried;
    const a = time * 2.2 + (i * 2 * Math.PI) / TUNING.carry_capacity;
    v.position.set(p.pos[0] + Math.cos(a) * 0.9, p.pos[1] + 1.8 + Math.sin(time * 3 + i) * 0.1, p.pos[2] + Math.sin(a) * 0.9);
  });

  // Bóng Mực
  const aliveS = new Set();
  for (const s of game.shades) {
    aliveS.add(s.id);
    let v = shadeViews.get(s.id);
    if (!v) {
      v = makeShade();
      scene.add(v.g);
      shadeViews.set(s.id, v);
    }
    v.g.position.set(s.pos[0], s.pos[1], s.pos[2]);
    v.g.lookAt(p.pos[0], s.pos[1], p.pos[2]);
    const stunned = s.stunTicks > 0;
    v.blob.scale.setScalar(stunned ? 0.7 : 1 + Math.sin(time * 4 + s.pos[0]) * 0.06);
    v.mat.opacity = stunned ? 0.45 : 0.9;
  }
  for (const [id, v] of shadeViews) if (!aliveS.has(id)) (scene.remove(v.g), shadeViews.delete(id));

  // Hiệu ứng tỏa sáng
  if (pulseFx > 0) {
    pulseFx = Math.max(0, pulseFx - 0.04);
    const r = TUNING.pulse_radius * (1 - pulseFx);
    pulseRing.scale.setScalar(Math.max(0.01, r));
    pulseRing.position.set(p.pos[0], 0.3, p.pos[2]);
    pulseRing.material.opacity = pulseFx;
  }

  updateHud(p);
}

function updateHud(p) {
  const lit = game.lanterns.filter((l) => l.lit).length;
  const t = Math.max(0, game.timeLeftTicks) / WORLD.tick_rate;
  const mm = String(Math.floor(t / 60)).padStart(1, '0');
  const ss = String(Math.floor(t % 60)).padStart(2, '0');
  const cd = p.pulseCooldownTicks / WORLD.tick_rate;
  const pulseTxt = cd > 0 ? `hồi ${cd.toFixed(1)}s` : p.carried >= TUNING.pulse_cost ? 'sẵn sàng' : 'cần đom đóm';
  $('hud').innerHTML = [
    `Lửa <b>${'🔥'.repeat(p.flames) || '—'}</b>`,
    `Đom đóm <b>${p.carried}/${TUNING.carry_capacity}</b>`,
    `Đèn <b>${lit}/${game.lanterns.length}</b>`,
    `Điểm <b>${game.score}</b>`,
    `Bình minh sau <b>${mm}:${ss}</b>`,
    `Tỏa sáng (F) <b>${pulseTxt}</b>`,
  ].map((h) => `<div class="chip">${h}</div>`).join('');

  // Gợi ý khi đứng cạnh đèn chưa thắp
  let hint = '';
  for (const L of game.lanterns) {
    if (L.lit) continue;
    const d = Math.hypot(p.pos[0] - L.pos[0], p.pos[2] - L.pos[2]);
    if (d <= TUNING.interact_radius) {
      hint = p.carried > 0 ? `Nhấn E để nạp ánh sáng (${L.deposited}/${TUNING.lantern_cost})` : `Đèn cần ${TUNING.lantern_cost - L.deposited} đom đóm nữa`;
    }
  }
  $('hint').textContent = game.state === 'playing' ? hint : '';
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

frame();
