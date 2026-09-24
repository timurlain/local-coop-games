/** Seeded PRNG state. Stored inside game state so the whole game stays deterministic. */
export interface RngState {
  s: number;
}

export function makeRng(seed: number): RngState {
  return { s: seed >>> 0 };
}

/** mulberry32 — returns a float in [0, 1) and advances the state. */
export function rand(r: RngState): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(r: RngState, maxExclusive: number): number {
  return Math.floor(rand(r) * maxExclusive);
}

export function pick<T>(r: RngState, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick from empty array');
  return items[randInt(r, items.length)];
}

export function shuffle<T>(r: RngState, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(r, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Non-deterministic seed for a fresh game (the only Math.random in game code paths). */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
