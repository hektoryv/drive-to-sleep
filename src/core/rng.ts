/**
 * Seeded randomness and noise.
 *
 * Everything here is either an explicit stateful stream (`Rng`) or a pure
 * hash-based function of its coordinates. There is no global random state and
 * nothing calls Math.random().
 *
 * The hash-based noise is the important part: it lets any point in the world
 * be evaluated without having generated what came before it. That is what
 * makes the world a pure function of (seed, distance) — ADR-0002 — so traffic
 * can spawn a kilometre ahead, a resume point is just a seed and a distance,
 * and "that corner at 47.3 km felt wrong" is a reproducible bug report.
 */

import { smootherstep } from './math.js';

// ---------------------------------------------------------------------------
// Integer hashing
// ---------------------------------------------------------------------------

/** 32-bit integer avalanche hash. Fast, well-distributed, no tables. */
export function hashU32(x: number): number {
  let h = x | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

export function hash2U32(x: number, y: number): number {
  return hashU32((x | 0) ^ Math.imul(y | 0, 0x9e3779b1));
}

export function hash3U32(x: number, y: number, z: number): number {
  return hashU32((x | 0) ^ Math.imul(y | 0, 0x9e3779b1) ^ Math.imul(z | 0, 0x85ebca6b));
}

/** Hash to [0, 1). */
export function hash01(x: number, seed: number): number {
  return hash2U32(x, seed) / 4294967296;
}

/** Hash to [-1, 1). */
export function hash11(x: number, seed: number): number {
  return hash01(x, seed) * 2 - 1;
}

export function hash2D01(x: number, y: number, seed: number): number {
  return hash3U32(x, y, seed) / 4294967296;
}

// ---------------------------------------------------------------------------
// Stateful stream
// ---------------------------------------------------------------------------

/**
 * A seeded random stream (mulberry32). Use where a *sequence* is wanted and
 * the order is part of the meaning — shuffling a prop table, picking a
 * traffic colour. For anything addressed by position, use the noise functions
 * instead, so it stays evaluable out of order.
 */
export interface Rng {
  /** Next value in [0, 1). */
  next(): number;
  /** Next value in [lo, hi). */
  range(lo: number, hi: number): number;
  /** Next integer in [lo, hi). */
  int(lo: number, hi: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  /** Current internal state — capture it to resume the stream later. */
  state(): number;
}

export function makeRng(seed: number): Rng {
  let s = hashU32(seed);
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo)),
    chance: (p) => next() < p,
    state: () => s,
  };
}

// ---------------------------------------------------------------------------
// Value noise
// ---------------------------------------------------------------------------

/** 1D value noise in [-1, 1]. Smooth, cheap, slightly blobby. */
export function valueNoise1(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = smootherstep(f);
  const a = hash11(i, seed);
  const b = hash11(i + 1, seed);
  return a + (b - a) * u;
}

/** 2D value noise in [-1, 1]. */
export function valueNoise2(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = smootherstep(fx);
  const uy = smootherstep(fy);

  const n00 = hash2D01(ix, iy, seed) * 2 - 1;
  const n10 = hash2D01(ix + 1, iy, seed) * 2 - 1;
  const n01 = hash2D01(ix, iy + 1, seed) * 2 - 1;
  const n11 = hash2D01(ix + 1, iy + 1, seed) * 2 - 1;

  const nx0 = n00 + (n10 - n00) * ux;
  const nx1 = n01 + (n11 - n01) * ux;
  return nx0 + (nx1 - nx0) * uy;
}

// ---------------------------------------------------------------------------
// Gradient (Perlin-style) noise
//
// Preferred over value noise for terrain and for the road's curvature field:
// it has no axis-aligned bias and its zero crossings sit on the lattice, which
// produces more natural-feeling shapes.
// ---------------------------------------------------------------------------

/** 1D gradient noise, roughly [-1, 1]. */
export function gradNoise1(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = smootherstep(f);
  const g0 = hash11(i, seed);
  const g1 = hash11(i + 1, seed);
  const n0 = g0 * f;
  const n1 = g1 * (f - 1);
  return 2 * (n0 + (n1 - n0) * u);
}

/** 2D gradient noise, roughly [-1, 1]. */
export function gradNoise2(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = smootherstep(fx);
  const uy = smootherstep(fy);

  const d00 = dotGrad2(ix, iy, fx, fy, seed);
  const d10 = dotGrad2(ix + 1, iy, fx - 1, fy, seed);
  const d01 = dotGrad2(ix, iy + 1, fx, fy - 1, seed);
  const d11 = dotGrad2(ix + 1, iy + 1, fx - 1, fy - 1, seed);

  const x0 = d00 + (d10 - d00) * ux;
  const x1 = d01 + (d11 - d01) * ux;
  return (x0 + (x1 - x0) * uy) * 1.4142;
}

function dotGrad2(ix: number, iy: number, dx: number, dy: number, seed: number): number {
  // A random unit gradient from the lattice hash.
  const a = hash2D01(ix, iy, seed) * Math.PI * 2;
  return Math.cos(a) * dx + Math.sin(a) * dy;
}

// ---------------------------------------------------------------------------
// Fractal sums
// ---------------------------------------------------------------------------

export interface FbmOptions {
  /** Number of layers. More = more fine detail, linearly more cost. */
  octaves: number;
  /** Frequency multiplier per octave. ~2 is standard. */
  lacunarity: number;
  /** Amplitude multiplier per octave. ~0.5 is standard; higher = rougher. */
  gain: number;
}

export const DEFAULT_FBM: FbmOptions = { octaves: 4, lacunarity: 2.0, gain: 0.5 };

/**
 * Fractal Brownian motion over 1D gradient noise, normalised to about [-1, 1].
 * This is the backbone of the road's curvature and grade fields.
 */
export function fbm1(x: number, seed: number, opts: FbmOptions = DEFAULT_FBM): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < opts.octaves; o++) {
    sum += gradNoise1(x * freq, seed + o * 1013) * amp;
    norm += amp;
    amp *= opts.gain;
    freq *= opts.lacunarity;
  }
  return norm > 0 ? sum / norm : 0;
}

/** Fractal Brownian motion over 2D gradient noise, normalised to about [-1, 1]. */
export function fbm2(x: number, y: number, seed: number, opts: FbmOptions = DEFAULT_FBM): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < opts.octaves; o++) {
    sum += gradNoise2(x * freq, y * freq, seed + o * 1013) * amp;
    norm += amp;
    amp *= opts.gain;
    freq *= opts.lacunarity;
  }
  return norm > 0 ? sum / norm : 0;
}

/**
 * Ridged fractal noise in [0, 1] — sharp crests, smooth valleys.
 * Earmarked for mountain silhouettes in Phase 3.
 */
export function ridged1(x: number, seed: number, opts: FbmOptions = DEFAULT_FBM): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < opts.octaves; o++) {
    sum += (1 - Math.abs(gradNoise1(x * freq, seed + o * 1013))) * amp;
    norm += amp;
    amp *= opts.gain;
    freq *= opts.lacunarity;
  }
  return norm > 0 ? sum / norm : 0;
}
