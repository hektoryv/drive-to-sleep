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

/**
 * Telegraph poles and their wires.
 *
 * The roadside's *near-field* speed cue. Vegetation starts 7.5 m out because a
 * maintained verge is bare, which means nothing sweeps past close to the car —
 * and something passing close is most of what makes speed felt rather than
 * read. Every driving game since 1982 has had these, for this reason.
 */
export const ROADSIDE = {
  /**
   * Stations between poles. At 4 m spacing, 10 is a pole every 40 m — about
   * 1.4 s apart at 100 km/h. Fewer = a faster, busier rhythm; too few and it
   * becomes a picket fence.
   */
  POLE_EVERY_STATIONS: 10,
  /** Distance from the centreline, metres. Inside the vegetation, outside the verge. */
  POLE_OFFSET_M: 8.2,
  POLE_HEIGHT_M: 8.4,
  /** Variation in height, metres, so the line is not laser-straight. */
  POLE_HEIGHT_VARIATION_M: 0.6,
  /** Quad width as a multiple of height. Only has to contain the crossarm. */
  POLE_ASPECT: 0.34,

  /** Wires strung between consecutive poles. */
  WIRE_COUNT: 3,
  /** Crossarm half-span, metres — how far the outer wires sit from the post. */
  WIRE_SPAN_M: 0.62,
  /** Height of the crossarm as a fraction of the pole. */
  WIRE_HEIGHT: 0.86,
  /** How far a wire sags at mid-span, metres. Higher = older, more forgotten. */
  WIRE_SAG_M: 0.85,
  /** Segments per span. Enough that the catenary is a curve, not a vee. */
  WIRE_SEGMENTS: 7,

  // --- chevron signs ---
  //
  // The only piece of information the game gives the player in advance, and it
  // is given as scenery rather than as interface. There is no HUD to warn you
  // a corner is tight (docs/01-design.md §6), so the corner has to say so
  // itself — which is exactly what chevrons are for on a real road.

  /**
   * Curvature, 1/metres, above which a corner gets chevrons. 1/150 is a 150 m
   * radius. Lower threshold = signs on gentler bends, and the warning stops
   * meaning anything.
   */
  CHEVRON_MIN_CURVATURE: 1 / 150,
  /** Stations between signs through a marked corner. 4 is one every 16 m. */
  CHEVRON_EVERY_STATIONS: 4,
  /** Distance from the centreline, metres. Outside the verge, inside the poles. */
  CHEVRON_OFFSET_M: 6.9,
  /** Plate size and the height of its bottom edge above the ground, metres. */
  CHEVRON_WIDTH_M: 0.95,
  CHEVRON_PLATE_M: 0.78,
  CHEVRON_POST_M: 0.95,
} as const;

/**
 * Roadside vegetation — the dark shrub clusters the art target is full of.
 *
 * Billboards, per ADR-0003's 2.5D half. Everything here trades between a
 * roadside that feels inhabited and one that costs a frame.
 */
export const VEGETATION = {
  /**
   * Candidate plants per station, each one either placed or skipped. With
   * 4 m stations this is the *ceiling* on density, not the density.
   */
  PER_STATION: 3,
  /**
   * Fraction of candidates that survive, at the thickest. Lower = sparser
   * everywhere; the clumping comes from COVER_SCALE_M, not from here.
   */
  COVER_MAX: 0.62,
  /** Floor, so a clearing is a clearing and not a desert. */
  COVER_MIN: 0.06,
  /**
   * Metres over which cover rises and falls. Long enough that you drive
   * through a thicket and out the other side rather than past a texture.
   */
  COVER_SCALE_M: 260,

  /** Nearest and furthest a plant may stand from the centreline, metres. */
  NEAR_M: 7.5,
  FAR_M: 90,
  /**
   * Bias on the lateral distribution. Above 1 pushes plants outward, which
   * keeps the verge clear and the middle distance full.
   */
  LATERAL_BIAS: 1.7,

  /** Size range, metres. Width is derived from height. */
  MIN_HEIGHT_M: 1.1,
  MAX_HEIGHT_M: 3.4,
  /** Width as a multiple of height. Above 1 = squat and shrubby. */
  ASPECT: 1.15,
  /** Fraction that are the tall narrow kind rather than a mound. */
  SPIRE_FRACTION: 0.18,

  /**
   * How far a plant sinks into the ground, as a fraction of its height. A
   * billboard standing exactly on the surface shows a hard straight edge
   * where it meets the ground on a slope.
   */
  SINK: 0.06,
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
