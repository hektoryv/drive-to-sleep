/**
 * Portrait framing.
 *
 * The display is divided into four horizontal bands (docs/02-art-direction.md).
 * Only the aperture band — the windscreen — ever contains the 3D world; the
 * rest is the car. Everything about how the game is composed flows from this,
 * so the geometry is computed in exactly one place.
 *
 * Rectangles are in CSS pixels with y measured from the top of the display.
 * WebGL wants y from the bottom, so `toGlY` is provided rather than left for
 * each caller to get wrong.
 */

import { VIEW } from '../sim/tuning.js';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Framing {
  /** Display size in CSS pixels. */
  width: number;
  height: number;
  /** Device pixel ratio actually in use (capped — see clampPixelRatio). */
  pixelRatio: number;

  header: Rect;
  /** The windscreen. The 3D world is scissored to this and nothing else. */
  aperture: Rect;
  dash: Rect;
  wheel: Rect;

  /** Aperture aspect ratio (w/h). */
  apertureAspect: number;
  /** Vertical FOV in radians, derived from the horizontal FOV and the aperture. */
  vFov: number;
  /**
   * Camera pitch offset in radians that places the horizon at VIEW.HORIZON_Y
   * within the aperture. Positive pitches the camera up, which moves the
   * horizon *down* the frame and leaves more sky above it.
   */
  horizonPitch: number;
}

function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

export function computeFraming(width: number, height: number, pixelRatio: number): Framing {
  const headerH = height * VIEW.HEADER_FRACTION;
  const apertureH = height * VIEW.APERTURE_FRACTION;
  const dashH = height * VIEW.DASH_FRACTION;
  // The wheel takes the remainder, so rounding never leaves a gap at the bottom.
  const wheelH = height - headerH - apertureH - dashH;

  const apertureAspect = apertureH > 0 ? width / apertureH : 1;

  // Horizontal FOV is the authored value; vertical follows from the aperture.
  const vFov = 2 * Math.atan(Math.tan(VIEW.H_FOV / 2) / apertureAspect);
  const horizonPitch = Math.atan((2 * VIEW.HORIZON_Y - 1) * Math.tan(vFov / 2));

  return {
    width,
    height,
    pixelRatio,
    header: rect(0, 0, width, headerH),
    aperture: rect(0, headerH, width, apertureH),
    dash: rect(0, headerH + apertureH, width, dashH),
    wheel: rect(0, headerH + apertureH + dashH, width, wheelH),
    apertureAspect,
    vFov,
    horizonPitch,
  };
}

/** Converts a top-down y to the bottom-up y WebGL viewports and scissors use. */
export function toGlY(framing: Framing, r: Rect): number {
  return framing.height - (r.y + r.h);
}

/**
 * Caps the device pixel ratio. Phones report 3–4; rendering a 3D scene at
 * 4× on a mid-range GPU is the single easiest way to miss the frame budget,
 * and at the sizes involved the visual difference is marginal.
 */
export function clampPixelRatio(raw: number, max = 2): number {
  return Math.min(raw, max);
}
