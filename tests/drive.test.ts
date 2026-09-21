/**
 * The car on the actual generated road.
 *
 * These are the tests that matter most: everything else checks a piece, and
 * this checks the pieces together on a real 20 km of road, through the same
 * `stepDrive` the game runs.
 */

import { describe, expect, it } from 'vitest';
import { createRoad } from '../src/world/gen/road-query.js';
import { createAutopilot } from '../src/sim/autopilot.js';
import { createDriveState, placeOnRoad, stepDrive, type DriveState } from '../src/sim/drive.js';
import type { VehicleInput } from '../src/sim/vehicle.js';
import { CAR, GRAVITY } from '../src/sim/tuning.js';

const DT = 1 / 120;

interface Summary {
  state: DriveState;
  distanceM: number;
  offRoadSteps: number;
  steps: number;
  peakLateralG: number;
  peakRollDeg: number;
  maxAbsLateralM: number;
  minSpeedMs: number;
  maxSpeedMs: number;
}

/** Drives under autopilot and reports what happened. */
function autopilotDrive(seed: number, seconds: number, startS = 0): Summary {
  const road = createRoad(seed);
  const drive = createDriveState();
  const autopilot = createAutopilot();
  placeOnRoad(drive, road, startS);

  const input: VehicleInput = { steer: 0, throttle: 0, brake: 0 };
  const steps = Math.round(seconds / DT);

  let offRoadSteps = 0;
  let peakLateralG = 0;
  let peakRollDeg = 0;
  let maxAbsLateralM = 0;
  let minSpeedMs = Infinity;
  let maxSpeedMs = 0;
  // The first second is the car settling onto the road from a standing start;
  // judging the line during it would be judging the placement, not the driving.
  const settleSteps = 120;

  for (let i = 0; i < steps; i++) {
    const auto = autopilot.update(
      road,
      drive.roadPos.s,
      drive.roadPos.t,
      drive.vehicle.heading,
      drive.vehicle.speedMs,
    );
    input.steer = auto.steer;
    input.throttle = auto.throttle;
    input.brake = auto.brake;
    stepDrive(drive, road, input, seed, DT);

    if (i < settleSteps) continue;
    if (drive.surface !== 'tarmac') offRoadSteps++;
    peakLateralG = Math.max(peakLateralG, Math.abs(drive.vehicle.lateralAccel) / GRAVITY);
    peakRollDeg = Math.max(peakRollDeg, (Math.abs(drive.attitude.roll.x) * 180) / Math.PI);
    maxAbsLateralM = Math.max(maxAbsLateralM, Math.abs(drive.roadPos.t));
    minSpeedMs = Math.min(minSpeedMs, drive.vehicle.speedMs);
    maxSpeedMs = Math.max(maxSpeedMs, drive.vehicle.speedMs);
  }

  return {
    state: drive,
    distanceM: drive.roadPos.s,
    offRoadSteps,
    steps: steps - settleSteps,
    peakLateralG,
    peakRollDeg,
    maxAbsLateralM,
    minSpeedMs,
    maxSpeedMs,
  };
}

describe('driving the generated road', () => {
  it('stays on the tarmac for 20 km', () => {
    // If a simple pursuit controller cannot keep the car on the road, the car
    // is wrong — this is a handling assertion wearing an autopilot.
    //
    // The bar is "essentially always", not "always": a pure-pursuit controller
    // with no preview of its own error inevitably clips a verge on the
    // tightest hairpins, and tuning that last tenth of a percent away would be
    // tuning the probe rather than the car.
    const run = autopilotDrive(1, 700);
    expect(run.distanceM).toBeGreaterThan(18000);
    expect(run.offRoadSteps / run.steps).toBeLessThan(0.001);
  });

  it('holds the road on several different seeds', () => {
    for (const seed of [2, 7, 13, 29]) {
      const run = autopilotDrive(seed, 180);
      expect(run.offRoadSteps / run.steps).toBeLessThan(0.01);
      expect(run.distanceM).toBeGreaterThan(4000);
    }
  });

  it('keeps a sensible line rather than sawing between the verges', () => {
    const run = autopilotDrive(1, 300);
    expect(run.maxAbsLateralM).toBeLessThan(3.0);
  });

  it('slows for corners and uses the straights', () => {
    const run = autopilotDrive(1, 400);
    expect(run.minSpeedMs * 3.6).toBeLessThan(95);
    expect(run.maxSpeedMs * 3.6).toBeGreaterThan(105);
  });

  it('never exceeds the tyres over a long drive', () => {
    const run = autopilotDrive(1, 400);
    expect(run.peakLateralG).toBeLessThanOrEqual(CAR.GRIP_TARMAC * CAR.LATERAL_GRIP_SCALE + 0.02);
  });

  it('leans in the corners', () => {
    // The point of the whole phase. If the body never moves, something
    // upstream has quietly zeroed the lateral acceleration.
    const run = autopilotDrive(1, 400);
    expect(run.peakRollDeg).toBeGreaterThan(1);
  });

  it('follows the road up and down without leaving the ground', () => {
    const run = autopilotDrive(1, 400);
    const road = createRoad(1);
    road.ensureSpan(run.distanceM);
    const expected = road.groundHeightAt(run.state.roadPos.s, run.state.roadPos.t);
    expect(run.state.vehicle.y).toBeCloseTo(expected, 3);
  });
});

describe('leaving the road', () => {
  it('slows the car down rather than stopping it dead', () => {
    const road = createRoad(1);
    const drive = createDriveState();
    placeOnRoad(drive, road, 400);

    // Full lock until the car is off the tarmac, then hold the throttle open.
    const off: VehicleInput = { steer: 1, throttle: 1, brake: 0 };
    let leftTheRoad = false;
    for (let i = 0; i < 120 * 12; i++) {
      stepDrive(drive, road, off, 1, DT);
      if (drive.surface !== 'tarmac') leftTheRoad = true;
    }

    expect(leftTheRoad).toBe(true);
    // Still moving — off-road is a penalty surface, not a wall (docs/01-design).
    expect(drive.vehicle.speedMs).toBeGreaterThan(1);
  });

  it('is always recoverable — there is no barrier and no fail state', () => {
    const road = createRoad(1);
    const drive = createDriveState();
    placeOnRoad(drive, road, 400);

    for (let i = 0; i < 120 * 4; i++) {
      stepDrive(drive, road, { steer: 1, throttle: 0.6, brake: 0 }, 1, DT);
    }
    const strayed = Math.abs(drive.roadPos.t);
    expect(strayed).toBeGreaterThan(2);

    // Steer back and the car simply comes back. Nothing resets, nothing ends.
    const back = Math.sign(drive.roadPos.t) > 0 ? -0.5 : 0.5;
    for (let i = 0; i < 120 * 8; i++) {
      stepDrive(drive, road, { steer: back, throttle: 0.5, brake: 0 }, 1, DT);
    }
    expect(Number.isFinite(drive.roadPos.t)).toBe(true);
    expect(drive.vehicle.speedMs).toBeGreaterThan(0);
  });
});

describe('determinism', () => {
  it('replays identically from the same seed and inputs', () => {
    const a = autopilotDrive(5, 120);
    const b = autopilotDrive(5, 120);
    expect(b.distanceM).toBe(a.distanceM);
    expect(b.state.vehicle.x).toBe(a.state.vehicle.x);
    expect(b.state.attitude.roll.x).toBe(a.state.attitude.roll.x);
  });

  it('resumes to the same place it would have driven to', () => {
    // A resume is a seed plus a distance (ADR-0012), so being placed at 5 km
    // must put the car exactly where the road says 5 km is.
    const road = createRoad(3);
    const drive = createDriveState();
    placeOnRoad(drive, road, 5000);
    expect(drive.roadPos.s).toBe(5000);
    expect(drive.surface).toBe('tarmac');
    expect(Math.abs(drive.roadPos.t)).toBeLessThan(0.01);
  });
});
