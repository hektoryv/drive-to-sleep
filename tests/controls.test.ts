import { describe, expect, it } from 'vitest';
import {
  applyDeadzone,
  createControlsState,
  driftOrigin,
  makePointerSample,
  steerCurve,
  stepControls,
  type ControlOptions,
  type PointerSample,
} from '../src/input/controls.js';
import { CONTROL } from '../src/input/tuning.js';

const DT = 1 / 120;
const SCREEN: ControlOptions = {
  screenWidth: 412,
  screenHeight: 915,
  sensitivity: 1,
  invertY: false,
};

const STEER_RADIUS = 412 * CONTROL.STEER_RADIUS_FRAC;
const THROTTLE_RADIUS = 915 * CONTROL.THROTTLE_RADIUS_FRAC;
const BRAKE_RADIUS = 915 * CONTROL.BRAKE_RADIUS_FRAC;

function touchAt(originX: number, originY: number, x = originX, y = originY): PointerSample {
  return { active: true, originX, originY, currentX: x, currentY: y };
}

/** Holds a finger position for a while and returns the settled controls. */
function hold(pointer: PointerSample, seconds = 0.5, options: ControlOptions = SCREEN) {
  const state = createControlsState();
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) stepControls(state, pointer, options, DT);
  return { state, out: state.out };
}

describe('deadzone', () => {
  it('ignores a resting thumb', () => {
    expect(applyDeadzone(0.02, 0.04)).toBe(0);
    expect(applyDeadzone(-0.02, 0.04)).toBe(0);
  });

  it('still reaches full output at full travel', () => {
    // Without the rescale, a deadzone quietly costs you the top of your lock.
    expect(applyDeadzone(1, 0.04)).toBeCloseTo(1, 10);
    expect(applyDeadzone(-1, 0.04)).toBeCloseTo(-1, 10);
  });

  it('is continuous at the edge of the zone', () => {
    const just = applyDeadzone(0.0401, 0.04);
    expect(Math.abs(just)).toBeLessThan(0.01);
  });
});

describe('steering curve', () => {
  it('is shallow near the centre, for corrections at speed', () => {
    expect(Math.abs(steerCurve(0.25))).toBeLessThan(0.25);
  });

  it('reaches exactly full lock at full travel', () => {
    expect(steerCurve(1)).toBeCloseTo(1, 10);
    expect(steerCurve(-1)).toBeCloseTo(-1, 10);
  });

  it('is odd and monotonic — no dead spots, no sudden steps', () => {
    expect(steerCurve(-0.4)).toBeCloseTo(-steerCurve(0.4), 10);
    let previous = -1;
    for (let x = -1; x <= 1; x += 0.02) {
      const v = steerCurve(x);
      expect(v).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = v;
    }
  });
});

describe('origin drag', () => {
  it('stays put while the finger is within reach', () => {
    expect(driftOrigin(200, 210, 90)).toBe(200);
    expect(driftOrigin(200, 289, 90)).toBe(200);
    expect(driftOrigin(200, 111, 90)).toBe(200);
  });

  it('never lets the finger get further than one radius away', () => {
    // The whole mechanism: push past full deflection and the origin comes
    // with you, so the edge of the screen is never a limit.
    expect(Math.abs(600 - driftOrigin(200, 600, 90))).toBeCloseTo(90, 6);
    expect(Math.abs(-400 - driftOrigin(200, -400, 90))).toBeCloseTo(90, 6);
  });

  it('never moves on its own', () => {
    // The version that crept toward the finger silently un-steered the car
    // during a held corner (ADR-0013). Holding still must change nothing,
    // however long it is held.
    let origin = 200;
    for (let i = 0; i < 10000; i++) origin = driftOrigin(origin, 260, 90);
    expect(origin).toBe(200);
  });
});

describe('steering from a finger', () => {
  it('is neutral where the finger went down', () => {
    const { out } = hold(touchAt(200, 500));
    expect(out.steer).toBe(0);
    expect(out.active).toBe(true);
  });

  it('steers right for a finger to the right', () => {
    const { out } = hold(touchAt(200, 500, 200 + STEER_RADIUS, 500), 0.1);
    expect(out.steer).toBeGreaterThan(0.9);
  });

  it('steers left for a finger to the left', () => {
    const { out } = hold(touchAt(200, 500, 200 - STEER_RADIUS, 500), 0.1);
    expect(out.steer).toBeLessThan(-0.9);
  });

  it('works the same from either side of the screen', () => {
    // Nothing is anchored to a corner: it has to work for either thumb, at any
    // grip, without looking at the screen (ADR-0004).
    const left = hold(touchAt(60, 700, 60 + STEER_RADIUS * 0.5, 700), 0.1);
    const right = hold(touchAt(350, 700, 350 + STEER_RADIUS * 0.5, 700), 0.1);
    expect(left.out.steer).toBeCloseTo(right.out.steer, 6);
  });

  it('scales with the sensitivity setting', () => {
    const pointer = touchAt(200, 500, 200 + STEER_RADIUS * 0.5, 500);
    const normal = hold(pointer, 0.1);
    const low = hold(pointer, 0.1, { ...SCREEN, sensitivity: 1.5 });
    expect(Math.abs(low.out.steer)).toBeLessThan(Math.abs(normal.out.steer));
  });
});

describe('pedals', () => {
  it('opens the throttle for a finger above the origin', () => {
    const { out } = hold(touchAt(200, 500, 200, 500 - THROTTLE_RADIUS), 0.1);
    expect(out.throttle).toBeCloseTo(1, 2);
    expect(out.brake).toBe(0);
  });

  it('brakes for a finger below the origin', () => {
    const { out } = hold(touchAt(200, 500, 200, 500 + BRAKE_RADIUS), 0.1);
    expect(out.brake).toBeCloseTo(1, 2);
    expect(out.throttle).toBe(0);
  });

  it('reaches the brakes sooner than full throttle', () => {
    // The brakes should feel eager: a shorter travel than the throttle.
    expect(CONTROL.BRAKE_RADIUS_FRAC).toBeLessThan(CONTROL.THROTTLE_RADIUS_FRAC);
  });

  it('never applies both pedals at once', () => {
    for (const dy of [-120, -40, 0, 40, 120]) {
      const { out } = hold(touchAt(200, 500, 200, 500 + dy), 0.1);
      expect(Math.min(out.throttle, out.brake)).toBe(0);
    }
  });

  it('swaps the pedals when inverted', () => {
    const pointer = touchAt(200, 500, 200, 500 - THROTTLE_RADIUS);
    const normal = hold(pointer, 0.1);
    const inverted = hold(pointer, 0.1, { ...SCREEN, invertY: true });
    expect(normal.out.throttle).toBeGreaterThan(0.9);
    expect(inverted.out.brake).toBeGreaterThan(0.9);
  });

  it('keeps steering and pedals independent', () => {
    const { out } = hold(
      touchAt(200, 500, 200 + STEER_RADIUS, 500 - THROTTLE_RADIUS),
      0.1,
    );
    expect(out.steer).toBeGreaterThan(0.9);
    expect(out.throttle).toBeCloseTo(1, 2);
  });
});

describe('lift-off', () => {
  it('returns to centre rather than snapping', () => {
    const state = createControlsState();
    const down = touchAt(200, 500, 200 + STEER_RADIUS, 500);
    for (let i = 0; i < 60; i++) stepControls(state, down, SCREEN, DT);
    expect(state.out.steer).toBeGreaterThan(0.9);

    const up = makePointerSample();
    stepControls(state, up, SCREEN, DT);
    // One frame later it must have moved, but nowhere near all the way.
    expect(state.out.steer).toBeLessThan(0.999);
    expect(state.out.steer).toBeGreaterThan(0.9);
  });

  it('settles to neutral within about a third of a second', () => {
    const state = createControlsState();
    const down = touchAt(200, 500, 200 + STEER_RADIUS, 500);
    for (let i = 0; i < 60; i++) stepControls(state, down, SCREEN, DT);

    const up = makePointerSample();
    for (let i = 0; i < Math.round(0.35 / DT); i++) stepControls(state, up, SCREEN, DT);
    expect(Math.abs(state.out.steer)).toBeLessThan(0.15);
  });

  it('coasts rather than braking', () => {
    // Putting the phone down should feel like taking your hands off the wheel
    // on a straight, not like crashing.
    const state = createControlsState();
    const down = touchAt(200, 500, 200, 500 - THROTTLE_RADIUS);
    for (let i = 0; i < 60; i++) stepControls(state, down, SCREEN, DT);

    const up = makePointerSample();
    for (let i = 0; i < 120; i++) stepControls(state, up, SCREEN, DT);
    expect(state.out.brake).toBeLessThan(0.01);
    expect(state.out.throttle).toBeLessThan(0.05);
    expect(state.out.active).toBe(false);
  });

  it('adopts a fresh origin on the next touch', () => {
    const state = createControlsState();
    for (let i = 0; i < 60; i++) stepControls(state, touchAt(100, 400, 180, 400), SCREEN, DT);
    for (let i = 0; i < 60; i++) stepControls(state, makePointerSample(), SCREEN, DT);
    for (let i = 0; i < 2; i++) stepControls(state, touchAt(300, 800), SCREEN, DT);
    expect(state.originX).toBeCloseTo(300, 0);
    expect(state.out.steer).toBe(0);
  });
});

describe('robustness', () => {
  it('survives a zero-sized screen without producing NaN', () => {
    const { out } = hold(touchAt(0, 0, 10, 10), 0.1, {
      screenWidth: 0,
      screenHeight: 0,
      sensitivity: 1,
      invertY: false,
    });
    expect(Number.isFinite(out.steer)).toBe(true);
    expect(Number.isFinite(out.throttle)).toBe(true);
  });

  it('clamps output to its declared range however far the finger goes', () => {
    const { out } = hold(touchAt(200, 500, 99999, -99999), 0.5);
    expect(Math.abs(out.steer)).toBeLessThanOrEqual(1);
    expect(out.throttle).toBeLessThanOrEqual(1);
    expect(out.brake).toBeLessThanOrEqual(1);
  });

  it('holds full lock indefinitely without the origin running away', () => {
    // 30 seconds of a held corner. The backstop must keep the output pinned
    // at full rather than letting the origin catch up and neutralise it.
    const state = createControlsState();
    const pointer = touchAt(200, 500, 200 + STEER_RADIUS * 3, 500);
    for (let i = 0; i < Math.round(30 / DT); i++) stepControls(state, pointer, SCREEN, DT);
    expect(state.out.steer).toBeGreaterThan(0.95);
  });
});
