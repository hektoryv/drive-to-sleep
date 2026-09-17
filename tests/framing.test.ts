import { describe, expect, it } from 'vitest';
import { clampPixelRatio, computeFraming, toGlY } from '../src/render/framing.js';
import { VIEW } from '../src/sim/tuning.js';

/** A representative spread of phone sizes, portrait. */
const SCREENS: Array<[number, number]> = [
  [360, 780],
  [412, 915],
  [390, 844],
  [428, 926],
  [320, 640],
];

describe('portrait framing', () => {
  it('bands tile the display exactly, with no gap or overlap', () => {
    for (const [w, h] of SCREENS) {
      const f = computeFraming(w, h, 2);
      expect(f.header.y).toBe(0);
      expect(f.aperture.y).toBeCloseTo(f.header.y + f.header.h, 10);
      expect(f.dash.y).toBeCloseTo(f.aperture.y + f.aperture.h, 10);
      expect(f.wheel.y).toBeCloseTo(f.dash.y + f.dash.h, 10);
      expect(f.wheel.y + f.wheel.h).toBeCloseTo(h, 10);
    }
  });

  it('the authored fractions sum to one', () => {
    const sum =
      VIEW.HEADER_FRACTION + VIEW.APERTURE_FRACTION + VIEW.DASH_FRACTION + VIEW.WHEEL_FRACTION;
    expect(sum).toBeCloseTo(1, 10);
  });

  it('holds horizontal FOV constant across screen shapes', () => {
    // This is the point of specifying FOV horizontally: how far you can see
    // into a corner must not depend on the phone's aspect ratio.
    for (const [w, h] of SCREENS) {
      const f = computeFraming(w, h, 2);
      const hFov = 2 * Math.atan(Math.tan(f.vFov / 2) * f.apertureAspect);
      expect(hFov).toBeCloseTo(VIEW.H_FOV, 10);
    }
  });

  it('places the horizon where the art direction asks', () => {
    for (const [w, h] of SCREENS) {
      const f = computeFraming(w, h, 2);
      // Invert the pitch back into a screen fraction; it must round-trip.
      const fromTop = (1 + Math.tan(f.horizonPitch) / Math.tan(f.vFov / 2)) / 2;
      expect(fromTop).toBeCloseTo(VIEW.HORIZON_Y, 10);
    }
  });

  it('leaves more sky than road in the aperture', () => {
    expect(VIEW.HORIZON_Y).toBeGreaterThan(0.5);
  });

  it('converts to WebGL bottom-up coordinates', () => {
    const f = computeFraming(400, 800, 1);
    // The header is at the top in CSS, so it is the highest GL y.
    expect(toGlY(f, f.header)).toBeCloseTo(800 - f.header.h, 10);
    // The wheel runs to the bottom of the display, so GL y is 0.
    expect(toGlY(f, f.wheel)).toBeCloseTo(0, 10);
  });

  it('survives a degenerate viewport without producing NaN', () => {
    const f = computeFraming(0, 0, 1);
    expect(Number.isFinite(f.vFov)).toBe(true);
    expect(Number.isFinite(f.horizonPitch)).toBe(true);
  });
});

describe('pixel ratio', () => {
  it('caps at 2 — 3x and 4x phones are the easiest way to miss the budget', () => {
    expect(clampPixelRatio(4)).toBe(2);
    expect(clampPixelRatio(3)).toBe(2);
    expect(clampPixelRatio(1.5)).toBe(1.5);
  });
});
