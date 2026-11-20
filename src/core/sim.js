// Logic game thuần, tất định — Test Contract v1.1 (Ticket-02). Không import three/DOM, không Math.random.
// Thứ tự 12 bước trong một tick theo Ticket-02; giả định B1–B21 trong docs/notes/phase-2.md.
import { TUNING, WORLD as W } from './tuning.js';
import { createRng } from './rng.js';
import { MAPS } from './maps.js';
import { BUTTONS, FormatError } from './formats.js';

const TR = W.tick_rate;
const EPS = 1e-9;

export function round3(v) {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? 0 : r;
}
export const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function idNum(id) {
  const m = /^[A-Z](\d+)$/.exec(id);
  return m ? Number(m[1]) : Infinity;
}
export function compareIds(a, b) {
  const d = idNum(a) - idNum(b);
  if (d !== 0 && Number.isFinite(d)) return d;
  return a < b ? -1 : a > b ? 1 : 0;
}
const byId = (arr) => [...arr].sort((a, b) => compareIds(a.id, b.id));

function nextId(g, prefix, list) {
  const used = new Set(list.map((e) => e.id));
  let id;
  do id = `${prefix}${g.nextIds[prefix]++}`;
  while (used.has(id));
  return id;
}
const pick = (g, arr) => arr[Math.floor(g.rng() * arr.length)];

// ---------- dựng Đêm ----------
export function createGame({ seed = 0, night = 1, scenario = null } = {}) {
  const map = MAPS[night];
  if (!map) throw new FormatError(`night ${night} không tồn tại`);
  const sc = scenario ?? {};
  const g = {
    seed,
    night,
    map,
    rng: createRng(seed),
    tick: 0,
    simTick: 0,
    paused: false,
    state: 'playing',
    result: null,
    reason: null,
    score: 0,
    timeLeftTicks: Math.round(map.duration_s * TR),
    player: {
      pos: [...map.start],
      vel: [0, 0, 0],
      grounded: true,
      facing: [0, 1],
      flames: TUNING.flames,
      carried: 0,
      invulnTicks: 0,
      dashCdTicks: 0,
      pulseCdTicks: 0,
      charmTicks: 0,
      dashTicks: 0,
      dashDir: [0, 1],
      launch: null,
      fallWaitTicks: 0,
    },
    lanterns: map.lanterns.map((p, i) => ({ id: `L${i + 1}`, pos: [...p], lit: false, deposited: 0 })),
    motes: [],
    shades: [],
    drifters: [],
    charms: map.charms.map((p, i) => ({ id: `C${i + 1}`, pos: [...p], available: true, respawnTicks: 0 })),
    randomMotes: sc.random_motes ?? true,
    randomShades: sc.random_shades ?? true,
    randomDrifters: sc.random_drifters ?? map.drifters,
    windEnabled: sc.wind_enabled ?? map.wind,
    wind: { active: false, dirDeg: null, ticksLeft: 0 },
    nextIds: { M: 1, S: 1, D: 1, C: map.charms.length + 1 },
    prevButtons: Object.fromEntries(BUTTONS.map((b) => [b, false])),
  };
  const p = g.player;

  if (sc.player) {
    const sp = sc.player;
    if (sp.pos) p.pos = [...sp.pos];
    if ('carried' in sp) p.carried = sp.carried;
    if ('flames' in sp) p.flames = sp.flames;
    if ('invuln_ticks' in sp) p.invulnTicks = sp.invuln_ticks;
    if ('dash_cd_ticks' in sp) p.dashCdTicks = sp.dash_cd_ticks;
    if ('pulse_cd_ticks' in sp) p.pulseCdTicks = sp.pulse_cd_ticks;
    if ('charm_ticks' in sp) p.charmTicks = sp.charm_ticks;
  }
  const gr = map.ground(p.pos[0], p.pos[2]);
  p.grounded = gr !== null && Math.abs(p.pos[1] - gr) < 1e-6;
  if ('time_left_s' in sc) g.timeLeftTicks = Math.round(sc.time_left_s * TR);
  for (const upd of sc.lanterns ?? []) {
    const L = g.lanterns.find((l) => l.id === upd.id);
    if (!L) throw new FormatError(`scenario.lanterns: Đêm ${night} không có đèn ${upd.id}`);
    if (upd.pos) L.pos = [...upd.pos];
    if ('deposited' in upd) L.deposited = upd.deposited;
    if ('lit' in upd) {
      L.lit = upd.lit;
      if (upd.lit && !('deposited' in upd)) L.deposited = TUNING.lantern_cost;
    }
  }

  if (sc.motes) {
    for (const m of sc.motes) {
      const o = Array.isArray(m) ? { pos: m } : m;
      const kind = o.kind ?? 'random';
      g.motes.push({
        id: o.id ?? nextId(g, 'M', g.motes),
        pos: [...o.pos],
        kind,
        ttl: kind === 'dropped' ? Math.round((o.ttl_s ?? W.dropped_ttl / TR) * TR) : null,
        point: null,
      });
    }
  } else if (g.randomMotes) {
    const idx = map.motePoints.map((_, i) => i);
    for (let n = 0; n < W.mote_initial && idx.length; n++) {
      const k = Math.floor(g.rng() * idx.length);
      const pi = idx.splice(k, 1)[0];
      g.motes.push({ id: nextId(g, 'M', g.motes), pos: [...map.motePoints[pi]], kind: 'random', ttl: null, point: pi });
    }
  }

  for (const s of sc.shades ?? []) {
    const o = Array.isArray(s) ? { pos: s } : s;
    const shade = newShade(g, o.pos, o.id);
    const st = o.state ?? 'wander';
    const left = o.state_ticks_left;
    if (st === 'spawning') shade.spawnTicks = left ?? W.shade_spawn_ticks;
    else if (st === 'stunned') {
      shade.stunTicks = left ?? W.stun_ticks;
    } else if (st === 'recoil') {
      shade.recoilTicks = left ?? W.recoil_ticks;
      shade.recoilDir = awayDir(p.pos, shade.pos);
    } else shade.mode = st; // wander | chase
    shade.spawnTicks ??= 0;
  }
  for (const d of sc.drifters ?? []) {
    const o = Array.isArray(d) ? { pos: d } : d;
    const dr = newDrifter(g, o.pos, o.id);
    if (o.state) dr.state = o.state;
    if ('stolen' in o) dr.stolen = o.stolen;
    if (dr.state === 'flee') dr.fleeTicks = W.drifter_flee_ticks;
  }
  if (sc.charms) {
    g.charms = sc.charms.map((c, i) => {
      const o = Array.isArray(c) ? { pos: c } : c;
      return {
        id: o.id ?? `C${i + 1}`,
        pos: [...o.pos],
        available: o.available ?? true,
        respawnTicks: o.respawn_ticks ?? (o.available === false ? W.charm_respawn_ticks : 0),
      };
    });
  }
  return g;
}

function newShade(g, pos, id) {
  const s = {
    id: id ?? nextId(g, 'S', g.shades),
    pos: [...pos],
    mode: 'wander',
    spawnTicks: 0,
    stunTicks: 0,
    pushTicks: 0,
    pushDir: [1, 0],
    recoilTicks: 0,
    recoilDir: [1, 0],
    evict: null,
    target: null,
  };
  g.shades.push(s);
  return s;
}
function newDrifter(g, pos, id) {
  const d = { id: id ?? nextId(g, 'D', g.drifters), pos: [...pos], state: 'idle', stolen: 0, fleeTicks: 0, target: null, stoleOnce: false };
  g.drifters.push(d);
  return d;
}

function awayDir(from, to) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const d = Math.hypot(dx, dz);
  return d > EPS ? [dx / d, dz / d] : [1, 0];
}

export function shadeState(s) {
  if (s.spawnTicks > 0) return 'spawning';
  if (s.stunTicks > 0) return 'stunned';
  if (s.recoilTicks > 0) return 'recoil';
  return s.mode;
}

// Vật cản cho Bóng Mực khi bị đẩy (B10): tháp chuông + vùng an toàn đèn đã sáng.
function blockedForShade(g, x, z, y) {
  const t = g.map.tower;
  if (t && Math.hypot(x, z) < t.r && y < t.top) return true;
  for (const L of g.lanterns) if (L.lit && Math.hypot(x - L.pos[0], z - L.pos[2]) < TUNING.safe_radius - EPS) return true;
  return false;
}
// Giữ Bóng Mực ở ngoài (hoặc đúng mép) vùng an toàn 6 m.
function clampSafe(g, s) {
  for (let pass = 0; pass < 2; pass++) {
    for (const L of g.lanterns) {
      if (!L.lit) continue;
      const dx = s.pos[0] - L.pos[0];
      const dz = s.pos[2] - L.pos[2];
      const d = Math.hypot(dx, dz);
      if (d < TUNING.safe_radius) {
        const [ux, uz] = d > EPS ? [dx / d, dz / d] : [1, 0];
        s.pos[0] = L.pos[0] + ux * TUNING.safe_radius;
        s.pos[2] = L.pos[2] + uz * TUNING.safe_radius;
      }
    }
  }
}
function moveToward(e, target, speed) {
  const dx = target[0] - e.pos[0];
  const dz = target[2] - e.pos[2];
  const d = Math.hypot(dx, dz);
  if (d <= EPS) return d;
  const m = Math.min(speed / TR, d);
  e.pos[0] += (dx / d) * m;
  e.pos[2] += (dz / d) * m;
  return d - m;
}
function wander(g, e, speed) {
  if (!e.target || distXZ(e.pos, e.target) <= 1) e.target = pick(g, g.map.motePoints);
  moveToward(e, e.target, speed);
}

function dropMotes(g, center, n, groundY) {
  for (let i = 0; i < n; i++) {
    const a = g.rng() * 2 * Math.PI;
    const r = W.drop_ring_min + g.rng() * (W.drop_ring_max - W.drop_ring_min);
    const x = round3(center[0] + r * Math.cos(a));
    const z = round3(center[2] + r * Math.sin(a));
    const gy = g.map.ground(x, z);
    g.motes.push({ id: nextId(g, 'M', g.motes), pos: [x, gy ?? groundY, z], kind: 'dropped', ttl: W.dropped_ttl, point: null });
  }
}

// ---------- một bước ----------
export function step(g, input) {
  if (g.state !== 'playing') return [];
  const events = [];
  const t = g.tick + 1;
  const emit = (name, data = {}) => events.push({ type: 'event', tick: t, name, data });
  runStep(g, input, emit);
  g.tick = t;
  return events;
}

function runStep(g, input, emit) {
  const T = TUNING;
  const p = g.player;
  const map = g.map;

  // 1. Input (pause trước)
  const pressed = {};
  for (const b of BUTTONS) {
    pressed[b] = !!input[b] && !g.prevButtons[b];
    g.prevButtons[b] = !!input[b];
  }
  if (pressed.pause) {
    g.paused = !g.paused;
    emit(g.paused ? 'paused' : 'resumed');
    if (g.paused) return;
  } else if (g.paused) return;

  // 2. Bộ đếm
  g.simTick++;
  g.timeLeftTicks--;
  for (const k of ['dashCdTicks', 'pulseCdTicks', 'invulnTicks', 'charmTicks']) if (p[k] > 0) p[k]--;
  for (const s of g.shades) {
    if (s.stunTicks > 0) s.stunTicks--;
    if (s.spawnTicks > 0) s.spawnTicks--;
  }
  for (const m of g.motes) if (m.kind === 'dropped') m.ttl--;
  g.motes = g.motes.filter((m) => m.kind !== 'dropped' || m.ttl > 0);
  for (const c of g.charms) {
    if (!c.available && c.respawnTicks > 0 && --c.respawnTicks === 0) c.available = true;
  }
  if (g.wind.active && --g.wind.ticksLeft <= 0) {
    g.wind.active = false;
    g.wind.dirDeg = null;
  }
  if (g.windEnabled && g.simTick % W.wind_every === 0) {
    g.wind = { active: true, dirDeg: round3(g.rng() * 360), ticksLeft: W.wind_ticks };
  }

  // 3. Di chuyển Mây + rơi khỏi đảo
  if (p.fallWaitTicks > 0) {
    if (--p.fallWaitTicks === 0) {
      p.pos = [...map.start];
      p.vel = [0, 0, 0];
      p.grounded = true;
      p.launch = null;
      p.dashTicks = 0;
      p.invulnTicks = W.invuln_ticks;
    }
  } else {
    movePlayer(g, input, pressed, emit);
  }

  // 4. Nhặt đom đóm và bùa
  if (p.fallWaitTicks === 0) {
    for (const m of byId(g.motes)) {
      if (p.carried >= T.carry_capacity) break;
      if (distXZ(p.pos, m.pos) <= T.pickup_radius + EPS && Math.abs(p.pos[1] - m.pos[1]) <= W.pickup_dy + EPS) {
        g.motes.splice(g.motes.indexOf(m), 1);
        p.carried++;
        emit('mote_picked', { carried: p.carried });
      }
    }
    for (const c of g.charms) {
      if (c.available && distXZ(p.pos, c.pos) <= T.pickup_radius + EPS && Math.abs(p.pos[1] - c.pos[1]) <= W.pickup_dy + EPS) {
        c.available = false;
        c.respawnTicks = W.charm_respawn_ticks;
        p.charmTicks = W.charm_ticks;
        emit('charm_picked', { charm_id: c.id, charm_ticks: W.charm_ticks });
      }
    }
  }

  // 5. Tương tác với đèn
  const justLit = [];
  if (pressed.interact && p.carried > 0 && p.fallWaitTicks === 0) {
    let best = null;
    let bestD = Infinity;
    for (const L of g.lanterns) {
      if (L.lit) continue;
      const d = distXZ(p.pos, L.pos);
      if (d <= T.interact_radius + EPS && d < bestD - EPS) {
        best = L;
        bestD = d;
      }
    }
    if (best) {
      const amount = Math.min(p.carried, T.lantern_cost - best.deposited);
      if (amount > 0) {
        p.carried -= amount;
        best.deposited += amount;
        g.score += T.score.per_mote * amount;
        emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      }
      if (best.deposited >= T.lantern_cost) {
        best.lit = true;
        g.score += T.score.per_lantern;
        emit('lantern_lit', { lantern_id: best.id });
        justLit.push(best);
      }
    }
  }

  // 6. Vùng an toàn: Bóng trong vùng đèn vừa thắp bị đẩy ra mép trong 30 tick (B9)
  for (const L of justLit) {
    for (const s of g.shades) {
      const d = distXZ(s.pos, L.pos);
      if (d < T.safe_radius) {
        const dir = awayDir(L.pos, s.pos);
        s.evict = { ticks: W.evict_ticks, dir, step: (T.safe_radius - d) / W.evict_ticks, L };
      }
    }
  }
  for (const s of g.shades) {
    if (!s.evict) continue;
    s.pos[0] += s.evict.dir[0] * s.evict.step;
    s.pos[2] += s.evict.dir[1] * s.evict.step;
    if (--s.evict.ticks === 0) {
      const L = s.evict.L;
      s.pos[0] = L.pos[0] + s.evict.dir[0] * T.safe_radius;
      s.pos[2] = L.pos[2] + s.evict.dir[1] * T.safe_radius;
      s.evict = null;
    }
  }

  // 7. Tỏa Sáng
  if (pressed.pulse && p.pulseCdTicks === 0 && p.carried >= T.pulse_cost && p.fallWaitTicks === 0) {
    p.carried -= T.pulse_cost;
    p.pulseCdTicks = W.pulse_cd_ticks;
    const c = [p.pos[0], p.pos[1] + W.pulse_center_dy, p.pos[2]];
    const ids = [];
    for (const s of byId(g.shades)) {
      if (dist3(c, s.pos) <= T.pulse_radius + EPS) {
        s.stunTicks = W.stun_ticks;
        s.pushTicks = W.push_ticks;
        s.pushDir = awayDir(p.pos, s.pos);
        s.spawnTicks = 0;
        s.recoilTicks = 0;
        ids.push(s.id);
      }
    }
    // Sự kiện pulse phát trước, hệ quả lên Gió Lạc (drifter_drop) phát sau
    g.score += T.score.per_stun * ids.length;
    emit('pulse', { stunned_ids: ids });
    for (const d of byId(g.drifters)) {
      if (d.state === 'removed' || dist3(c, d.pos) > T.pulse_radius + EPS) continue;
      if (d.state === 'chase' || d.state === 'idle') {
        if (d.state === 'chase') {
          d.state = 'flee';
          d.fleeTicks = W.drifter_flee_ticks;
          d.fleeFresh = true; // không trừ ở chính tick chuyển flee (đủ 240 tick)
        }
      } else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        const gy = map.ground(d.pos[0], d.pos[2]) ?? 0;
        for (let i = 0; i < amount; i++) {
          g.motes.push({ id: nextId(g, 'M', g.motes), pos: [round3(d.pos[0]), gy, round3(d.pos[2])], kind: 'dropped', ttl: W.dropped_ttl, point: null });
        }
        d.stolen = 0;
        d.fleeTicks = W.drifter_drop_remove_ticks;
        d.fleeFresh = true;
        emit('drifter_drop', { drifter_id: d.id, amount });
      }
    }
  }

  // 8. Di chuyển Bóng Mực và Gió Lạc
  const playerAway = p.fallWaitTicks > 0;
  for (const s of g.shades) {
    if (s.evict || s.spawnTicks > 0) continue;
    if (s.stunTicks > 0) {
      if (s.pushTicks > 0) {
        s.pushTicks--;
        const stepM = T.pulse_push_m / W.push_ticks;
        const nx = s.pos[0] + s.pushDir[0] * stepM;
        const nz = s.pos[2] + s.pushDir[1] * stepM;
        if (blockedForShade(g, nx, nz, s.pos[1])) s.pushTicks = 0;
        else {
          s.pos[0] = nx;
          s.pos[2] = nz;
        }
      }
      continue;
    }
    if (s.recoilTicks > 0) {
      s.recoilTicks--;
      const nx = s.pos[0] + s.recoilDir[0] * (W.recoil_m / W.recoil_ticks);
      const nz = s.pos[2] + s.recoilDir[1] * (W.recoil_m / W.recoil_ticks);
      if (!blockedForShade(g, nx, nz, s.pos[1])) {
        s.pos[0] = nx;
        s.pos[2] = nz;
      }
      continue;
    }
    const d = distXZ(s.pos, p.pos);
    if (playerAway) s.mode = 'wander';
    else if (s.mode === 'chase' && d > W.shade_lose) s.mode = 'wander';
    else if (s.mode === 'wander' && d <= W.shade_detect + EPS) s.mode = 'chase';
    if (s.mode === 'chase') moveToward(s, p.pos, map.shadeSpeed);
    else wander(g, s, W.shade_wander_speed);
    clampSafe(g, s);
  }
  for (const d of g.drifters) {
    if (d.state === 'removed') continue;
    if (d.state === 'flee') {
      const [ux, uz] = awayDir(p.pos, d.pos);
      d.pos[0] += (ux * W.drifter_speed) / TR;
      d.pos[2] += (uz * W.drifter_speed) / TR;
      if (d.fleeFresh) d.fleeFresh = false;
      else if (--d.fleeTicks <= 0) d.state = 'removed';
      continue;
    }
    const want = !playerAway && p.carried >= W.drifter_chase_carry && distXZ(d.pos, p.pos) <= W.drifter_chase_dist + EPS;
    d.state = want ? 'chase' : 'idle';
    if (want) moveToward(d, p.pos, W.drifter_speed);
    else wander(g, d, W.drifter_idle_speed);
  }

  // 9. Chạm: Gió Lạc cướp trước, rồi Bóng Mực (id tăng dần)
  if (!playerAway) {
    for (const d of byId(g.drifters)) {
      if ((d.state !== 'idle' && d.state !== 'chase') || d.stoleOnce || p.carried <= 0) continue;
      if (distXZ(d.pos, p.pos) <= W.drifter_touch + EPS) {
        const amount = Math.min(W.drifter_steal_max, p.carried);
        p.carried -= amount;
        d.stolen = amount;
        d.stoleOnce = true;
        d.state = 'flee';
        d.fleeTicks = W.drifter_flee_ticks;
        emit('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
      }
    }
    for (const s of byId(g.shades)) {
      const st = shadeState(s);
      if (s.evict || (st !== 'chase' && st !== 'wander')) continue;
      if (distXZ(s.pos, p.pos) > T.shade_hit_radius + EPS || Math.abs(s.pos[1] - p.pos[1]) > W.hit_dy + EPS) continue;
      if (p.invulnTicks > 0) continue; // chạm lúc bất tử: không làm gì
      p.flames = Math.max(0, p.flames - 1);
      const dropped = Math.floor(p.carried / 2);
      p.carried -= dropped;
      dropMotes(g, p.pos, dropped, p.pos[1]);
      p.invulnTicks = W.invuln_ticks;
      s.recoilTicks = W.recoil_ticks;
      s.recoilDir = awayDir(p.pos, s.pos);
      emit('player_hit', { by: 'shade', flames: p.flames, dropped });
    }
  }

  // 10. Sinh theo lịch (thực thể mới chỉ tương tác từ tick sau)
  if (g.randomMotes && g.simTick % W.mote_spawn_every === 0) {
    const randomCount = g.motes.filter((m) => m.kind === 'random').length;
    if (randomCount < W.mote_cap) {
      const taken = new Set(g.motes.filter((m) => m.point !== null).map((m) => m.point));
      const free = map.motePoints.map((_, i) => i).filter((i) => !taken.has(i));
      if (free.length) {
        const pi = pick(g, free);
        g.motes.push({ id: nextId(g, 'M', g.motes), pos: [...map.motePoints[pi]], kind: 'random', ttl: null, point: pi });
      }
    }
  }
  if (g.randomShades && g.simTick >= W.shade_first_spawn && (g.simTick - W.shade_first_spawn) % map.shadeEvery === 0) {
    const n = g.simTick === W.shade_first_spawn ? 2 : 1;
    const used = [];
    for (let i = 0; i < n && g.shades.length < map.shadeMax; i++) {
      const valid = map.shadePoints.filter(
        (pt) =>
          !used.includes(pt) &&
          distXZ(pt, p.pos) >= W.shade_min_dist_player - EPS &&
          !g.lanterns.some((L) => L.lit && distXZ(pt, L.pos) < T.safe_radius),
      );
      if (!valid.length) break;
      const pt = pick(g, valid);
      used.push(pt);
      const s = newShade(g, pt);
      s.spawnTicks = W.shade_spawn_ticks;
      emit('shade_spawned', { id: s.id });
    }
  }
  if (g.randomDrifters && g.simTick % W.drifter_every === 0) {
    const alive = g.drifters.filter((d) => d.state !== 'removed').length;
    if (alive < W.drifter_max) {
      const valid = map.shadePoints.filter((pt) => distXZ(pt, p.pos) >= W.shade_min_dist_player - EPS);
      if (valid.length) newDrifter(g, pick(g, valid));
    }
  }

  // 11. Thắng / thua (hết lửa ưu tiên; thắng kể cả đúng tick hết giờ)
  if (p.flames <= 0) endGame(g, 'lost', 'no_flames', emit);
  else if (g.lanterns.every((l) => l.lit)) endGame(g, 'won', 'all_lit', emit);
  else if (g.timeLeftTicks <= 0) endGame(g, 'lost', 'dawn', emit);
}

function movePlayer(g, input, pressed, emit) {
  const p = g.player;
  const map = g.map;
  let [mx, mz] = input.move ?? [0, 0];
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  const th = ((input.cam_yaw_deg ?? 0) * Math.PI) / 180;
  const wx = mx * Math.cos(th) + mz * Math.sin(th);
  const wz = -mx * Math.sin(th) + mz * Math.cos(th);
  const wl = Math.hypot(wx, wz);
  if (wl > EPS) p.facing = [wx / wl, wz / wl];

  if (pressed.dash && p.dashTicks === 0 && (p.dashCdTicks === 0 || p.charmTicks > 0)) {
    p.dashTicks = W.dash_ticks;
    p.dashCdTicks = W.dash_cd_ticks;
    p.dashDir = wl > EPS ? [wx / wl, wz / wl] : [...p.facing];
    emit('dash');
  }
  let vy = p.vel[1];
  if (pressed.jump && p.grounded) {
    vy = W.jump_speed;
    p.grounded = false;
    p.launch = null;
  }
  const speed = p.charmTicks > 0 ? W.charm_speed : TUNING.player_speed;
  let hx;
  let hz;
  const dashing = p.dashTicks > 0;
  if (dashing) {
    hx = p.dashDir[0] * TUNING.dash_speed;
    hz = p.dashDir[1] * TUNING.dash_speed;
    p.dashTicks--;
  } else if (p.launch) {
    [hx, hz] = p.launch;
  } else {
    hx = wx * speed;
    hz = wz * speed;
  }
  if (g.wind.active) {
    const a = (g.wind.dirDeg * Math.PI) / 180;
    hx += Math.cos(a) * W.wind_speed;
    hz += Math.sin(a) * W.wind_speed;
  }
  if (!p.grounded) {
    if (dashing) vy = 0; // lướt trên không giữ nguyên độ cao
    else vy -= W.gravity / TR;
  } else if (vy < 0) vy = 0;

  const wasGrounded = p.grounded;
  let nx = p.pos[0] + hx / TR;
  let nz = p.pos[2] + hz / TR;
  let ny = p.pos[1] + vy / TR;
  // Vách: không đi lên mặt cao hơn bước chân (B12)
  const gNew = map.ground(nx, nz);
  if (gNew !== null && gNew > Math.max(p.pos[1], ny) + W.step_up) {
    nx = p.pos[0];
    nz = p.pos[2];
  }
  // Tháp chuông: không xuyên qua
  const tw = map.tower;
  if (tw && Math.hypot(nx, nz) < tw.r && ny < tw.top) {
    const r = Math.hypot(nx, nz);
    const [ux, uz] = r > EPS ? [nx / r, nz / r] : [0, -1];
    nx = ux * tw.r;
    nz = uz * tw.r;
  }
  const gy = map.ground(nx, nz);
  let grounded = false;
  if (gy !== null && vy <= 0 && ny <= gy + EPS) {
    ny = gy;
    grounded = true;
  } else if (gy !== null && wasGrounded && vy <= 0 && ny - gy <= W.snap_down) {
    ny = gy;
    grounded = true;
  }
  if (grounded) {
    vy = 0;
    p.launch = null;
  }
  p.pos = [nx, ny, nz];
  p.grounded = grounded;
  // Bục nhảy: chân chạm bục → bắn lên
  if (grounded) {
    for (const pad of map.pads) {
      if (distXZ(p.pos, pad.pos) <= pad.radius + EPS && Math.abs(p.pos[1] - pad.pos[1]) < 0.05) {
        vy = pad.vy;
        p.launch = [...pad.vel];
        p.grounded = false;
        break;
      }
    }
  }
  p.vel = [hx, vy, hz];

  if (p.pos[1] < W.fall_y) {
    p.flames = Math.max(0, p.flames - 1);
    const lost = p.carried;
    p.carried = 0;
    p.dashTicks = 0;
    p.launch = null;
    p.vel = [0, 0, 0];
    emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
    if (p.flames > 0) p.fallWaitTicks = W.fall_wait_ticks;
    else p.fallWaitTicks = 1e9; // thua ngay ở bước 11, không hồi sinh
  }
}

function endGame(g, result, reason, emit) {
  if (result === 'won') {
    g.score += TUNING.score.per_second_left * Math.floor(Math.max(0, g.timeLeftTicks) / TR);
    g.score += TUNING.score.per_flame_left * g.player.flames;
  }
  if (result !== 'won') g.timeLeftTicks = Math.max(0, g.timeLeftTicks);
  g.state = result;
  g.result = result;
  g.reason = reason;
  emit('game_over', { result, reason });
}

export function snapshot(g) {
  const p = g.player;
  const s3 = (v) => v.map(round3);
  return {
    type: 'snapshot',
    tick: g.tick,
    sim_tick: g.simTick,
    night: g.night,
    state: g.state === 'playing' && g.paused ? 'paused' : g.state,
    time_left_s: round3(Math.max(0, g.timeLeftTicks) / TR),
    score: g.score,
    wind: { active: g.wind.active, dir_deg: g.wind.active ? g.wind.dirDeg : null },
    player: {
      pos: s3(p.pos),
      vel: s3(p.vel),
      grounded: p.grounded,
      invuln: p.invulnTicks > 0,
      flames: p.flames,
      carried: p.carried,
      dash_cd_s: round3(p.dashCdTicks / TR),
      pulse_cd_s: round3(p.pulseCdTicks / TR),
      charm_s: round3(p.charmTicks / TR),
    },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: s3(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: g.shades.map((s) => ({ id: s.id, pos: s3(s.pos), state: shadeState(s) })),
    motes_active: g.motes.length,
    motes: byId(g.motes).map((m) => ({ id: m.id, pos: s3(m.pos), kind: m.kind, ttl_s: m.kind === 'dropped' ? round3(m.ttl / TR) : null })),
    drifters: g.drifters.map((d) => ({ id: d.id, pos: s3(d.pos), state: d.state, stolen: d.stolen })),
    charms: g.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: round3(c.available ? 0 : c.respawnTicks / TR) })),
  };
}
