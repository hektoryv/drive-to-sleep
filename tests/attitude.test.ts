import { describe, expect, it } from 'vitest';
import {
  createAttitudeState,
  jolt,
  stepAttitude,
  type AttitudeInput,
} from '../src/sim/attitude.js';
import { ATTITUDE } from '../src/sim/tuning.js';

const DT = 1 / 120;

const STILL: AttitudeInput = {
  lateralAccel: 0,
  longAccel: 0,
  speedMs: 0,
  roughness: 0,
  roughnessNoise: 0.5,
};

function settle(input: Partial<AttitudeInput>, seconds = 4) {
  const state = createAttitudeState();
  const full: AttitudeInput = { ...STILL, ...input };
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) stepAttitude(state, full, DT);
  return state;
}

describe('roll', () => {
  it('leans outward, away from the corner', () => {
    // A right-hand turn accelerates the car to its right, and the body goes
    // left — outward, as a real one does. Getting this backwards looks
    // instantly and unmistakably wrong even to someone who could not say why.
    const right = settle({ lateralAccel: 6 });
    expect(right.roll.x).toBeLessThan(0);

    const left = settle({ lateralAccel: -6 });
    expect(left.roll.x).toBeGreaterThan(0);
  });

  it('leans further the harder the corner', () => {
    const gentle = Math.abs(settle({ lateralAccel: 2 }).roll.x);
    const hard = Math.abs(settle({ lateralAccel: 6 }).roll.x);
    expect(hard).toBeGreaterThan(gentle * 2);
  });

  it('caps at the authored maximum', () => {
    const extreme = settle({ lateralAccel: 500 });
    expect(Math.abs(extreme.roll.x)).toBeLessThanOrEqual(ATTITUDE.ROLL_MAX + 1e-9);
  });

  it('overshoots once on turn-in — this is the weight, not a bug', () => {
    const state = createAttitudeState();
    const input: AttitudeInput = { ...STILL, lateralAccel: 6 };
    let peak = 0;
    for (let i = 0; i < 600; i++) {
      stepAttitude(state, input, DT);
      peak = Math.max(peak, Math.abs(state.roll.x));
    }
    const settled = Math.abs(state.roll.x);
    expect(peak).toBeGreaterThan(settled * 1.02);
    // One soft bounce, not a wobble.
    expect(peak).toBeLessThan(settled * 1.25);
  });

  it('settles back to level when the corner ends', () => {
    const state = createAttitudeState();
    const turning: AttitudeInput = { ...STILL, lateralAccel: 6 };
    for (let i = 0; i < 300; i++) stepAttitude(state, turning, DT);
    for (let i = 0; i < 600; i++) stepAttitude(state, STILL, DT);
    expect(Math.abs(state.roll.x)).toBeLessThan(0.001);
  });
});

describe('pitch', () => {
  it('squats under acceleration and dives under braking', () => {
    expect(settle({ longAccel: 4 }).pitch.x).toBeGreaterThan(0);
    expect(settle({ longAccel: -4 }).pitch.x).toBeLessThan(0);
  });

  it('caps at the authored maximum', () => {
    expect(Math.abs(settle({ longAccel: -500 }).pitch.x)).toBeLessThanOrEqual(
      ATTITUDE.PITCH_MAX + 1e-9,
    );
  });
});

describe('heave and rumble', () => {
  it('stays still on smooth tarmac at rest', () => {
    const state = settle({});
    expect(Math.abs(state.heave.x)).toBeLessThan(1e-6);
  });

  it('shakes on a rough surface', () => {
    const state = createAttitudeState();
    let peak = 0;
    for (let i = 0; i < 1200; i++) {
      stepAttitude(
        state,
        { ...STILL, speedMs: 25, roughness: 1, roughnessNoise: (i * 0.37) % 1 },
        DT,
      );
      peak = Math.max(peak, Math.abs(state.heave.x));
    }
    expect(peak).toBeGreaterThan(0.005);
  });

  it('is capped, so a bad surface never throws the camera off', () => {
    const state = createAttitudeState();
    for (let i = 0; i < 5000; i++) {
      stepAttitude(state, { ...STILL, speedMs: 54, roughness: 1, roughnessNoise: i % 2 }, DT);
      expect(Math.abs(state.heave.x)).toBeLessThanOrEqual(ATTITUDE.HEAVE_MAX_M + 1e-9);
    }
  });

  it('spaces bumps by distance, not by time', () => {
    // Otherwise a rough surface becomes a hum whose pitch rises with speed,
    // which reads as a broken engine rather than as a texture.
    function kicks(speedMs: number, seconds: number): number {
      const state = createAttitudeState();
      let count = 0;
      let previous = 0;
      const steps = Math.round(seconds / DT);
      for (let i = 0; i < steps; i++) {
        stepAttitude(state, { ...STILL, speedMs, roughness: 1, roughnessNoise: 1 }, DT);
        if (state.heave.v > previous + 0.01) count++;
        previous = state.heave.v;
      }
      return count;
    }
    // Twice the speed over the same time covers twice the ground, so it should
    // take roughly twice as many bumps.
    const slow = kicks(10, 6);
    const fast = kicks(20, 6);
    expect(fast).toBeGreaterThan(slow * 1.5);
  });

  it('is deterministic for the same noise sequence', () => {
    const a = createAttitudeState();
    const b = createAttitudeState();
    for (let i = 0; i < 2000; i++) {
      const input = { ...STILL, speedMs: 30, roughness: 0.8, roughnessNoise: (i * 0.13) % 1 };
      stepAttitude(a, input, DT);
      stepAttitude(b, input, DT);
    }
    expect(b.heave.x).toBe(a.heave.x);
  });
});

describe('jolt', () => {
  it('disturbs every axis at once', () => {
    const state = createAttitudeState();
    jolt(state, 1, 1);
    expect(state.heave.v).not.toBe(0);
    expect(state.pitch.v).not.toBe(0);
    expect(state.roll.v).not.toBe(0);
  });

  it('settles back on its own', () => {
    const state = createAttitudeState();
    jolt(state, 1, -1);
    for (let i = 0; i < 1200; i++) stepAttitude(state, STILL, DT);
    expect(Math.abs(state.heave.x)).toBeLessThan(0.001);
    expect(Math.abs(state.roll.x)).toBeLessThan(0.001);
  });

  it('scales with severity', () => {
    const light = createAttitudeState();
    const heavy = createAttitudeState();
    jolt(light, 0.2, 0);
    jolt(heavy, 1, 0);
    expect(Math.abs(heavy.heave.v)).toBeGreaterThan(Math.abs(light.heave.v) * 3);
  });
});

describe('frame-rate independence', () => {
  it('settles to the same lean at 60 Hz and 120 Hz', () => {
    // The springs are the whole reason the simulation is fixed-step (ADR-0002).
    // If this ever drifts apart, the car feels different on different phones.
    const input: AttitudeInput = { ...STILL, lateralAccel: 5 };
    const coarse = createAttitudeState();
    const fine = createAttitudeState();
    for (let i = 0; i < 240; i++) stepAttitude(coarse, input, 1 / 60);
    for (let i = 0; i < 480; i++) stepAttitude(fine, input, 1 / 120);
    expect(fine.roll.x).toBeCloseTo(coarse.roll.x, 3);
  });
});
