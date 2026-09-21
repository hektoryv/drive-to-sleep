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

/**
 * Scene layer the cockpit draws on.
 *
 * The world is scissored to the aperture band and nothing else, which is most
 * of how the frame budget is met — the GPU never shades the half of a portrait
 * phone the car covers. The cockpit has to be drawn *outside* that band, so it
 * is a second pass with its own frustum, and the two are told apart by layer.
 *
 * Here rather than in `render/` because the cockpit has to put itself on this
 * layer and the two domains may not import one another (ADR-0011).
 */
export const COCKPIT_LAYER = 1;

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

  /**
   * The cockpit's frustum, which covers the whole display rather than the
   * aperture, and is *centred on the aperture* rather than on the screen.
   *
   * Both cameras then share one rotation and one angular scale, so a point
   * in the cabin lands where the same point in the world would. Get this
   * wrong and the dash sits at a different horizon from the road.
   */
  cockpit: {
    /** Vertical FOV of the enclosing frustum, radians. */
    vFov: number;
    /** Aspect of that frustum. */
    aspect: number;
    /** Frustum height in pixels — `setViewOffset`'s fullHeight. */
    fullHeight: number;
    /** Where the display's top edge sits inside it — `setViewOffset`'s y. */
    offsetY: number;
  };
}

/** Where the driver's eye is and how the body is sitting, this frame. */
export interface ViewState {
  /**
   * The **car's** position in world space, metres. Not the eye — the comment
   * here used to say eye, and it was wrong: `render/` offsets from this by the
   * seat position, and `y` is the road surface under the car rather than any
   * height a head is at.
   */
  x: number;
  z: number;
  y: number;

  /**
   * The driver's eye in world space — seat offset, eye height and heave all
   * applied. Written by `render/`, which owns the camera and therefore owns
   * the answer.
   *
   * Exposed because the cabin has to sit exactly where the camera is, and the
   * alternative was two domains each holding their own copy of the seat
   * position. Two copies of a constant that must agree is one copy too many.
   */
  eyeX: number;
  eyeY: number;
  eyeZ: number;
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
  return {
    x: 0,
    y: 0,
    z: 0,
    eyeX: 0,
    eyeY: 0,
    eyeZ: 0,
    heading: 0,
    lookYaw: 0,
    roll: 0,
    pitch: 0,
    heaveY: 0,
  };
}
