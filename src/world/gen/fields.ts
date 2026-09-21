/**
 * The road as three continuous fields over distance: curvature, grade, width.
 *
 * Pure functions of `(seed, s)`. Nothing here integrates, accumulates or
 * remembers, so any point on the road can be evaluated without having
 * generated what precedes it — which is what lets traffic spawn a kilometre
 * ahead and makes a seed plus a distance a complete description of a place.
 *
 * No three.js, no DOM. See contracts/README.md.
 */

import { clamp, smoothstep } from '../../core/math.js';
import { fbm1, type FbmOptions } from '../../core/rng.js';
import { ROAD } from '../tuning.js';
import { curvatureFromEvents, gradeFromEvents, straightnessAt } from './events.js';

/** Seed offsets, so the three fields never correlate with one another. */
const SEED_CURVATURE = 0;
const SEED_GRADE = 7919;
const SEED_GRADE_LONG = 11939;
const SEED_WIDTH = 15731;

const CURVATURE_FBM: FbmOptions = {
  octaves: ROAD.CURVATURE_OCTAVES,
  lacunarity: 2.1,
  gain: 0.45,
};
const GRADE_FBM: FbmOptions = { octaves: ROAD.GRADE_OCTAVES, lacunarity: 2.0, gain: 0.5 };

/**
 * Signed curvature at distance `s`, in 1/metres. Positive curves right.
 *
 * Three things stacked, in order of importance:
 *  1. layered noise — the road's general wanderiness;
 *  2. a straightness mask, which flattens the noise where an event wants a
 *     straight, so a straight is genuinely straight rather than merely less
 *     bendy;
 *  3. event curvature — the hairpins and sweepers, added on top.
 */
export function curvatureAt(s: number, seed: number): number {
  const noise = shapeNoise(fbm1(s / ROAD.CURVATURE_SCALE_M, seed + SEED_CURVATURE, CURVATURE_FBM));
  const base = noise * ROAD.CURVATURE_AMPLITUDE * straightnessAt(s, seed);
  return base + curvatureFromEvents(s, seed);
}

/**
 * Pushes the middle of the noise distribution outward without moving its ends.
 * Sign-preserving, so it cannot turn a left-hander into a right-hander, and
 * it leaves ±1 exactly where it was.
 */
function shapeNoise(n: number): number {
  return Math.sign(n) * Math.pow(Math.abs(n), ROAD.CURVATURE_SHAPE);
}

/** Rise over run at distance `s`. Positive climbs. */
export function gradeAt(s: number, seed: number): number {
  const noise = fbm1(s / ROAD.GRADE_SCALE_M, seed + SEED_GRADE, GRADE_FBM);
  const long = fbm1(s / ROAD.GRADE_LONG_SCALE_M, seed + SEED_GRADE_LONG, {
    octaves: 2,
    lacunarity: 2,
    gain: 0.42,
  });
  const raw =
    noise * ROAD.GRADE_AMPLITUDE +
    long * ROAD.GRADE_LONG_AMPLITUDE +
    gradeFromEvents(s, seed);
  return clamp(raw, -ROAD.MAX_GRADE, ROAD.MAX_GRADE);
}

/**
 * Half-width of the tarmac at `s`, metres.
 *
 * Varies slowly and never much: a road that visibly changes width is a road
 * that looks like a bug. This mostly exists so that biome blending in Phase 3
 * has somewhere to put a narrow mountain road and a wide desert highway.
 */
export function halfWidthAt(s: number, seed: number): number {
  const noise = fbm1(s / ROAD.WIDTH_SCALE_M, seed + SEED_WIDTH, { octaves: 2, lacunarity: 2, gain: 0.5 });
  return ROAD.HALF_WIDTH_M + noise * ROAD.HALF_WIDTH_VARIATION_M;
}

/**
 * Camber at `s`, radians. Positive banks into a right-hand corner.
 *
 * Proportional to curvature and capped. Real roads are superelevated into
 * corners; the cap is because at phone scale a strongly banked road reads as
 * the horizon falling over rather than as a banked road.
 */
export function bankAt(s: number, seed: number): number {
  const raw = curvatureAt(s, seed) * ROAD.BANK_PER_CURVATURE;
  return clamp(raw, -ROAD.BANK_MAX, ROAD.BANK_MAX);
}

/**
 * How hard the road is working at `s`, 0..1 — a rough "is this an interesting
 * bit" measure combining curvature and grade.
 *
 * Not used by the generator itself. It exists for the systems that want to
 * know whether now is a good moment for something: where to put a viewpoint,
 * where traffic should thin out, where the music would swell if this game had
 * any.
 */
export function intensityAt(s: number, seed: number): number {
  const curve = Math.abs(curvatureAt(s, seed)) / ROAD.CURVATURE_AMPLITUDE;
  const slope = Math.abs(gradeAt(s, seed)) / ROAD.GRADE_AMPLITUDE;
  return smoothstep(curve * 0.7 + slope * 0.3);
}
