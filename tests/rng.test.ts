import { describe, expect, it } from 'vitest';
import { fbm1, gradNoise1, hash01, makeRng, ridged1, valueNoise1, valueNoise2 } from '../src/core/rng.js';

describe('rng stream', () => {
  it('is deterministic for a seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('differs between seeds', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('stays in range', () => {
    const r = makeRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThan(9);
    }
  });
});

describe('hashing', () => {
  it('is pure — same input, same output, any order', () => {
    const forward: number[] = [];
    for (let i = 0; i < 50; i++) forward.push(hash01(i, 9));
    for (let i = 49; i >= 0; i--) expect(hash01(i, 9)).toBe(forward[i]);
  });

  it('handles negative coordinates', () => {
    for (let i = -100; i < 0; i++) {
      const v = hash01(i, 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('noise', () => {
  it('is continuous across lattice boundaries', () => {
    // A discontinuity at an integer would show up as a kink in the road.
    for (const fn of [valueNoise1, gradNoise1]) {
      for (let i = -5; i < 5; i++) {
        const before = fn(i - 1e-6, 11);
        const after = fn(i + 1e-6, 11);
        expect(Math.abs(after - before)).toBeLessThan(1e-4);
      }
    }
  });

  it('is evaluable out of order — the property the whole world rests on', () => {
    const inOrder: number[] = [];
    for (let s = 0; s < 200; s++) inOrder.push(fbm1(s * 0.01, 5));
    // Jump straight to a far point without having generated what precedes it.
    expect(fbm1(199 * 0.01, 5)).toBe(inOrder[199]);
    expect(fbm1(3 * 0.01, 5)).toBe(inOrder[3]);
  });

  it('stays roughly within its nominal range', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 20000; i++) {
      const v = fbm1(i * 0.013, 1);
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(min).toBeGreaterThan(-1.3);
    expect(max).toBeLessThan(1.3);
  });

  it('2D noise varies along both axes', () => {
    expect(valueNoise2(0.5, 0.5, 1)).not.toBe(valueNoise2(1.5, 0.5, 1));
    expect(valueNoise2(0.5, 0.5, 1)).not.toBe(valueNoise2(0.5, 1.5, 1));
  });

  it('ridged noise stays in [0, 1]', () => {
    for (let i = 0; i < 5000; i++) {
      const v = ridged1(i * 0.017, 2);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
