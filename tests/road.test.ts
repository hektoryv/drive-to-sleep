import { describe, expect, it } from 'vitest';
import { curvatureAt, gradeAt, halfWidthAt, bankAt } from '../src/world/gen/fields.js';
import { eventAt, straightnessAt } from '../src/world/gen/events.js';
import {
  createStations,
  ensureUpTo,
  readStation,
  sampleAt,
  toRoadSpace,
} from '../src/world/gen/stations.js';
import { createRoad } from '../src/world/gen/road-query.js';
import { makeRoadSample } from '../src/contracts/world.js';
import { ROAD } from '../src/world/tuning.js';
import { wrapAngle } from '../src/core/math.js';

const SEED = 11;

describe('road fields', () => {
  it('are pure functions of distance — evaluable in any order', () => {
    // The property the whole world rests on: traffic spawns a kilometre ahead
    // and a resume point is a seed plus a distance, both of which require
    // reading a place without having been there.
    const forward: number[] = [];
    for (let s = 0; s < 5000; s += 13) forward.push(curvatureAt(s, SEED));
    let i = forward.length - 1;
    for (let s = Math.floor(4999 / 13) * 13; s >= 0; s -= 13, i--) {
      expect(curvatureAt(s, SEED)).toBe(forward[i]);
    }
  });

  it('differ between seeds', () => {
    let differences = 0;
    for (let s = 0; s < 3000; s += 37) {
      if (curvatureAt(s, 1) !== curvatureAt(s, 2)) differences++;
    }
    expect(differences).toBeGreaterThan(70);
  });

  it('are continuous — a jump in curvature would be a kink in the road', () => {
    for (let s = 0; s < 8000; s += 7) {
      const a = curvatureAt(s, SEED);
      const b = curvatureAt(s + 0.25, SEED);
      expect(Math.abs(b - a)).toBeLessThan(ROAD.CURVATURE_AMPLITUDE * 0.35);
    }
  });

  it('keep curvature inside a drivable range', () => {
    let tightest = Infinity;
    for (let s = 0; s < 40000; s += 3) {
      const k = Math.abs(curvatureAt(s, SEED));
      if (k > 1e-9) tightest = Math.min(tightest, 1 / k);
    }
    // Tighter than about 40 m is not a road, it is a car park.
    expect(tightest).toBeGreaterThan(40);
  });

  it('keep grade within something a car can climb', () => {
    for (let s = 0; s < 40000; s += 3) {
      expect(Math.abs(gradeAt(s, SEED))).toBeLessThanOrEqual(ROAD.MAX_GRADE);
    }
  });

  it('keep the road a sensible width', () => {
    for (let s = 0; s < 20000; s += 11) {
      const hw = halfWidthAt(s, SEED);
      expect(hw).toBeGreaterThan(2.2);
      expect(hw).toBeLessThan(5.5);
    }
  });

  it('bank into corners, never away from them, and never past the cap', () => {
    for (let s = 0; s < 20000; s += 7) {
      const k = curvatureAt(s, SEED);
      const bank = bankAt(s, SEED);
      expect(Math.abs(bank)).toBeLessThanOrEqual(ROAD.BANK_MAX + 1e-9);
      if (Math.abs(k) > 1e-5) expect(Math.sign(bank)).toBe(Math.sign(k));
    }
  });
});

describe('road events', () => {
  it('are deterministic per slot', () => {
    for (let i = -5; i < 40; i++) {
      expect(eventAt(i, SEED)).toEqual(eventAt(i, SEED));
    }
  });

  it('produce a mix of kinds rather than one repeated shape', () => {
    const kinds = new Set<string>();
    for (let i = 0; i < 200; i++) kinds.add(eventAt(i, SEED).kind);
    expect(kinds.size).toBeGreaterThanOrEqual(4);
  });

  it('actually flatten the road where a straight is asked for', () => {
    // The point of the straightness mask: a straight must be straight, not
    // merely less bendy than average, or the road has no rhythm.
    let sawStraight = false;
    for (let i = 0; i < 300 && !sawStraight; i++) {
      const e = eventAt(i, SEED);
      if (e.kind !== 'straight') continue;
      const middle = e.s0 + e.length / 2;
      expect(straightnessAt(middle, SEED)).toBeLessThan(0.45);
      sawStraight = true;
    }
    expect(sawStraight).toBe(true);
  });

  it('give the road real variety in curvature, not uniform wiggle', () => {
    // Guards the failure mode the roadmap warns about: noise alone yields an
    // endless run of medium corners. Check both extremes actually occur.
    let straightish = 0;
    let hard = 0;
    for (let s = 0; s < 60000; s += 5) {
      const k = Math.abs(curvatureAt(s, SEED));
      if (k < ROAD.CURVATURE_AMPLITUDE * 0.08) straightish++;
      if (k > ROAD.CURVATURE_AMPLITUDE * 1.5) hard++;
    }
    expect(straightish).toBeGreaterThan(300);
    expect(hard).toBeGreaterThan(100);
  });
});

describe('stations', () => {
  it('integrate a path whose heading matches the curvature field', () => {
    const st = createStations(SEED);
    ensureUpTo(st, 400);
    const a = makeRoadSample();
    const b = makeRoadSample();
    for (let i = 5; i < 395; i++) {
      readStation(st, i, a);
      readStation(st, i + 1, b);
      const expected = -curvatureAt(a.s, SEED) * st.spacing;
      expect(wrapAngle(b.heading - a.heading)).toBeCloseTo(expected, 4);
    }
  });

  it('advance by the station spacing in true arc length, including up hills', () => {
    const st = createStations(SEED);
    ensureUpTo(st, 600);
    const a = makeRoadSample();
    const b = makeRoadSample();
    for (let i = 0; i < 590; i++) {
      readStation(st, i, a);
      readStation(st, i + 1, b);
      const arc = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      expect(arc).toBeCloseTo(st.spacing, 2);
    }
  });

  it('are deterministic — the same seed gives byte-identical geometry', () => {
    const a = createStations(SEED);
    const b = createStations(SEED);
    ensureUpTo(a, 900);
    // Generated in two goes, to prove that where you stop does not matter.
    ensureUpTo(b, 300);
    ensureUpTo(b, 900);
    expect(Array.from(a.x)).toEqual(Array.from(b.x));
    expect(Array.from(a.y)).toEqual(Array.from(b.y));
    expect(Array.from(a.heading)).toEqual(Array.from(b.heading));
  });

  it('recycle the ring buffer without growing', () => {
    const st = createStations(SEED);
    const before = st.x.length;
    ensureUpTo(st, st.capacity * 3);
    expect(st.x.length).toBe(before);
    expect(st.nextIndex - st.firstIndex).toBe(st.capacity);
    expect(st.firstIndex).toBe(st.capacity * 3 + 1 - st.capacity);
  });

  it('interpolate between stations without jumping at the boundaries', () => {
    const st = createStations(SEED);
    ensureUpTo(st, 200);
    const out = makeRoadSample();
    let prevX = sampleAt(st, 100, out).x;
    let prevZ = out.z;
    for (let s = 100; s < 500; s += 0.5) {
      sampleAt(st, s, out);
      expect(Math.hypot(out.x - prevX, out.z - prevZ)).toBeLessThan(0.75);
      prevX = out.x;
      prevZ = out.z;
    }
  });

  it('round-trip world space back to road space', () => {
    const st = createStations(SEED);
    ensureUpTo(st, 500);
    const sample = makeRoadSample();
    const out = { s: 0, t: 0 };
    for (let s = 40; s < 1800; s += 17) {
      sampleAt(st, s, sample);
      // Step out sideways by a known amount and check we get it back.
      const rx = Math.cos(sample.heading);
      const rz = -Math.sin(sample.heading);
      const offset = 2.5;
      toRoadSpace(st, sample.x + rx * offset, sample.z + rz * offset, s, out);
      expect(out.s).toBeCloseTo(s, 1);
      expect(out.t).toBeCloseTo(offset, 1);
    }
  });
});

describe('road query', () => {
  it('reports the surface by distance from the centreline', () => {
    const road = createRoad(SEED);
    road.ensureSpan(0);
    const sample = makeRoadSample();
    road.sampleAt(500, sample);
    expect(road.surfaceAt(500, 0)).toBe('tarmac');
    expect(road.surfaceAt(500, sample.halfWidth - 0.1)).toBe('tarmac');
    expect(road.surfaceAt(500, sample.halfWidth + 0.3)).toBe('gravel');
    expect(road.surfaceAt(500, sample.halfWidth + 5)).toBe('grass');
    expect(road.surfaceAt(500, -(sample.halfWidth + 5))).toBe('grass');
  });

  it('generates ahead of the car without being walked there', () => {
    const road = createRoad(SEED);
    road.ensureSpan(0);
    // Straight to 20 km: the resume case. It must not throw or return NaN.
    road.ensureSpan(20000);
    const sample = makeRoadSample();
    road.sampleAt(20000, sample);
    expect(Number.isFinite(sample.x)).toBe(true);
    expect(Number.isFinite(sample.y)).toBe(true);
    expect(Number.isFinite(sample.heading)).toBe(true);
  });

  it('puts a resumed drive in exactly the same place as a driven one', () => {
    // Resume is a seed plus a distance, so arriving at 8 km in one jump must
    // land where arriving in small steps does.
    const driven = createRoad(SEED);
    driven.ensureSpan(0);
    for (let s = 0; s < 8000; s += 250) driven.ensureSpan(s);
    const jumped = createRoad(SEED);
    jumped.ensureSpan(8000);

    const a = makeRoadSample();
    const b = makeRoadSample();
    driven.sampleAt(8000, a);
    jumped.sampleAt(8000, b);
    expect(b.x).toBe(a.x);
    expect(b.y).toBe(a.y);
    expect(b.heading).toBe(a.heading);
  });

  it('stays finite over a very long drive', () => {
    // Phase 7 asks what hour three looks like. This is the cheap version of
    // that question: 200 km of integration without drift into NaN.
    const road = createRoad(SEED);
    road.ensureSpan(200000);
    const sample = makeRoadSample();
    road.sampleAt(200000, sample);
    expect(Number.isFinite(sample.x)).toBe(true);
    expect(Number.isFinite(sample.z)).toBe(true);
    expect(Math.abs(sample.y)).toBeLessThan(50000);
  });
});
