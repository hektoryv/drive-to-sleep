import { describe, expect, it } from 'vitest';
import {
  createVehicleState,
  gripFor,
  slipAngle,
  steerAuthority,
  stepVehicle,
  thrustAt,
  type SurfaceConditions,
  type VehicleInput,
  type VehicleState,
} from '../src/sim/vehicle.js';
import { CAR, GRAVITY } from '../src/sim/tuning.js';

const DT = 1 / 120;
const FLAT: SurfaceConditions = { surface: 'tarmac', grade: 0 };

const COAST: VehicleInput = { steer: 0, throttle: 0, brake: 0 };
const FULL_THROTTLE: VehicleInput = { steer: 0, throttle: 1, brake: 0 };

function drive(
  state: VehicleState,
  input: VehicleInput,
  seconds: number,
  conditions: SurfaceConditions = FLAT,
): VehicleState {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) stepVehicle(state, input, conditions, DT);
  return state;
}

/** Seconds of full throttle from rest to reach a speed. */
function timeTo(targetKmh: number): number {
  const state = createVehicleState();
  const target = targetKmh / 3.6;
  for (let i = 0; i < 120 * 60; i++) {
    stepVehicle(state, FULL_THROTTLE, FLAT, DT);
    if (state.speedMs >= target) return i * DT;
  }
  return Infinity;
}

describe('longitudinal', () => {
  it('reaches a top speed close to the intended one', () => {
    const state = drive(createVehicleState(), FULL_THROTTLE, 120);
    const kmh = state.speedMs * 3.6;
    // Drag, not the clamp, should be what settles it — if this is pinned at
    // exactly the cap, the drag coefficient is doing nothing.
    expect(kmh).toBeGreaterThan(170);
    expect(kmh).toBeLessThanOrEqual(195.01);
  });

  it('accelerates like a fast 1970s road car, not a supercar or a milk float', () => {
    const toHundred = timeTo(100);
    expect(toHundred).toBeGreaterThan(4.5);
    expect(toHundred).toBeLessThan(11);
  });

  it('pulls hardest low down', () => {
    // A naturally aspirated engine, shaped as a curve because there is no
    // gearbox to model (ADR-0004).
    expect(thrustAt(0)).toBeGreaterThan(thrustAt(CAR.TOP_SPEED_MS * 0.5));
    expect(thrustAt(CAR.TOP_SPEED_MS * 0.5)).toBeGreaterThan(thrustAt(CAR.TOP_SPEED_MS));
  });

  it('coasts down slowly rather than braking by itself', () => {
    const state = createVehicleState();
    state.speedMs = 30;
    drive(state, COAST, 3);
    expect(state.speedMs).toBeLessThan(30);
    // Lifting off must not feel like standing on the brakes: the game expects
    // you to take your thumb off and keep rolling (ADR-0004).
    expect(state.speedMs).toBeGreaterThan(24);
  });

  it('stops under braking and never reverses', () => {
    const state = createVehicleState();
    state.speedMs = 30;
    drive(state, { steer: 0, throttle: 0, brake: 1 }, 10);
    expect(state.speedMs).toBe(0);
  });

  it('brakes within a plausible distance from 100 km/h', () => {
    const state = createVehicleState();
    state.speedMs = 100 / 3.6;
    const start = state.odometerM;
    for (let i = 0; i < 120 * 20 && state.speedMs > 0.1; i++) {
      stepVehicle(state, { steer: 0, throttle: 0, brake: 1 }, FLAT, DT);
    }
    const distance = state.odometerM - start;
    expect(distance).toBeGreaterThan(30);
    expect(distance).toBeLessThan(60);
  });

  it('loses speed climbing and gains it descending', () => {
    const up = createVehicleState();
    up.speedMs = 30;
    drive(up, COAST, 4, { surface: 'tarmac', grade: 0.07 });

    const down = createVehicleState();
    down.speedMs = 30;
    drive(down, COAST, 4, { surface: 'tarmac', grade: -0.07 });

    expect(down.speedMs).toBeGreaterThan(up.speedMs + 3);
  });

  it('bogs down off the tarmac', () => {
    const road = createVehicleState();
    road.speedMs = 30;
    drive(road, FULL_THROTTLE, 4);

    const grass = createVehicleState();
    grass.speedMs = 30;
    drive(grass, FULL_THROTTLE, 4, { surface: 'grass', grade: 0 });

    expect(grass.speedMs).toBeLessThan(road.speedMs);
  });
});

describe('steering', () => {
  it('turns right for positive steer', () => {
    // Heading *decreases* to the right — forward is -Z. Getting this backwards
    // is what sent the autopilot into a field the first time.
    const state = createVehicleState();
    state.speedMs = 20;
    drive(state, { steer: 1, throttle: 0, brake: 0 }, 1);
    expect(state.heading).toBeLessThan(0);
    expect(state.yawRate).toBeLessThan(0);
  });

  it('turns left for negative steer', () => {
    const state = createVehicleState();
    state.speedMs = 20;
    drive(state, { steer: -1, throttle: 0, brake: 0 }, 1);
    expect(state.heading).toBeGreaterThan(0);
  });

  it('gives full authority at low speed and much less at the top end', () => {
    expect(steerAuthority(0)).toBe(1);
    expect(steerAuthority(CAR.STEER_FALLOFF_START_MS)).toBe(1);
    expect(steerAuthority(CAR.TOP_SPEED_MS)).toBeCloseTo(CAR.STEER_FALLOFF_MIN, 6);
  });

  it('falls off monotonically, so there is no speed where it gets twitchier', () => {
    let previous = 1;
    for (let v = 0; v <= CAR.TOP_SPEED_MS; v += 1) {
      const a = steerAuthority(v);
      expect(a).toBeLessThanOrEqual(previous + 1e-9);
      previous = a;
    }
  });

  it('shows the wheel where the thumb is, at every speed', () => {
    // ADR-0004: the speed falloff applies to the *effect*, never to the
    // displayed angle, or the wheel and the finger would disagree.
    for (const speed of [5, 20, 50]) {
      const state = createVehicleState();
      state.speedMs = speed;
      drive(state, { steer: 1, throttle: 0, brake: 0 }, 2);
      expect(state.steerAngle).toBeCloseTo(CAR.MAX_STEER_RAD, 3);
    }
  });

  it('turns in over a moment rather than instantly', () => {
    // Instant yaw is the single most video-game-feeling thing a car can do.
    const state = createVehicleState();
    state.speedMs = 25;
    stepVehicle(state, { steer: 1, throttle: 0, brake: 0 }, FLAT, DT);
    const afterOneStep = Math.abs(state.yawRate);
    drive(state, { steer: 1, throttle: 0, brake: 0 }, 1);
    expect(afterOneStep).toBeLessThan(Math.abs(state.yawRate) * 0.3);
  });
});

describe('grip', () => {
  it('never exceeds the tyres, however hard the wheel is turned', () => {
    // The clamp is where understeer comes from, and it is the one thing in the
    // model that must hold at every speed.
    const limit = CAR.GRIP_TARMAC * CAR.LATERAL_GRIP_SCALE * GRAVITY;
    for (const speed of [10, 25, 40, 54]) {
      const state = createVehicleState();
      state.speedMs = speed;
      drive(state, { steer: 1, throttle: 0, brake: 0 }, 3);
      expect(Math.abs(state.lateralAccel)).toBeLessThanOrEqual(limit * 1.02);
    }
  });

  it('understeers at speed — the same lock turns a wider circle', () => {
    function radius(speed: number): number {
      const state = createVehicleState();
      state.speedMs = speed;
      drive(state, { steer: 1, throttle: 0, brake: 0 }, 3);
      return Math.abs(state.speedMs / state.yawRate);
    }
    expect(radius(45)).toBeGreaterThan(radius(15) * 2);
  });

  it('grips less on gravel than tarmac, and less again on grass', () => {
    expect(gripFor('tarmac')).toBeGreaterThan(gripFor('gravel'));
    expect(gripFor('gravel')).toBeGreaterThan(gripFor('grass'));
  });

  it('turns more slowly on grass than on tarmac at the same lock', () => {
    const road = createVehicleState();
    road.speedMs = 25;
    drive(road, { steer: 1, throttle: 0, brake: 0 }, 2);

    const grass = createVehicleState();
    grass.speedMs = 25;
    drive(grass, { steer: 1, throttle: 0, brake: 0 }, 2, { surface: 'grass', grade: 0 });

    expect(Math.abs(grass.yawRate)).toBeLessThan(Math.abs(road.yawRate));
  });

  it('reports lateral acceleration toward the outside of the turn', () => {
    // Turning right accelerates the car to its right — positive by the
    // convention in contracts/vehicle.ts. This was wrong once and the sign
    // silently propagated into the body roll.
    const state = createVehicleState();
    state.speedMs = 25;
    drive(state, { steer: 1, throttle: 0, brake: 0 }, 2);
    expect(state.lateralAccel).toBeGreaterThan(0);
  });
});

describe('slide', () => {
  it('does not slide when driven within the limit', () => {
    // 12% lock at 54 km/h is about a 50 m radius, well inside the tyres.
    // Note how little lock that is: at this speed a third of the travel is
    // already at the grip limit, which is the steering falloff doing its job.
    const state = createVehicleState();
    state.speedMs = 15;
    drive(state, { steer: 0.12, throttle: 0, brake: 0 }, 3);
    expect(Math.abs(slipAngle(state))).toBeLessThan(0.02);
  });

  it('slides when asked for more rotation than the tyres can give', () => {
    const state = createVehicleState();
    state.speedMs = 45;
    drive(state, { steer: 1, throttle: 0, brake: 0 }, 2);
    expect(Math.abs(state.lateralMs)).toBeGreaterThan(0.5);
  });

  it('recovers when the wheel is straightened', () => {
    const state = createVehicleState();
    state.speedMs = 45;
    drive(state, { steer: 1, throttle: 0, brake: 0 }, 2);
    const sliding = Math.abs(state.lateralMs);
    drive(state, COAST, 3);
    expect(Math.abs(state.lateralMs)).toBeLessThan(sliding * 0.2);
  });

  it('is capped, so a slide cannot become a departure', () => {
    const state = createVehicleState();
    state.speedMs = CAR.TOP_SPEED_MS;
    drive(state, { steer: 1, throttle: 1, brake: 0 }, 10);
    expect(Math.abs(state.lateralMs)).toBeLessThanOrEqual(CAR.MAX_SLIDE_MS + 1e-6);
  });
});

describe('robustness', () => {
  it('is deterministic — the same inputs give the same trajectory', () => {
    const a = createVehicleState();
    const b = createVehicleState();
    const input = { steer: 0.4, throttle: 0.8, brake: 0 };
    drive(a, input, 20);
    drive(b, input, 20);
    expect(b.x).toBe(a.x);
    expect(b.z).toBe(a.z);
    expect(b.heading).toBe(a.heading);
  });

  it('stays finite under absurd input', () => {
    const state = createVehicleState();
    for (let i = 0; i < 20000; i++) {
      stepVehicle(
        state,
        { steer: Math.sin(i * 0.31) * 40, throttle: 9, brake: i % 7 === 0 ? 9 : 0 },
        i % 3 === 0 ? { surface: 'grass', grade: 0.4 } : FLAT,
        DT,
      );
    }
    expect(Number.isFinite(state.x)).toBe(true);
    expect(Number.isFinite(state.heading)).toBe(true);
    expect(state.speedMs).toBeGreaterThanOrEqual(0);
    expect(state.speedMs).toBeLessThanOrEqual(CAR.TOP_SPEED_MS);
  });

  it('does not creep when parked', () => {
    const state = createVehicleState();
    drive(state, { steer: 1, throttle: 0, brake: 1 }, 5);
    expect(state.speedMs).toBe(0);
    expect(Math.hypot(state.x, state.z)).toBeLessThan(0.5);
  });
});
