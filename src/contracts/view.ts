/**
 * The camera and the display. Plain data — no three.js here, so pure modules
 * can reason about framing without pulling the renderer in.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Per-run overrides for the authored framing constants, used by tuning sweeps. */
export interface FramingOverrides {
  headerFraction?: number;
  apertureFraction?: number;
  dashFraction?: number;
  hFov?: number;
  horizonY?: number;
}

/**
 * The portrait layout, resolved for the current display.
 * Rectangles are CSS pixels with y measured from the top.
 */
export interface Framing {
  width: number;
  height: number;
  pixelRatio: number;

  header: Rect;
  /** The windscreen. The 3D world is scissored to this and nothing else. */
  aperture: Rect;
  dash: Rect;
  wheel: Rect;

  apertureAspect: number;
  /** Vertical FOV, radians — derived from the horizontal FOV (ADR-0009). */
  vFov: number;
  /** Camera pitch that puts the horizon at the authored height in the aperture. */
  horizonPitch: number;
}

/** Where the driver's eye is and how the body is sitting, this frame. */
export interface ViewState {
  /** Eye position in world space, metres. */
  x: number;
  z: number;
  /** Height of the road surface under the car. Eye height is added on top. */
  y: number;
  /** Heading in radians, 0 looking down -Z. Where the *car* points. */
  heading: number;
  /**
   * Look-ahead yaw offset, radians (ADR-0010). The camera adds this; the
   * cockpit must not, so that turning into a bend swings the cabin across
   * the view instead of rotating with it.
   */
  lookYaw: number;
  /** Body attitude, radians. Roll positive leaning right. */
  roll: number;
  pitch: number;
  /** Body heave, metres, added to eye height. */
  heaveY: number;
}

export function makeViewState(): ViewState {
  return { x: 0, y: 0, z: 0, heading: 0, lookYaw: 0, roll: 0, pitch: 0, heaveY: 0 };
}
