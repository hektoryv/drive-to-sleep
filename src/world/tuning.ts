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

export const SKY = {
  /** Sky shell radius. Must exceed the furthest ridge layer. */
  RADIUS_M: 6000,
  /** How fast the cloud decks slide, in noise units per second. Very slow. */
  CLOUD_DRIFT: 0.0035,
} as const;

/**
 * Distant mountain layers (ADR-0003). Four silhouettes at increasing
 * distance, each washed further toward the sky colour.
 */
export const RIDGES = {
  LAYERS: 4,
  /** Vertical strips per layer. More = finer crests, linearly more cost. */
  COLUMNS: 192,
  NEAREST_M: 1400,
  FURTHEST_M: 5200,
  /**
   * Peak height above the horizon plane, near layer and far layer. The near
   * layer at 420 m and 1.4 km away subtends about 17°, which is a proper
   * mountain rather than a bump on the skyline.
   */
  HEIGHT_NEAR_M: 420,
  HEIGHT_FAR_M: 1500,
  /**
   * Metres per noise unit. Has to be well under the layer radius or the whole
   * ring falls inside one noise period and the range comes out as a single
   * bulge — larger is *not* lazier here, it is flatter.
   */
  SCALE_M: 620,
  /** How far the curtain hangs below the horizon, covering the terrain's edge. */
  SKIRT_M: 700,
  /** Height over which a ridge's base washes into haze. */
  BASE_FADE_M: 55,
} as const;

export const TIME = {
  /** Seconds for one full dawn-to-dawn cycle. ~25 minutes. */
  CYCLE_SECONDS: 25 * 60,
  /** Where the cycle starts on a fresh drive. 0 = midnight, 0.25 = dawn. */
  START_PHASE: 0.27,
} as const;

export const DAY = {
  /** Sun elevation at noon, radians. A mid-latitude sun, not a tropical one. */
  MAX_SUN_ELEVATION: 62 * DEG,
  /**
   * Where the sun sits at dawn. Chosen so golden hour puts it ahead and
   * slightly left of a car heading down -Z, which is the art target's
   * composition. The azimuth sweeps a full turn per day from here.
   */
  SUN_AZIMUTH_BASE: 0.63,
} as const;
