/**
 * What the rest of the game may read about the car.
 *
 * Read-only by construction: the renderer, the cockpit and the HUD all consume
 * this, and none of them may write to the simulation. Pure — no three.js.
 */

import type { Surface } from './world.js';

/**
 * Intended physical bumper-to-bumper length of the player car, metres.
 *
 * The current procedural cockpit is camera-relative rather than a full body,
 * but future body, traffic and collision representations still need one shared
 * real-world size without importing another domain's tuning.
 */
export const PLAYER_CAR_LENGTH_M = 4.291;

/** Normalised control input, -1..1 for steer and 0..1 for the pedals. */
export interface ControlState {
  /** Negative left, positive right. */
  steer: number;
  throttle: number;
  brake: number;
  /** True while a finger is down. */
  active: boolean;
}

export function makeControlState(): ControlState {
  return { steer: 0, throttle: 0, brake: 0, active: false };
}

export interface CarView {
  /** Distance travelled this drive, metres. */
  readonly distanceM: number;
  /** Lateral offset from the centreline, metres. Positive right. */
  readonly lateralM: number;
  readonly speedMs: number;
  /** Engine speed, rev/min — the tachometer needle reads this. */
  readonly rpm: number;
  /**
   * Where the needle runs out, rev/min. Exposed because `rpm` means nothing
   * without it: the dial needs it to know its own sweep, and the engine note
   * needs it to know what "working hard" is.
   */
  readonly maxRpm: number;
  /** World position and heading. `y` is the road surface under the car. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly heading: number;
  /** Body attitude, radians. */
  readonly roll: number;
  readonly pitch: number;
  readonly heaveY: number;
  /** Where the wheel is, radians — the on-screen wheel mirrors this exactly. */
  readonly steerAngle: number;
  readonly onRoad: boolean;
  /** What the wheels are on right now. */
  readonly surface: Surface;

  // Telemetry. Cheap to expose, and handling cannot be tuned without it.

  /** Lateral acceleration in g. The number that decides how far the body leans. */
  readonly lateralG: number;
  /** Angle between where the car points and where it is going, radians. */
  readonly slipAngle: number;
  /** Rotation rate about the vertical axis, rad/s. Negative turns right. */
  readonly yawRate: number;
  /** Signed lateral velocity, m/s. Non-zero means the car is sliding. */
  readonly lateralMs: number;
}
