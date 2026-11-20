// Kiểm tra định dạng file inputs / scenario theo Test Contract v1.1 (v1.0 + mục Phần 4 của Ticket-02).
// Sai định dạng → ném FormatError (headless thoát mã 2).

export class FormatError extends Error {}

export const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];
export const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned'];
export const DRIFTER_STATES = ['idle', 'chase', 'flee', 'removed'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
const isCount = (v) => Number.isInteger(v) && v >= 0;

function fail(msg) {
  throw new FormatError(msg);
}

export function createInputState() {
  return { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
}

// Mỗi frame chỉ đổi các trường có mặt.
export function applyFrame(state, frame) {
  if ('move' in frame) state.move = [frame.move[0], frame.move[1]];
  if ('cam_yaw_deg' in frame) state.cam_yaw_deg = frame.cam_yaw_deg;
  for (const b of BUTTONS) if (b in frame) state[b] = frame[b];
}

export function validateInputs(obj) {
  if (!isObj(obj)) fail('inputs: phải là một đối tượng JSON');
  if (!Array.isArray(obj.frames)) fail('inputs: thiếu mảng "frames"');
  let prev = -1;
  obj.frames.forEach((f, i) => {
    const where = `inputs.frames[${i}]`;
    if (!isObj(f)) fail(`${where}: phải là đối tượng`);
    if (!Number.isInteger(f.tick) || f.tick < 0) fail(`${where}.tick: phải là số nguyên ≥ 0`);
    if (f.tick <= prev) fail(`${where}.tick: phải tăng nghiêm ngặt (${f.tick} sau ${prev})`);
    prev = f.tick;
    if ('move' in f) {
      const m = f.move;
      if (!Array.isArray(m) || m.length !== 2 || !m.every(isNum)) fail(`${where}.move: phải là [x, z]`);
      if (m.some((c) => c < -1 || c > 1)) fail(`${where}.move: mỗi thành phần trong [-1, 1]`);
    }
    if ('cam_yaw_deg' in f && !isNum(f.cam_yaw_deg)) fail(`${where}.cam_yaw_deg: phải là số`);
    for (const b of BUTTONS) if (b in f && typeof f[b] !== 'boolean') fail(`${where}.${b}: phải là boolean`);
  });
  return obj.frames;
}

const posEntry = (m) => isVec3(m) || (isObj(m) && isVec3(m.pos) && (!('id' in m) || typeof m.id === 'string'));

export function validateScenario(obj, lanternCount = 5) {
  if (!isObj(obj)) fail('scenario: phải là một đối tượng JSON');
  const ids = Array.from({ length: lanternCount }, (_, i) => `L${i + 1}`);
  if ('player' in obj) {
    const p = obj.player;
    if (!isObj(p)) fail('scenario.player: phải là đối tượng');
    if ('pos' in p && !isVec3(p.pos)) fail('scenario.player.pos: phải là [x, y, z]');
    for (const k of ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks']) {
      if (k in p && !isCount(p[k])) fail(`scenario.player.${k}: số nguyên ≥ 0`);
    }
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) {
    if (k in obj && typeof obj[k] !== 'boolean') fail(`scenario.${k}: phải là boolean`);
  }
  if ('motes' in obj) {
    if (!Array.isArray(obj.motes)) fail('scenario.motes: phải là mảng');
    obj.motes.forEach((m, i) => {
      if (!posEntry(m)) fail(`scenario.motes[${i}]: phải là [x, y, z]`);
      if (isObj(m) && 'kind' in m && !['random', 'dropped'].includes(m.kind)) fail(`scenario.motes[${i}].kind`);
    });
  }
  if ('shades' in obj) {
    if (!Array.isArray(obj.shades)) fail('scenario.shades: phải là mảng');
    obj.shades.forEach((s, i) => {
      if (!posEntry(s)) fail(`scenario.shades[${i}]: phải là { "pos": [x, y, z] }`);
      if (isObj(s) && 'state' in s && !SHADE_STATES.includes(s.state)) fail(`scenario.shades[${i}].state: một trong ${SHADE_STATES}`);
      if (isObj(s) && 'state_ticks_left' in s && !isCount(s.state_ticks_left)) fail(`scenario.shades[${i}].state_ticks_left`);
    });
  }
  if ('drifters' in obj) {
    if (!Array.isArray(obj.drifters)) fail('scenario.drifters: phải là mảng');
    obj.drifters.forEach((d, i) => {
      if (!posEntry(d)) fail(`scenario.drifters[${i}]: phải là { "pos": [x, y, z] }`);
      if (isObj(d) && 'state' in d && !DRIFTER_STATES.includes(d.state)) fail(`scenario.drifters[${i}].state`);
      if (isObj(d) && 'stolen' in d && !isCount(d.stolen)) fail(`scenario.drifters[${i}].stolen`);
    });
  }
  if ('charms' in obj) {
    if (!Array.isArray(obj.charms)) fail('scenario.charms: phải là mảng');
    obj.charms.forEach((c, i) => {
      if (!posEntry(c)) fail(`scenario.charms[${i}]: phải là { "pos": [x, y, z] }`);
      if (isObj(c) && 'available' in c && typeof c.available !== 'boolean') fail(`scenario.charms[${i}].available`);
      if (isObj(c) && 'respawn_ticks' in c && !isCount(c.respawn_ticks)) fail(`scenario.charms[${i}].respawn_ticks`);
    });
  }
  if ('lanterns' in obj) {
    if (!Array.isArray(obj.lanterns)) fail('scenario.lanterns: phải là mảng');
    obj.lanterns.forEach((l, i) => {
      const where = `scenario.lanterns[${i}]`;
      if (!isObj(l)) fail(`${where}: phải là đối tượng`);
      if (!ids.includes(l.id)) fail(`${where}.id: phải là một trong ${ids.join(', ')}`);
      if ('pos' in l && !isVec3(l.pos)) fail(`${where}.pos: phải là [x, y, z]`);
      if ('deposited' in l && !isCount(l.deposited)) fail(`${where}.deposited: số nguyên ≥ 0`);
      if ('lit' in l && typeof l.lit !== 'boolean') fail(`${where}.lit: phải là boolean`);
    });
  }
  if ('time_left_s' in obj && !(isNum(obj.time_left_s) && obj.time_left_s >= 0)) fail('scenario.time_left_s: số ≥ 0');
  return obj;
}
