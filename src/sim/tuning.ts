/**
 * Every constant that affects how the game feels or looks.
 *
 * The rule (docs/05-conventions.md): nothing that shapes feel or look is
 * written inline in logic. It lives here, named, with a comment saying which
 * direction makes it *more* of something — because tuning happens in a loop of
 * change-look-change, and a constant buried on line 214 of vehicle.ts is a
 * constant that never gets tuned.
 *
 * This module is pure data. It imports nothing and must stay that way.
 *
 * Phase 0 populates only what Phase 0 uses. Sections are stubbed with the
 * values from docs/01-design.md so the shape is visible, and are marked where
 * they are not yet wired up.
 */

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

export const SIM = {
  /** Fixed simulation rate. See ADR-0002 — do not make this variable. */
  STEP_HZ: 120,
  /** Sub-step cap per frame before the backlog is dropped. */
  MAX_SUB_STEPS: 8,
} as const;

// ---------------------------------------------------------------------------
// View framing (portrait)
//
// These four bands stack to 1.0 and describe how the display is divided.
// See docs/02-art-direction.md for the reasoning and the diagram.
//
// Live values, tuned by screenshot. Phase 4 finalises them against the real
// cockpit geometry — until then the bands are drawn as flat placeholder blocks.
// ---------------------------------------------------------------------------

export const VIEW = {
  /** Top strip: rear-view mirror and the distance readout. */
  HEADER_FRACTION: 0.05,
  /** The windscreen aperture — the only band the 3D world is drawn into. */
  APERTURE_FRACTION: 0.38,
  /** Dash top and the five-dial binnacle. */
  DASH_FRACTION: 0.22,
  /** The wheel. Its bottom runs off the screen; we see the top two-thirds. */
  WHEEL_FRACTION: 0.35,

  /**
   * Horizontal field of view. Specified horizontally, not vertically, so that
   * changing the aperture's proportions never changes how far into a corner
   * you can see — which is the property that matters for driving. Vertical FOV
   * is derived from this and the aperture's aspect ratio.
   *
   * Larger = wider, more speed sensation, more distortion, less compression.
   * Smaller = longer lens, mountains read as larger, calmer horizon.
   */
  H_FOV: 52 * DEG,

  /**
   * Where the horizon sits within the aperture, as a fraction from its top.
   * Above 0.5 means more sky than road, which is where the mood lives.
   * Implemented as a camera pitch offset, so it costs nothing.
   */
  HORIZON_Y: 0.62,

  /** Driver's eye height above the road surface, metres. */
  EYE_HEIGHT: 1.12,
  /** Eye offset from the car's centreline, metres. Negative = left-hand drive. */
  EYE_LATERAL: -0.36,

  NEAR_PLANE: 0.1,
  FAR_PLANE: 4000,
} as const;

// ---------------------------------------------------------------------------
// Controls — docs/01-design.md §2, ADR-0004. Wired up in Phase 2.
// ---------------------------------------------------------------------------

export const CONTROL = {
  /** Finger offset for full lock, as a fraction of screen width. */
  STEER_RADIUS_FRAC: 0.22,
  /** Finger offset for full throttle, as a fraction of screen height. */
  THROTTLE_RADIUS_FRAC: 0.14,
  /** Shorter than throttle — the brakes should feel eager. */
  BRAKE_RADIUS_FRAC: 0.12,
  /** Deadzone as a fraction of the steer radius. A resting thumb is never still. */
  DEADZONE_FRAC: 0.04,
  /** Steering response curve: fine near centre, full lock still reachable. */
  STEER_CURVE_LINEAR: 0.35,
  /** How fast the touch origin creeps toward a finger held at full deflection. */
  ORIGIN_DRIFT_RATE: 0.12,
  /** Exponential rate at which steering returns to centre after lift-off. */
  RELEASE_RECENTRE_RATE: 6.0,
} as const;

// ---------------------------------------------------------------------------
// Vehicle — docs/01-design.md §3. Wired up in Phase 2.
// ---------------------------------------------------------------------------

export const CAR = {
  TOP_SPEED_MS: 195 / 3.6,
  WHEELBASE_M: 2.27,
  MAX_STEER_RAD: 32 * DEG,
  /** Speed at which steering lock starts being reduced, m/s. */
  STEER_FALLOFF_START_MS: 30 / 3.6,
  /** Fraction of full lock still available at top speed. Lower = calmer at speed. */
  STEER_FALLOFF_MIN: 0.22,
  BRAKE_G: 0.9,
  GRIP_TARMAC: 1.0,
  GRIP_GRAVEL: 0.62,
  GRIP_GRASS: 0.45,
} as const;

/**
 * Body attitude springs. Pillar #1 — this is where "weight" comes from.
 *
 * Note the damping ratios sit below 1 deliberately: the single soft overshoot
 * on turn-in is what reads as mass. Do not critically damp these.
 */
export const ATTITUDE = {
  /** Body leans *outward* in a corner, as a real car does. */
  ROLL_MAX: 4.5 * DEG,
  ROLL_FREQ_HZ: 2.2,
  ROLL_ZETA: 0.7,

  PITCH_MAX: 2.5 * DEG,
  PITCH_FREQ_HZ: 2.8,
  PITCH_ZETA: 0.8,

  HEAVE_MAX_M: 0.04,
  HEAVE_FREQ_HZ: 3.2,
  HEAVE_ZETA: 0.6,
} as const;

// ---------------------------------------------------------------------------
// World — Phase 1.
// ---------------------------------------------------------------------------

export const WORLD = {
  /** Centreline sample spacing, metres. */
  STATION_SPACING_M: 4,
  /** Stations per chunk. 128 × 4 m ≈ 512 m. */
  STATIONS_PER_CHUNK: 128,
  /** Live chunks behind and ahead of the player. */
  CHUNKS_BEHIND: 2,
  CHUNKS_AHEAD: 10,
} as const;

// ---------------------------------------------------------------------------
// Time of day — Phase 3.
// ---------------------------------------------------------------------------

export const TIME = {
  /** Seconds for one full dawn-to-dawn cycle. ~25 minutes. */
  CYCLE_SECONDS: 25 * 60,
  /** Where the cycle starts on a fresh drive. 0 = midnight, 0.25 = dawn. */
  START_PHASE: 0.27,
} as const;
