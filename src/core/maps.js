// Bản đồ chuẩn 3 Đêm (Ticket-02 Phần 2). Góc đo từ +X, ngược chiều kim đồng hồ nhìn từ trên: x = r·cos, z = r·sin.
const r3 = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? 0 : r;
};
function ring(r, startDeg, stepDeg, count, y = 0, cx = 0, cz = 0) {
  return Array.from({ length: count }, (_, i) => {
    const a = ((startDeg + i * stepDeg) * Math.PI) / 180;
    return [r3(cx + r * Math.cos(a)), y, r3(cz + r * Math.sin(a))];
  });
}
function padToward(pos, target, vy, speed) {
  const dx = target[0] - pos[0];
  const dz = target[2] - pos[2];
  const d = Math.hypot(dx, dz);
  return { pos, radius: 1, vy, vel: [(dx / d) * speed, (dz / d) * speed] };
}

export const MAPS = {
  1: {
    night: 1,
    name: 'Đảo Bến',
    duration_s: 240,
    start: [0, 0, 0],
    shadeSpeed: 4,
    shadeEvery: 480,
    shadeMax: 6,
    drifters: false,
    wind: false,
    lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
    motePoints: [...ring(12, 0, 45, 8), ...ring(33, 0, 22.5, 16)],
    shadePoints: ring(37, 15, 30, 12, 1),
    charms: [],
    pads: [],
    tower: null,
    ground(x, z) {
      return Math.hypot(x, z) <= 40 ? 0 : null;
    },
  },
  2: {
    night: 2,
    name: 'Đảo Cau',
    duration_s: 270,
    start: [0, 0, 0],
    shadeSpeed: 4,
    shadeEvery: 420,
    shadeMax: 8,
    drifters: true,
    wind: false,
    lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
    motePoints: [...ring(10, 0, 90, 4), ...ring(22, 0, 45, 8), ...ring(10, 0, 90, 4, 0, 70, 0), ...ring(22, 0, 45, 8, 0, 70, 0)],
    shadePoints: [...ring(26, 22.5, 45, 8, 1), ...ring(26, 22.5, 45, 8, 1, 70, 0)],
    charms: [[35, 0, 0]],
    pads: [padToward([20, 0, 18], [70, 0, 0], 14, 24), padToward([50, 0, -18], [0, 0, 0], 14, 24)],
    tower: null,
    ground(x, z) {
      if (Math.hypot(x, z) <= 28 || Math.hypot(x - 70, z) <= 28) return 0;
      if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0;
      return null;
    },
  },
  3: {
    night: 3,
    name: 'Đảo Chuông',
    duration_s: 300,
    start: [0, 0, -20], // B11
    shadeSpeed: 4.5,
    shadeEvery: 360,
    shadeMax: 10,
    drifters: true,
    wind: true,
    lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
    motePoints: [...ring(34, 0, 20, 18, 0), ...ring(18, 20, 20, 8, 3), ...ring(5, 45, 90, 4, 6)],
    shadePoints: ring(43, 0, 22.5, 16, 1),
    charms: [[30, 0, 25], [-30, 0, 25]],
    pads: [{ pos: [0, 3, 13], radius: 1, vy: 12, vel: [0, -8] }],
    tower: { r: 2, top: 14 },
    ground(x, z) {
      const r = Math.hypot(x, z);
      if (r > 45) return null;
      let h = 0;
      if (r <= 8) h = 6;
      else if (z > 0 && r >= 12 && r <= 24) h = 3;
      for (const deg of [30, 150]) {
        const a = (deg * Math.PI) / 180;
        const s = x * Math.cos(a) + z * Math.sin(a);
        const p = -x * Math.sin(a) + z * Math.cos(a);
        if (s >= 24 && s <= 30 && Math.abs(p) <= 1.5) h = Math.max(h, (3 * (30 - s)) / 6);
      }
      return h;
    },
  },
};
