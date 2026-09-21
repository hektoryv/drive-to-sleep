import { describe, expect, it } from 'vitest';
import {
  daylightAt,
  makeSkyPalette,
  makeSunDirection,
  paletteAt,
  sunDirectionAt,
  type Rgb,
  type SkyPalette,
} from '../src/world/gen/daylight.js';

const palette: SkyPalette = makeSkyPalette();
const sun = makeSunDirection();

function at(phase: number): SkyPalette {
  return paletteAt(phase, makeSkyPalette());
}

function luminance(c: Rgb): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/** Rough warm-vs-cool measure. Positive is warm. */
function warmth(c: Rgb): number {
  return c.r - c.b;
}

describe('the sun', () => {
  it('is at the horizon at dawn and dusk, highest at noon, lowest at midnight', () => {
    expect(sunDirectionAt(0.25, sun).elevation).toBeCloseTo(0, 6);
    expect(sunDirectionAt(0.75, sun).elevation).toBeCloseTo(0, 6);
    expect(sunDirectionAt(0.5, sun).elevation).toBeGreaterThan(0.85);
    expect(sunDirectionAt(0.0, sun).elevation).toBeLessThan(-0.85);
  });

  it('is above the horizon at golden hour', () => {
    // The first version of this put golden hour at 0.76, by which point the
    // sun is below the horizon and there is no disc to see at all.
    const elevation = sunDirectionAt(0.735, sun).elevation;
    expect(elevation).toBeGreaterThan(0);
    expect(Math.asin(elevation) * (180 / Math.PI)).toBeLessThan(12);
  });

  it('returns a unit vector at every phase', () => {
    for (let p = 0; p < 1; p += 0.01) {
      sunDirectionAt(p, sun);
      expect(Math.hypot(sun.x, sun.y, sun.z)).toBeCloseTo(1, 10);
    }
  });

  it('moves across the sky rather than up and down in place', () => {
    const dawn = { ...sunDirectionAt(0.25, makeSunDirection()) };
    const dusk = sunDirectionAt(0.75, makeSunDirection());
    // Opposite sides: the horizontal component has reversed.
    expect(dawn.x * dusk.x + dawn.z * dusk.z).toBeLessThan(0);
  });

  it('wraps, so a drive that passes midnight does not jump', () => {
    // 0.002 of phase is 0.7° of ordinary sun motion, so the tolerance is loose
    // enough to allow that and tight enough to catch the 180° snap the
    // half-turn azimuth used to produce here.
    const before = { ...sunDirectionAt(0.999, makeSunDirection()) };
    const after = sunDirectionAt(1.001, makeSunDirection());
    expect(after.y).toBeCloseTo(before.y, 2);
    expect(after.x).toBeCloseTo(before.x, 2);
    expect(after.z).toBeCloseTo(before.z, 2);
  });
});

describe('the palette', () => {
  it('is continuous — no visible crease at a keyframe boundary', () => {
    // Keyframes are blended with smootherstep for exactly this reason: the eye
    // is very good at spotting the moment a colour ramp changes direction.
    let previous = at(0);
    for (let p = 0.002; p <= 1; p += 0.002) {
      const next = at(p);
      const jump = Math.max(
        Math.abs(next.horizon.r - previous.horizon.r),
        Math.abs(next.zenith.b - previous.zenith.b),
        Math.abs(next.fogDensity - previous.fogDensity) * 1000,
      );
      // 0.002 of phase is about three seconds of real time at a 25-minute
      // cycle, so this is a generous bound on "no visible step". What it is
      // really guarding is a *discontinuity* at a keyframe boundary.
      expect(jump).toBeLessThan(0.05);
      previous = next;
    }
  });

  it('closes the loop at midnight', () => {
    const before = at(0.9999);
    const after = at(0.0001);
    expect(after.zenith.r).toBeCloseTo(before.zenith.r, 3);
    expect(after.horizon.b).toBeCloseTo(before.horizon.b, 3);
  });

  it('is darkest at night and brightest around noon', () => {
    expect(luminance(at(0).zenith)).toBeLessThan(luminance(at(0.5).zenith));
    expect(luminance(at(0.5).horizon)).toBeGreaterThan(luminance(at(0).horizon) * 4);
  });

  it('keeps the horizon brighter than the zenith at every hour', () => {
    // The gradient must never invert: a sky that is darker at the bottom than
    // the top reads as a ceiling.
    for (let p = 0; p < 1; p += 0.01) {
      const c = at(p);
      expect(luminance(c.horizon)).toBeGreaterThanOrEqual(luminance(c.zenith) - 1e-6);
    }
  });

  it('runs warm at the horizon and cool overhead near sunset', () => {
    // The whole colour logic of the art target: lit is warm, shadow is violet.
    const golden = at(0.735);
    expect(warmth(golden.horizon)).toBeGreaterThan(0.3);
    expect(warmth(golden.zenith)).toBeLessThan(0.05);
  });

  it('brings the stars out only when it is dark', () => {
    expect(at(0.5).starIntensity).toBe(0);
    // Not exactly zero at golden hour: it sits between two keyframes and the
    // first stars are already fractionally on. Invisible, and correct.
    expect(at(0.735).starIntensity).toBeLessThan(0.01);
    expect(at(0).starIntensity).toBeGreaterThan(0.9);
  });

  it('lights the instruments when the sky stops doing it', () => {
    // Phase 4 reads this for the dashboard backlighting.
    expect(at(0.5).instrumentGlow).toBe(0);
    expect(at(0).instrumentGlow).toBeGreaterThan(0.9);
    expect(at(0.86).instrumentGlow).toBeGreaterThan(at(0.66).instrumentGlow);
  });

  it('keeps every channel in range at every hour', () => {
    for (let p = 0; p < 1; p += 0.005) {
      const c = at(p);
      for (const key of ['zenith', 'upper', 'mid', 'horizon', 'fog', 'ambient'] as const) {
        const v = c[key];
        for (const ch of [v.r, v.g, v.b]) {
          expect(ch).toBeGreaterThanOrEqual(0);
          expect(ch).toBeLessThanOrEqual(1);
        }
      }
      expect(c.fogDensity).toBeGreaterThan(0);
      expect(c.cloudCover).toBeGreaterThan(0);
      expect(c.cloudCover).toBeLessThan(1);
    }
  });

  it('allocates nothing — it is called every simulation step', () => {
    const out = makeSkyPalette();
    const zenith = out.zenith;
    paletteAt(0.4, out);
    // The same colour objects must be reused, not replaced.
    expect(out.zenith).toBe(zenith);
  });

  it('handles phases outside 0–1', () => {
    expect(at(1.25).horizon.r).toBeCloseTo(at(0.25).horizon.r, 6);
    expect(at(-0.25).horizon.r).toBeCloseTo(at(0.75).horizon.r, 6);
  });
});

describe('daylight amount', () => {
  it('is full at noon and none at midnight', () => {
    expect(daylightAt(0.5)).toBe(1);
    expect(daylightAt(0)).toBe(0);
  });

  it('starts before sunrise and lingers after sunset', () => {
    // The sky keeps working for a while after the sun has stopped.
    expect(daylightAt(0.235)).toBeGreaterThan(0);
    expect(daylightAt(0.765)).toBeGreaterThan(0);
  });

  it('is monotonic through the morning', () => {
    let previous = -1;
    for (let p = 0.25; p <= 0.5; p += 0.01) {
      const v = daylightAt(p);
      expect(v).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = v;
    }
  });
});

describe('the shared palette object', () => {
  it('is filled in place by paletteAt', () => {
    paletteAt(0.5, palette);
    const noon = palette.horizon.r;
    paletteAt(0.0, palette);
    expect(palette.horizon.r).not.toBe(noon);
  });
});
