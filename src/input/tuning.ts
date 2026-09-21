/**
 * Control constants. Owned by the `input` domain.
 * See docs/01-design.md §2 and ADR-0004. Wired up in Phase 2.
 */

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
  // There is deliberately no origin-creep rate. The origin is dragged along
  // behind the finger and never moves on its own — see ADR-0013 for what the
  // creeping version did to a held corner.
  /** Exponential rate at which steering returns to centre after lift-off. */
  RELEASE_RECENTRE_RATE: 6.0,
} as const;
