import { describe, expect, it } from 'vitest';
import {
  approach,
  clamp,
  invLerp,
  makeSpring,
  remap,
  smootherstep,
  stepSpring,
  wrapAngle,
} from '../src/core/math.js';

describe('scalar helpers', () => {
  it('clamps', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('remaps and clamps to the output range', () => {
    expect(remap(5, 0, 10, 0, 100)).toBeCloseTo(50);
    expect(remap(-5, 0, 10, 0, 100)).toBeCloseTo(0);
    expect(remap(50, 0, 10, 0, 100)).toBeCloseTo(100);
  });

  it('handles a degenerate input range without dividing by zero', () => {
    expect(Number.isFinite(invLerp(3, 3, 3))).toBe(true);
  });

  it('wraps angles into [-PI, PI)', () => {
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(-Math.PI, 5);
    expect(wrapAngle(0.5)).toBeCloseTo(0.5, 10);
    expect(wrapAngle(Math.PI * 2 + 0.5)).toBeCloseTo(0.5, 10);
    expect(wrapAngle(-Math.PI * 2 - 0.5)).toBeCloseTo(-0.5, 10);
    for (let a = -50; a < 50; a += 0.37) {
      const w = wrapAngle(a);
      expect(w).toBeGreaterThanOrEqual(-Math.PI);
      expect(w).toBeLessThan(Math.PI);
    }
  });

  it('smootherstep is flat at both ends', () => {
    expect(smootherstep(0)).toBe(0);
    expect(smootherstep(1)).toBe(1);
    expect(smootherstep(0.5)).toBeCloseTo(0.5, 10);
  });
});

describe('approach', () => {
  it('is frame-rate independent', () => {
    // One 1/60 s step must land in the same place as two 1/120 s steps.
    const coarse = approach(0, 1, 5, 1 / 60);
    let fine = 0;
    fine = approach(fine, 1, 5, 1 / 120);
    fine = approach(fine, 1, 5, 1 / 120);
    expect(fine).toBeCloseTo(coarse, 10);
  });
});

describe('spring', () => {
  const DT = 1 / 120;

  it('settles on its target', () => {
    const s = makeSpring(2.2, 0.7);
    for (let i = 0; i < 1200; i++) stepSpring(s, 1, DT);
    expect(s.x).toBeCloseTo(1, 4);
    expect(s.v).toBeCloseTo(0, 3);
  });

  it('overshoots below critical damping — this is the "weight" we want', () => {
    const s = makeSpring(2.2, 0.7);
    let peak = 0;
    for (let i = 0; i < 600; i++) peak = Math.max(peak, stepSpring(s, 1, DT));
    expect(peak).toBeGreaterThan(1.0);
    expect(peak).toBeLessThan(1.2);
  });

  it('does not overshoot when critically damped', () => {
    const s = makeSpring(2.2, 1.0);
    let peak = 0;
    for (let i = 0; i < 600; i++) peak = Math.max(peak, stepSpring(s, 1, DT));
    expect(peak).toBeLessThanOrEqual(1.001);
  });

  it('stays stable at the simulation step for every tuned frequency', () => {
    for (const freq of [2.2, 2.8, 3.2]) {
      const s = makeSpring(freq, 0.6);
      for (let i = 0; i < 5000; i++) stepSpring(s, Math.sin(i * 0.01), DT);
      expect(Number.isFinite(s.x)).toBe(true);
      expect(Math.abs(s.x)).toBeLessThan(5);
    }
  });
});
