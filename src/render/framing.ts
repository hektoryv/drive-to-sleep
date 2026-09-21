/**
 * Portrait framing maths.
 *
 * The display is divided into four horizontal bands
 * (docs/02-art-direction.md). Only the aperture band — the windscreen — ever
 * contains the 3D world. Everything about how the game is composed flows from
 * this, so the geometry is computed in exactly one place.
 *
 * The resulting types live in `contracts/view.ts`, because the cockpit and the
 * HUD both need to lay themselves out against these bands without importing
 * the renderer.
 */

import type { Framing, FramingOverrides, Rect } from '../contracts/view.js';
import { VIEW } from './tuning.js';

function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

export function computeFraming(
  width: number,
  height: number,
  pixelRatio: number,
  overrides: FramingOverrides = {},
): Framing {
  const hFov = overrides.hFov ?? VIEW.H_FOV;
  const horizonY = overrides.horizonY ?? VIEW.HORIZON_Y;

  const headerH = height * (overrides.headerFraction ?? VIEW.HEADER_FRACTION);
  const apertureH = height * (overrides.apertureFraction ?? VIEW.APERTURE_FRACTION);
  const dashH = height * (overrides.dashFraction ?? VIEW.DASH_FRACTION);
  // The wheel takes the remainder, so rounding never leaves a gap at the
  // bottom and an override of any other band stays self-consistent.
  const wheelH = Math.max(0, height - headerH - apertureH - dashH);

  const apertureAspect = apertureH > 0 ? width / apertureH : 1;

  // Horizontal FOV is the authored value; vertical follows from the aperture.
  const vFov = 2 * Math.atan(Math.tan(hFov / 2) / apertureAspect);
  const horizonPitch = Math.atan((2 * horizonY - 1) * Math.tan(vFov / 2));

  // The cockpit's frustum encloses the whole display but stays centred on the
  // aperture, so that it shares a centre line and an angular scale with the
  // world camera. A symmetric frustum centred on the aperture's middle has to
  // reach whichever display edge is further away, and the display is then a
  // window inside it.
  const apertureCentreY = headerH + apertureH / 2;
  const reach = Math.max(apertureCentreY, height - apertureCentreY);
  const fullHeight = Math.max(1, reach * 2);
  const cockpitVFov =
    apertureH > 0 ? 2 * Math.atan(Math.tan(vFov / 2) * (fullHeight / apertureH)) : vFov;

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
    cockpit: {
      vFov: cockpitVFov,
      aspect: width / fullHeight,
      fullHeight,
      offsetY: reach - apertureCentreY,
    },
  };
}

/** Converts a top-down y to the bottom-up y WebGL viewports and scissors use. */
export function toGlY(framing: Framing, r: Rect): number {
  return framing.height - (r.y + r.h);
}

/**
 * Caps the device pixel ratio. Phones report 3–4; rendering a 3D scene at 4×
 * on a mid-range GPU is the single easiest way to miss the frame budget, and
 * at these sizes the visual difference is marginal.
 */
export function clampPixelRatio(raw: number, max = 2): number {
  return Math.min(raw, max);
}
