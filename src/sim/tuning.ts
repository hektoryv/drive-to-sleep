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
  MAX_STEER_RAD: 32 * DEG,
  /** Speed at which steering lock starts being reduced, m/s. */
  STEER_FALLOFF_START_MS: 30 / 3.6,
  /** Fraction of full lock still available at top speed. Lower = calmer at speed. */
  STEER_FALLOFF_MIN: 0.22,
  BRAKE_G: 0.9,
  GRIP_TARMAC: 1.0,
  GRIP_GRAVEL: 0.62,
  GRIP_GRASS: 0.45,
  /** Redline, for the tachometer. */
  MAX_RPM: 7200,
  IDLE_RPM: 900,
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

  PITCH_MAX: 2.5 * DEG,
  PITCH_FREQ_HZ: 2.8,
  PITCH_ZETA: 0.8,

  HEAVE_MAX_M: 0.04,
  HEAVE_FREQ_HZ: 3.2,
  HEAVE_ZETA: 0.6,
} as const;
