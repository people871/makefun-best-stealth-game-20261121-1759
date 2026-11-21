// SHADOW LANTERN — a tiny seeded random number generator.
// mulberry32: deterministic for a fixed seed, so a staged screenshot
// (?shot=…&seed=1) renders the same fireflies and sparkles every run.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick a stable integer in [min, max] from a seeded stream.
export function randomInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Shuffle a copy of an array with a seeded stream (Fisher–Yates).
export function shuffled(rng, items) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
