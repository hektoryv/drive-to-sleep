/**
 * Turns a finger offset into steering and pedals.
 *
 * Pure — no DOM, no listeners. `pointer.ts` deals with the browser; this deals
 * with the feel, which means it can be unit tested and reasoned about without
 * a device.
 *
 * The scheme is a dynamic-origin virtual joystick (ADR-0004): wherever you
 * first touch becomes neutral, and your offset from it is the input. X maps
 * **by position** to steering angle, so the wheel on the dash is always
 * exactly where your thumb is.
 */

import { approach, clamp, clamp11 } from '../core/math.js';
import type { ControlState } from '../contracts/vehicle.js';
import { CONTROL } from './tuning.js';

/** What the pointer layer reports. All in CSS pixels. */
export interface PointerSample {
  active: boolean;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
}

export function makePointerSample(): PointerSample {
  return { active: false, originX: 0, originY: 0, currentX: 0, currentY: 0 };
}

export interface ControlOptions {
  screenWidth: number;
  screenHeight: number;
  /** Player setting, 0.5–1.5. Scales how far the finger has to travel. */
  sensitivity: number;
  /** Player setting: swaps push-forward and pull-back for the pedals. */
  invertY: boolean;
}

/**
 * Removes a deadzone and rescales what's left, so the full output range is
 * still reachable. Without the rescale, a deadzone quietly costs you the top
 * of your steering lock.
 */
export function applyDeadzone(v: number, deadzone: number): number {
  const magnitude = Math.abs(v);
  if (magnitude <= deadzone) return 0;
  return Math.sign(v) * ((magnitude - deadzone) / (1 - deadzone));
}

/**
 * Steering response curve. Shallow near the centre so small corrections at
 * speed are possible, still reaching full lock at the edge.
 *
 * `x * (k + (1-k) * x²)` — odd, monotonic, and exactly ±1 at ±1.
 */
export function steerCurve(x: number): number {
  const k = CONTROL.STEER_CURVE_LINEAR;
  return x * (k + (1 - k) * x * x);
}

/**
 * Where the origin should move to: dragged along behind the finger, never
 * more than one radius away (ADR-0013).
 *
 * This is what stops you running out of travel. Push past full deflection and
 * the origin comes with you, so the far edge of the screen is never a limit —
 * and when you come back, one radius of travel returns you to neutral from
 * wherever you ended up.
 *
 * Note what it deliberately does *not* do: creep toward the finger while you
 * hold a corner. That was the first version, and it silently un-steers the
 * car — thirty seconds of held lock bled down to half lock on its own.
 * The origin only ever moves because the finger dragged it.
 */
export function driftOrigin(origin: number, current: number, radiusPx: number): number {
  if (radiusPx <= 0) return origin;
  const offset = current - origin;
  if (Math.abs(offset) <= radiusPx) return origin;
  return current - Math.sign(offset) * radiusPx;
}

export interface ControlsState {
  /** The live control output, mutated in place each step. */
  readonly out: ControlState;
  /** The working origin, which drifts. Owned here, not by the pointer layer. */
  originX: number;
  originY: number;
  /** True once an origin has been established by a touch. */
  hasOrigin: boolean;
}

export function createControlsState(): ControlsState {
  return {
    out: { steer: 0, throttle: 0, brake: 0, active: false },
    originX: 0,
    originY: 0,
    hasOrigin: false,
  };
}

/**
 * Advances the control state by one fixed step.
 *
 * Lifting off is deliberately not an emergency stop: steering eases back to
 * centre over a few tenths of a second and the throttle goes to a coast. The
 * car keeps rolling. Putting the phone down should feel like taking your hands
 * off the wheel on a straight, not like crashing.
 */
export function stepControls(
  state: ControlsState,
  pointer: Readonly<PointerSample>,
  options: ControlOptions,
  dt: number,
): ControlState {
  const { out } = state;
  const sensitivity = clamp(options.sensitivity, 0.5, 1.5);
  const steerRadius = options.screenWidth * CONTROL.STEER_RADIUS_FRAC * sensitivity;
  const throttleRadius = options.screenHeight * CONTROL.THROTTLE_RADIUS_FRAC * sensitivity;
  const brakeRadius = options.screenHeight * CONTROL.BRAKE_RADIUS_FRAC * sensitivity;

  out.active = pointer.active;

  if (!pointer.active) {
    state.hasOrigin = false;
    out.steer = approach(out.steer, 0, CONTROL.RELEASE_RECENTRE_RATE, dt);
    out.throttle = approach(out.throttle, 0, CONTROL.RELEASE_RECENTRE_RATE, dt);
    out.brake = approach(out.brake, 0, CONTROL.RELEASE_RECENTRE_RATE, dt);
    return out;
  }

  // A fresh touch adopts the pointer layer's origin; after that the origin is
  // ours, because it drifts and the pointer layer must not undo that.
  if (!state.hasOrigin) {
    state.originX = pointer.originX;
    state.originY = pointer.originY;
    state.hasOrigin = true;
  }

  state.originX = driftOrigin(state.originX, pointer.currentX, steerRadius);

  const rawSteer = steerRadius > 0 ? clamp11((pointer.currentX - state.originX) / steerRadius) : 0;
  out.steer = steerCurve(applyDeadzone(rawSteer, CONTROL.DEADZONE_FRAC));

  // Screen y grows downward, so a finger above the origin is a positive
  // "up" offset — which is throttle unless the player has inverted it.
  let up = state.originY - pointer.currentY;
  if (options.invertY) up = -up;

  const pedalRadius = up >= 0 ? throttleRadius : brakeRadius;
  state.originY = driftOrigin(state.originY, pointer.currentY, pedalRadius);
  up = options.invertY
    ? pointer.currentY - state.originY
    : state.originY - pointer.currentY;

  if (up >= 0) {
    out.throttle = throttleRadius > 0 ? clamp(up / throttleRadius, 0, 1) : 0;
    out.brake = 0;
  } else {
    out.throttle = 0;
    out.brake = brakeRadius > 0 ? clamp(-up / brakeRadius, 0, 1) : 0;
  }

  return out;
}
