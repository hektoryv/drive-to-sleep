/**
 * View and camera constants. Owned by the `render` domain.
 *
 * Tuning constants are split per domain rather than living in one file
 * (ADR-0011): a single shared constants file is the most reliable merge
 * conflict in a codebase worked on from several directions at once.
 */

import { DEG } from '../core/math.js';

// ---------------------------------------------------------------------------
// Portrait framing
//
// The four bands stack to 1.0 and divide the display. See
// docs/02-art-direction.md for the diagram and the reasoning.
// ---------------------------------------------------------------------------

export const VIEW = {
  /** Top strip: rear-view mirror and the distance readout. */
  HEADER_FRACTION: 0.05,
  /** The windscreen aperture — the only band the 3D world is drawn into. */
  APERTURE_FRACTION: 0.46,
  /**
   * Dash top and the five-dial binnacle. Deliberately shallow: in the real car
   * the binnacle sits *behind* the wheel, so the dials can overlap the top of
   * the wheel band rather than needing a tall strip of their own. Every point
   * taken from here goes to the windscreen.
   */
  DASH_FRACTION: 0.15,
  /** The wheel. Its bottom runs off the screen; we see the top two-thirds. */
  WHEEL_FRACTION: 0.34,

  /**
   * Horizontal field of view. Specified horizontally, not vertically, so that
   * changing the aperture's proportions never changes how far into a corner
   * you can see — which is the property that matters for driving (ADR-0009).
   *
   * Deliberately wider than a real windscreen subtends. A physically honest
   * FOV for a phone at arm's length is about 25°, which looks like driving
   * through a telescope and kills all sense of speed.
   *
   * Larger = more speed sensation, more distortion at the frame edges.
   * Smaller = longer lens, mountains read as larger, calmer horizon.
   */
  H_FOV: 72 * DEG,

  /**
   * Where the horizon sits within the aperture, as a fraction from its top.
   * Above 0.5 means more sky than road, which is where the mood lives.
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
// Camera look-ahead — ADR-0010. The view leans into corners ahead of the car.
// ---------------------------------------------------------------------------

export const CAMERA = {
  /**
   * How far down the road the camera looks: a fixed part plus a
   * speed-proportional part. The speed term keeps the behaviour consistent —
   * at 50 km/h and at 180 km/h you want to look the same number of *seconds*
   * ahead, not the same number of metres.
   */
  LOOKAHEAD_BASE_M: 10,
  LOOKAHEAD_TIME_S: 0.75,

  /**
   * Fraction of the angle to the road ahead that the view actually turns
   * through. Deliberately not 1: turning fully into the corner would pin the
   * road to the centre of the frame and destroy any sense of turning.
   * Higher = more anticipation, corners easier to read, less sense of rotation.
   */
  FOLLOW_STRENGTH: 0.45,

  /** Hard cap on the yaw offset. Beyond this you are looking out of the side window. */
  MAX_YAW: 14 * DEG,

  /**
   * Exponential approach rate, per second. Deliberately an approach and not a
   * spring: the attitude springs overshoot on purpose because overshoot reads
   * as weight, but a camera that overshoots reads as motion sickness.
   */
  RESPONSE_RATE: 4.5,
} as const;

/**
 * Debug chase camera. Not a game feature — ADR-0006 locks the game to the
 * cockpit — but the one view that shows the car's line through a corner and
 * the body leaning from outside, which is otherwise impossible to photograph.
 */
export const CHASE = {
  BACK_M: 9,
  UP_M: 3.4,
  /** How much of the body roll the chase camera inherits. */
  ROLL_SHARE: 0.35,
  /** Downward tilt, radians, so the car sits in the lower half of the frame. */
  PITCH: -7 * DEG,
} as const;

/** Filmic tonemapping exposure. See ADR-0007. */
export const TONEMAP_EXPOSURE = 1.15;
