/**
 * The placeholder path is deleted in Phase 1, but while the camera rig is
 * being tuned against it, it needs to be the shape we think it is — otherwise
 * a bug in the road reads as a bug in the camera.
 */
import { describe, expect, it } from 'vitest';
import { pathHeading, pathSlope, pathX } from '../src/world/placeholder-path.js';

describe('placeholder path', () => {
  it('is smooth — a kink would be indistinguishable from a camera bug', () => {
    for (let s = 0; s < 3000; s += 7) {
      expect(Math.abs(pathX(s + 0.5) - pathX(s))).toBeLessThan(1);
    }
  });

  it('has an analytic slope matching its numeric derivative', () => {
    // The ground shader and the camera both rely on this. If they disagreed,
    // the drawn road band and the car's path would drift apart.
    const h = 1e-4;
    for (let s = 0; s < 2000; s += 37) {
      const numeric = (pathX(s + h) - pathX(s - h)) / (2 * h);
      expect(pathSlope(s)).toBeCloseTo(numeric, 5);
    }
  });

  it('actually curves — a straight placeholder would prove nothing', () => {
    let maxHeading = 0;
    for (let s = 0; s < 3000; s++) maxHeading = Math.max(maxHeading, Math.abs(pathHeading(s)));
    expect(maxHeading).toBeGreaterThan((10 * Math.PI) / 180);
  });

  it('stays within a plausible corner radius for a road', () => {
    let tightest = Infinity;
    const h = 1e-3;
    for (let s = 0; s < 3000; s++) {
      const curvature = Math.abs((pathSlope(s + h) - pathSlope(s - h)) / (2 * h));
      if (curvature > 1e-9) tightest = Math.min(tightest, 1 / curvature);
    }
    expect(tightest).toBeGreaterThan(50);
    expect(tightest).toBeLessThan(400);
  });

  it('has zero heading where the road is momentarily straight', () => {
    // Bisect to an actual zero crossing rather than hoping one lands on the
    // sample grid — at these curvatures the slope moves far too fast between
    // samples for a direct scan to find one.
    let lo = 0;
    let found = false;
    for (let s = 0.5; s < 2000 && !found; s += 0.5) {
      if (Math.sign(pathSlope(s)) !== Math.sign(pathSlope(lo))) {
        let a = lo;
        let b = s;
        for (let i = 0; i < 60; i++) {
          const mid = (a + b) / 2;
          if (Math.sign(pathSlope(mid)) === Math.sign(pathSlope(a))) a = mid;
          else b = mid;
        }
        expect(pathSlope(a)).toBeCloseTo(0, 6);
        expect(pathHeading(a)).toBeCloseTo(0, 6);
        found = true;
      }
      lo = s;
    }
    expect(found).toBe(true);
  });
});
