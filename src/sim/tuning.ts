/**
 * Vehicle and simulation constants. Owned by the `sim` domain.
 *
 * Every number here shapes how the car *feels*. Each carries a comment saying
 * which direction makes it more of something, because tuning happens in a loop
 * of change-look-change and an unexplained constant never gets tuned.
 *
 * Pure data. Imports nothing but the unit helper, and must stay that way.
 */

import { DEG } from '../core/math.js';

/** Standard gravity, m/s². Not a tuning value, but everything here needs it. */
export const GRAVITY = 9.81;

/** How a drive begins. */
export const START = {
  /** Already rolling, so the first second is a drive rather than a menu. */
  SPEED_MS: 70 / 3.6,
} as const;

export const SIM = {
  /** Fixed simulation rate. See ADR-0002 — do not make this variable. */
  STEP_HZ: 120,
  /** Sub-step cap per frame before the backlog is dropped. */
  MAX_SUB_STEPS: 8,
} as const;

// ---------------------------------------------------------------------------
// The car — docs/01-design.md §3. Wired up in Phase 2.
// ---------------------------------------------------------------------------

export const CAR = {
  TOP_SPEED_MS: 195 / 3.6,
  WHEELBASE_M: 2.27,

  // --- Longitudinal ---

  /** Peak acceleration from a standstill, m/s². About 0.57 g. */
  PEAK_ACCEL: 5.6,
  /**
   * How much of that thrust is gone by the top end, 0–1. Higher = more
   * naturally aspirated, shove low down and nothing left up top.
   */
  THRUST_FALLOFF: 0.8,
  /**
   * Aerodynamic drag, m/s² per (m/s)². Together with the thrust curve this is
   * what actually settles the top speed — the cap should never be what stops
   * the car, or the last 20 km/h arrive with no sense of effort.
   */
  DRAG: 0.00042,
  /**
   * Rolling resistance, m/s². Constant, not proportional to speed: it is the
   * tyres deforming, not the air. It is what makes lifting off feel like
   * coasting rather than like braking.
   */
  ROLLING_RESISTANCE: 0.25,
  /** Multiplier on rolling resistance off the tarmac. Higher = more of a trap. */
  OFF_ROAD_DRAG: 5.5,
  /** Braking, in g before grip is applied. */
  BRAKE_G: 0.95,

  // --- Steering ---

  MAX_STEER_RAD: 32 * DEG,
  /** Speed at which steering authority starts being reduced, m/s. */
  STEER_FALLOFF_START_MS: 30 / 3.6,
  /** Fraction of full authority still available at top speed. Lower = calmer at speed. */
  STEER_FALLOFF_MIN: 0.2,
  /**
   * How fast the wheel itself moves toward where the thumb is asking, per
   * second. High enough that the wheel tracks the thumb (ADR-0004 requires
   * they never disagree), low enough to take the jitter off.
   */
  STEER_RATE: 14,
  /**
   * How quickly the car's rotation reaches the rate the wheel is asking for.
   * Lower = more languid turn-in and more of a sense of mass; too low and the
   * car feels like it is steering from the back seat.
   */
  YAW_RESPONSE: 7.5,

  // --- Grip and slide ---

  GRIP_TARMAC: 1.0,
  GRIP_GRAVEL: 0.62,
  GRIP_GRASS: 0.45,
  /**
   * Lateral grip as a multiple of g. Above 1 would be a racing slick; a road
   * car on 1972 rubber is nearer 0.85, and the lower it is the earlier the
   * car starts to lean on its outside tyres.
   */
  LATERAL_GRIP_SCALE: 0.85,
  /** How much refused rotation becomes sideways motion. Higher = slidier. */
  SLIDE_GAIN: 0.55,
  /** How fast the tyres scrub a slide off, per second, before grip. */
  SLIDE_RECOVERY: 2.6,
  /** Cap on sideways velocity, m/s. Stops a spin becoming a departure. */
  MAX_SLIDE_MS: 7,

  // --- Instruments ---

  MAX_RPM: 7200,
  IDLE_RPM: 900,
  /** How much the needle lifts on throttle at a given speed. */
  THROTTLE_RPM_LIFT: 700,
} as const;

/**
 * Body attitude springs. Pillar #1 — this is where "weight" comes from.
 *
 * The damping ratios sit below 1 deliberately: the single soft overshoot on
 * turn-in is what reads as mass. Do not critically damp these.
 */
export const ATTITUDE = {
  /** Body leans *outward* in a corner, as a real car does. */
  ROLL_MAX: 4.5 * DEG,
  ROLL_FREQ_HZ: 2.2,
  ROLL_ZETA: 0.7,
  /**
   * Lateral acceleration, m/s², at which the body reaches full lean. Set near
   * the grip limit so maximum roll means "at the edge" rather than "turning".
   */
  REF_LATERAL_ACCEL: 7.5,

  PITCH_MAX: 2.5 * DEG,
  PITCH_FREQ_HZ: 2.8,
  PITCH_ZETA: 0.8,
  /** Longitudinal acceleration, m/s², at which the body reaches full dive or squat. */
  REF_LONG_ACCEL: 6.0,

  HEAVE_MAX_M: 0.04,
  HEAVE_FREQ_HZ: 3.2,
  HEAVE_ZETA: 0.6,

  /**
   * Rumble. Spaced by distance rather than by time, so a rough surface has a
   * texture you drive across instead of a hum whose pitch rises with speed.
   */
  RUMBLE_SPACING_M: 1.1,
  RUMBLE_IMPULSE: 0.22,

  /** Jolt strengths for an impact, per unit severity. */
  JOLT_HEAVE: 0.9,
  JOLT_PITCH: 0.35,
  JOLT_ROLL: 0.5,
} as const;

// ---------------------------------------------------------------------------
// Autopilot — a probe, not a player. See sim/autopilot.ts.
// ---------------------------------------------------------------------------

export const AUTOPILOT = {
  /** Aim point, as a fixed distance plus a time at the current speed. */
  LOOKAHEAD_BASE_M: 12,
  LOOKAHEAD_TIME_S: 0.85,
  /** Steering gain on the heading error. Higher = twitchier, weaves sooner. */
  HEADING_GAIN: 1.9,
  /** Steering gain on being off the centreline, at or below the reference speed. */
  CROSS_TRACK_GAIN: 1.3,
  /** Above this speed the cross-track gain is scaled down, to stay stable. */
  CROSS_TRACK_REF_SPEED_MS: 14,
  /** Lateral error, metres, treated as "fully off line". */
  CROSS_TRACK_REF_M: 3.5,

  /** How far ahead to look for the corner worth slowing for. */
  SPEED_SCAN_BASE_M: 30,
  SPEED_SCAN_TIME_S: 2.6,
  SPEED_SCAN_STEP_M: 8,
  /**
   * Fraction of the theoretical grip-limited corner speed to actually use.
   * A pure-pursuit controller always runs a little wide, so the margin has to
   * cover the error it has not corrected yet as well as the tyres.
   */
  CORNER_SPEED_MARGIN: 0.74,
  /** The speed it would like on a straight, m/s. */
  CRUISE_MS: 125 / 3.6,
  MIN_SPEED_MS: 30 / 3.6,

  THROTTLE_GAIN: 0.35,
  BRAKE_GAIN: 0.3,
  /** Speed overshoot, m/s, tolerated before touching the brakes. */
  BRAKE_DEADBAND_MS: 1.5,
} as const;
