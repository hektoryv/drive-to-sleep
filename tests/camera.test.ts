import { describe, expect, it } from 'vitest';
import {
  lookAheadDistance,
  makeLookAheadRig,
  resetLookAhead,
  updateLookAhead,
} from '../src/render/camera.js';
import { CAMERA } from '../src/render/tuning.js';
import { createRoad } from '../src/world/gen/road-query.js';

const DT = 1 / 120;

/** Runs the rig to rest against a fixed road heading. */
function settle(carHeading: number, aheadHeading: number, steps = 1200): number {
  const rig = makeLookAheadRig();
  for (let i = 0; i < steps; i++) updateLookAhead(rig, carHeading, aheadHeading, DT);
  return rig.yaw;
}

describe('look-ahead distance', () => {
  it('grows with speed, from a non-zero base', () => {
    expect(lookAheadDistance(0)).toBe(CAMERA.LOOKAHEAD_BASE_M);
    expect(lookAheadDistance(30)).toBeGreaterThan(lookAheadDistance(10));
  });

  it('looks a constant time ahead, not a constant distance', () => {
    // The whole point of the speed term: the *time* to the look-ahead point
    // should be stable, so corners read the same at 50 and at 180 km/h.
    const slow = (lookAheadDistance(14) - CAMERA.LOOKAHEAD_BASE_M) / 14;
    const fast = (lookAheadDistance(50) - CAMERA.LOOKAHEAD_BASE_M) / 50;
    expect(slow).toBeCloseTo(fast, 10);
  });

  it('never looks backwards if the car is somehow reversing', () => {
    expect(lookAheadDistance(-5)).toBeGreaterThan(0);
  });
});

describe('look-ahead rig', () => {
  it('stays centred on a straight road', () => {
    expect(settle(0.3, 0.3)).toBeCloseTo(0, 6);
  });

  it('turns toward the corner, in the right direction', () => {
    expect(settle(0, 0.4)).toBeGreaterThan(0);
    expect(settle(0, -0.4)).toBeLessThan(0);
  });

  it('turns only partway — a fully aligned view would read as no turn at all', () => {
    const delta = 0.2;
    const yaw = settle(0, delta);
    expect(yaw).toBeCloseTo(delta * CAMERA.FOLLOW_STRENGTH, 4);
    expect(Math.abs(yaw)).toBeLessThan(Math.abs(delta));
  });

  it('clamps at the maximum yaw however sharp the corner', () => {
    expect(settle(0, 3.0)).toBeCloseTo(CAMERA.MAX_YAW, 6);
    expect(settle(0, -3.0)).toBeCloseTo(-CAMERA.MAX_YAW, 6);
  });

  it('takes the short way round a heading that wraps', () => {
    // Car at +179°, road ahead at -179°: a 2° right turn, not a 358° left one.
    const yaw = settle((179 * Math.PI) / 180, (-179 * Math.PI) / 180);
    expect(yaw).toBeGreaterThan(0);
    expect(yaw).toBeLessThan(0.05);
  });

  it('never overshoots — camera overshoot reads as motion sickness', () => {
    const rig = makeLookAheadRig();
    const target = 0.2 * CAMERA.FOLLOW_STRENGTH;
    let peak = 0;
    for (let i = 0; i < 1200; i++) peak = Math.max(peak, updateLookAhead(rig, 0, 0.2, DT));
    expect(peak).toBeLessThanOrEqual(target + 1e-9);
  });

  it('is frame-rate independent', () => {
    const coarse = makeLookAheadRig();
    const fine = makeLookAheadRig();
    for (let i = 0; i < 60; i++) updateLookAhead(coarse, 0, 0.3, 1 / 60);
    for (let i = 0; i < 120; i++) updateLookAhead(fine, 0, 0.3, 1 / 120);
    expect(fine.yaw).toBeCloseTo(coarse.yaw, 6);
  });

  it('resets', () => {
    const rig = makeLookAheadRig();
    updateLookAhead(rig, 0, 0.4, DT);
    resetLookAhead(rig);
    expect(rig.yaw).toBe(0);
  });

  it('leads the car along the real generated road', () => {
    // Drive several kilometres of actual road and check the view is turned
    // into the corners rather than trailing behind the car.
    const road = createRoad(4);
    const speed = 110 / 3.6;
    road.ensureSpan(0);
    const rig = makeLookAheadRig();
    let s = 0;
    let leading = 0;
    let samples = 0;
    for (let i = 0; i < 30000; i++) {
      s += speed * DT;
      road.ensureSpan(s);
      const here = road.headingAt(s);
      const ahead = road.headingAt(s + lookAheadDistance(speed));
      updateLookAhead(rig, here, ahead, DT);
      const toAhead = ahead - here;
      // Only judge where the road is meaningfully turning; near an inflection
      // the sign flips and a smoothed camera is legitimately behind it.
      if (Math.abs(toAhead) > 0.02) {
        samples++;
        if (Math.sign(rig.yaw) === Math.sign(toAhead)) leading++;
      }
    }
    expect(samples).toBeGreaterThan(1000);
    expect(leading / samples).toBeGreaterThan(0.9);
  });
});
