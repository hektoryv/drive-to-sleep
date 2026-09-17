import { describe, expect, it } from 'vitest';
import { clampPixelRatio, computeFraming, toGlY } from '../src/render/framing.js';
import { VIEW } from '../src/render/tuning.js';

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

describe('framing overrides', () => {
  it('applies each override independently', () => {
    const f = computeFraming(412, 915, 2, { apertureFraction: 0.6 });
    expect(f.aperture.h).toBeCloseTo(915 * 0.6, 6);
    expect(f.header.h).toBeCloseTo(915 * VIEW.HEADER_FRACTION, 6);
  });

  it('keeps the bands tiling exactly when one is overridden', () => {
    const f = computeFraming(412, 915, 2, { dashFraction: 0.05, apertureFraction: 0.55 });
    expect(f.wheel.y + f.wheel.h).toBeCloseTo(915, 6);
    expect(f.wheel.h).toBeGreaterThan(0);
  });

  it('never produces a negative wheel band, however silly the overrides', () => {
    const f = computeFraming(412, 915, 2, { apertureFraction: 0.95, dashFraction: 0.4 });
    expect(f.wheel.h).toBeGreaterThanOrEqual(0);
  });

  it('honours an overridden field of view', () => {
    const wide = computeFraming(412, 915, 2, { hFov: (100 * Math.PI) / 180 });
    const narrow = computeFraming(412, 915, 2, { hFov: (40 * Math.PI) / 180 });
    expect(wide.vFov).toBeGreaterThan(narrow.vFov);
    const wideH = 2 * Math.atan(Math.tan(wide.vFov / 2) * wide.apertureAspect);
    expect((wideH * 180) / Math.PI).toBeCloseTo(100, 6);
  });

  it('honours an overridden horizon', () => {
    const f = computeFraming(412, 915, 2, { horizonY: 0.4 });
    const fromTop = (1 + Math.tan(f.horizonPitch) / Math.tan(f.vFov / 2)) / 2;
    expect(fromTop).toBeCloseTo(0.4, 10);
  });

  it('falls back to the authored values when given nothing', () => {
    expect(computeFraming(412, 915, 2, {})).toEqual(computeFraming(412, 915, 2));
  });
});
