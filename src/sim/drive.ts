/**
 * The car on the road: one step of vehicle, surface and body attitude together.
 *
 * Extracted from the module so that tests drive *this* rather than a
 * reimplementation of it. A handling regression test that exercises a copy of
 * the glue is a test of the copy.
 *
 * Pure. No three.js, no DOM.
 */

import { hash01 } from '../core/rng.js';
import type { RoadQuery, RoadSample, Surface } from '../contracts/world.js';
import { makeRoadSample } from '../contracts/world.js';
import { createAttitudeState, stepAttitude, type AttitudeState } from './attitude.js';
import {
  createVehicleState,
  stepVehicle,
  type SurfaceConditions,
  type VehicleInput,
  type VehicleState,
} from './vehicle.js';
import { ROAD_BOUNDARY, START } from './tuning.js';

/** How rough each surface is, for the rumble. */
export function roughnessFor(surface: Surface): number {
  switch (surface) {
    case 'tarmac':
      return 0.06;
    case 'gravel':
      return 0.75;
    case 'grass':
      return 1;
  }
}

export interface DriveState {
  vehicle: VehicleState;
  attitude: AttitudeState;
  /** Where the car is in road coordinates. Updated every step. */
  roadPos: { s: number; t: number };
  surface: Surface;
  /** The road under the car, this step. */
  sample: RoadSample;
}

export function createDriveState(): DriveState {
  return {
    vehicle: createVehicleState(),
    attitude: createAttitudeState(),
    roadPos: { s: 0, t: 0 },
    surface: 'tarmac',
    sample: makeRoadSample(),
  };
}

/**
 * Puts the car on the road at a distance, pointing the way the road goes and
 * already rolling.
 *
 * Starting stationary and pointing at nothing would be a worse first second
 * than the game deserves — and the generator forces a straight at the start so
 * that this is a drive rather than a correction.
 */
export function placeOnRoad(state: DriveState, road: RoadQuery, s: number): void {
  road.ensureSpan(s);
  road.sampleAt(s, state.sample);
  state.vehicle.x = state.sample.x;
  state.vehicle.z = state.sample.z;
  state.vehicle.y = state.sample.y;
  state.vehicle.heading = state.sample.heading;
  state.vehicle.speedMs = START.SPEED_MS;
  state.vehicle.lateralMs = 0;
  state.vehicle.yawRate = 0;
  state.roadPos.s = s;
  state.roadPos.t = 0;
}

const conditions: SurfaceConditions = { surface: 'tarmac', grade: 0 };

/**
 * Keeps the car inside the temporary roadside safety walls.
 *
 * The wall follows the road and sits outside the varying tarmac edge. On a
 * hit, position is projected back to the wall and only velocity into the wall
 * is removed; velocity along it survives, so a shallow scrape does not stop
 * the car dead. Returns whether a collision was resolved.
 */
export function resolveRoadBoundary(state: DriveState): boolean {
  const { vehicle, roadPos, sample } = state;
  const limit = sample.halfWidth + ROAD_BOUNDARY.OUTSIDE_EDGE_M;
  if (Math.abs(roadPos.t) <= limit) return false;

  const side = roadPos.t < 0 ? -1 : 1;
  roadPos.t = side * limit;

  const roadRightX = Math.cos(sample.heading);
  const roadRightZ = -Math.sin(sample.heading);
  vehicle.x = sample.x + roadRightX * roadPos.t;
  vehicle.z = sample.z + roadRightZ * roadPos.t;

  const forwardX = -Math.sin(vehicle.heading);
  const forwardZ = -Math.cos(vehicle.heading);
  const carRightX = Math.cos(vehicle.heading);
  const carRightZ = -Math.sin(vehicle.heading);
  let vx = forwardX * vehicle.speedMs + carRightX * vehicle.lateralMs;
  let vz = forwardZ * vehicle.speedMs + carRightZ * vehicle.lateralMs;
  const outwardMs = (vx * roadRightX + vz * roadRightZ) * side;

  if (outwardMs > 0) {
    vx -= roadRightX * side * outwardMs;
    vz -= roadRightZ * side * outwardMs;
    vehicle.speedMs = Math.max(0, vx * forwardX + vz * forwardZ);
    vehicle.lateralMs = vx * carRightX + vz * carRightZ;
  }

  return true;
}

/** Advances the car by one fixed step. Mutates in place; allocates nothing. */
export function stepDrive(
  state: DriveState,
  road: RoadQuery,
  input: Readonly<VehicleInput>,
  seed: number,
  dt: number,
): void {
  const { vehicle, attitude, roadPos } = state;

  road.toRoadSpace(vehicle.x, vehicle.z, roadPos.s, roadPos);
  road.ensureSpan(roadPos.s);
  road.sampleAt(roadPos.s, state.sample);

  state.surface = road.surfaceAt(roadPos.s, roadPos.t);
  conditions.surface = state.surface;
  conditions.grade = state.sample.grade;

  stepVehicle(vehicle, input, conditions, dt);

  // Re-resolve after moving, so the height matches where the car ended up
  // rather than where it started the step.
  road.toRoadSpace(vehicle.x, vehicle.z, roadPos.s, roadPos);
  road.sampleAt(roadPos.s, state.sample);
  resolveRoadBoundary(state);
  state.surface = road.surfaceAt(roadPos.s, roadPos.t);
  vehicle.y = road.groundHeightAt(roadPos.s, roadPos.t);

  stepAttitude(
    attitude,
    {
      lateralAccel: vehicle.lateralAccel,
      longAccel: vehicle.longAccel,
      speedMs: vehicle.speedMs,
      roughness: roughnessFor(state.surface),
      // Positional noise, so the same stretch of gravel rumbles the same way
      // every time — a replay has to be a replay (ADR-0002).
      roughnessNoise: hash01(Math.floor(vehicle.odometerM * 3), seed),
    },
    dt,
  );
}
