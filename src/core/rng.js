// mulberry32: PRNG nhỏ, tất định theo seed. Mọi ngẫu nhiên của game phải đi qua đây.
export function createRng(seed) {
  let a = (Number(seed) >>> 0) ^ 0x9e3779b9;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
