// 可注入种子的轻量 RNG（mulberry32），战斗/掉落/词缀都用它；node 测试可复现。
export function createRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function rollChance(rng, pct) { return rng() * 100 < pct; }
export function rollRange(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
