/**
 * World generation constants. Owned by the `world` domain.
 *
 * Nothing outside `world/` reads this file. The rest of the game sees the road
 * through `contracts/world.ts` and has no idea how any of it is made.
 */

import { DEG } from '../core/math.js';

export const ROAD = {
  /** Centreline sample spacing, metres. Smaller = smoother road, more memory. */
  STATION_SPACING_M: 4,
  /** Stations per chunk. 128 × 4 m ≈ 512 m. */
  STATIONS_PER_CHUNK: 128,
  /** Live chunks kept behind and ahead of the player. */
  CHUNKS_BEHIND: 2,
  CHUNKS_AHEAD: 10,

  /**
   * Curvature noise. `SCALE` is metres per noise unit — larger means longer,
   * lazier corners. `AMPLITUDE` is peak 1/radius, so 1/250 m is the tightest
   * the noise alone will bend.
   */
  CURVATURE_SCALE_M: 340,
  CURVATURE_AMPLITUDE: 1 / 250,
  CURVATURE_OCTAVES: 3,
  /**
   * Shaping exponent on the curvature noise, applied before the amplitude.
   *
   * Raw fbm spends most of its time near zero — measured over 20 km it left
   * 57% of the road straighter than a 1.6 km radius, which is the same
   * "no rhythm" failure as all-medium-corners seen from the other side.
   * An exponent below 1 pushes typical values outward while leaving the peaks
   * where they are, so the road gets more middling corners without the
   * hairpins becoming absurd.
   *
   * Lower = busier road, fewer places to rest. 1.0 = raw noise.
   */
  CURVATURE_SHAPE: 0.62,

  /**
   * Grade noise. Gentler and much longer wavelength than curvature — hills are
   * a bigger feature than corners. 0.075 is a 7.5% gradient at the extreme.
   */
  GRADE_SCALE_M: 900,
  GRADE_AMPLITUDE: 0.075,
  GRADE_OCTAVES: 2,

  /** Road half-width, metres, and how much it varies. */
  HALF_WIDTH_M: 3.6,
  HALF_WIDTH_VARIATION_M: 0.7,
  WIDTH_SCALE_M: 1300,

  /**
   * Banking. Real roads bank into corners; the amount is proportional to
   * curvature up to a cap. Higher = more dramatic, easier to over-do.
   */
  BANK_PER_CURVATURE: 190,
  BANK_MAX: 6 * DEG,

  /** Shoulder and verge widths either side of the tarmac, metres. */
  SHOULDER_M: 0.8,
  VERGE_M: 6.0,

  /** Painted line half-widths, metres. */
  CENTRE_LINE_M: 0.08,
  EDGE_LINE_M: 0.06,
} as const;

/**
 * Road events — hand-authored shapes injected on top of the noise.
 *
 * This is the anti-monotony mechanism and the highest-leverage place to spend
 * tuning time. Pure noise produces a road with no rhythm: all medium corners,
 * no straights, nothing to anticipate. Events give it punctuation.
 */
export const EVENTS = {
  /** Mean distance between events, metres, and how much that varies. */
  SPACING_M: 620,
  SPACING_JITTER_M: 260,
  /** An event's influence fades in and out over this distance, metres. */
  BLEND_M: 90,
} as const;

export const TERRAIN = {
  /** How far the terrain ribbon extends either side of the road, metres. */
  WIDTH_M: 260,
  /** Lateral samples per station across that width. */
  SAMPLES_ACROSS: 10,
  /** Height noise, metres and scale. */
  RELIEF_M: 34,
  RELIEF_SCALE_M: 420,
  /**
   * How far from the road the terrain is held flat before relief takes over.
   * Without this, hills push through the tarmac.
   */
  FLAT_MARGIN_M: 14,
  BLEND_M: 45,
} as const;

export const TIME = {
  /** Seconds for one full dawn-to-dawn cycle. ~25 minutes. */
  CYCLE_SECONDS: 25 * 60,
  /** Where the cycle starts on a fresh drive. 0 = midnight, 0.25 = dawn. */
  START_PHASE: 0.27,
} as const;
