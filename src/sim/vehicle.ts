/**
 * The car.
 *
 * Arcade handling with a physical skeleton: not a simulation, but real enough
 * that the resulting motion is something you can predict and lean on, which is
 * the whole of pillar #1.
 *
 * Pure. No three.js, no DOM. Every constant lives in `tuning.ts`.
 *
 * ## The shape of the model
 *
 * Longitudinal and lateral are handled separately, which is what keeps it
 * simple enough to tune:
 *
 * - **Speed** is a scalar along the car's heading, driven by throttle, brakes,
 *   drag, rolling resistance and gravity on a slope.
 * - **Yaw rate** is a bicycle-model target, *clamped by available grip*, then
 *   eased toward rather than snapped to. The clamp is where understeer comes
 *   from: past the limit the car simply cannot rotate as fast as the wheel is
 *   asking, which is exactly what a real car does.
 * - **Lateral velocity** collects whatever rotation the grip clamp refused,
 *   and bleeds away again. That is the slide.
 *
 * Nothing here knows about the road's shape; it is handed a surface and a
 * grade each step and gets on with it.
 */

import { approach, clamp, clamp11, wrapAngle } from '../core/math.js';
import type { Surface } from '../contracts/world.js';
import { CAR, GRAVITY } from './tuning.js';

export interface VehicleState {
  /** World position, metres. */
  x: number;
  z: number;
  /** Ground height under the car, metres. Written by the caller each step. */
  y: number;
  /** Radians, 0 looking down -Z. Unwrapped is fine; consumers wrap. */
  heading: number;
  /** Forward speed along the heading, m/s. Never negative — no reverse gear. */
  speedMs: number;
  /** Signed sideways velocity in the car's own frame, m/s. Positive is right. */
  lateralMs: number;
  /** Rotation rate about the vertical, rad/s. Negative turns right. */
  yawRate: number;
  /** Steering angle at the wheels, radians. What the on-screen wheel mirrors. */
  steerAngle: number;
  /** Lateral acceleration, m/s², positive toward the car's right. Drives roll. */
  lateralAccel: number;
  /** Longitudinal acceleration, m/s². Drives the body pitch. */
  longAccel: number;
  /** Distance travelled along the ground, metres. */
  odometerM: number;
  /** Engine speed for the tachometer. */
  rpm: number;
}

export function createVehicleState(): VehicleState {
  return {
    x: 0,
    z: 0,
    y: 0,
    heading: 0,
    speedMs: 0,
    lateralMs: 0,
    yawRate: 0,
    steerAngle: 0,
    lateralAccel: 0,
    longAccel: 0,
    odometerM: 0,
    rpm: CAR.IDLE_RPM,
  };
}

/** What the world tells the car about where it currently is. */
export interface SurfaceConditions {
  surface: Surface;
  /** Rise over run under the car. Positive climbs. */
  grade: number;
}

export interface VehicleInput {
  steer: number;
  throttle: number;
  brake: number;
}

export function gripFor(surface: Surface): number {
  switch (surface) {
    case 'tarmac':
      return CAR.GRIP_TARMAC;
    case 'gravel':
      return CAR.GRIP_GRAVEL;
    case 'grass':
      return CAR.GRIP_GRASS;
  }
}

function dragFor(surface: Surface): number {
  return surface === 'tarmac' ? 1 : CAR.OFF_ROAD_DRAG;
}

/**
 * How much of the steering lock is actually available at this speed.
 *
 * The single most important constant in the handling model. Without it the car
 * is unusable above about 60 km/h — a thumb's width of travel becomes a
 * spin — and with too much of it the car goes numb.
 *
 * Full lock below the falloff speed, easing to `STEER_FALLOFF_MIN` at the top.
 */
export function steerAuthority(speedMs: number): number {
  if (speedMs <= CAR.STEER_FALLOFF_START_MS) return 1;
  const t = clamp(
    (speedMs - CAR.STEER_FALLOFF_START_MS) / (CAR.TOP_SPEED_MS - CAR.STEER_FALLOFF_START_MS),
    0,
    1,
  );
  // Square it so authority falls away quickly just above town speed and then
  // levels off, rather than draining linearly all the way to the top end.
  return 1 - (1 - CAR.STEER_FALLOFF_MIN) * t * t;
}

/**
 * Engine thrust at a given speed, m/s².
 *
 * Front-loaded: it is a naturally aspirated flat six from 1972, so there is
 * shove low down and it tails off toward the top end rather than pulling like
 * a turbo. Shaped as a curve rather than modelled with a gearbox, because the
 * game has no gears (ADR-0004: one finger, no thought).
 */
export function thrustAt(speedMs: number): number {
  const t = clamp(speedMs / CAR.TOP_SPEED_MS, 0, 1);
  return CAR.PEAK_ACCEL * (1 - t * t * CAR.THRUST_FALLOFF);
}

/** Tachometer needle. No gearbox, so it is a function of road speed. */
function rpmAt(speedMs: number, throttle: number): number {
  const t = clamp(speedMs / CAR.TOP_SPEED_MS, 0, 1);
  // A shallow curve so the needle is doing something interesting at every
  // speed rather than sitting near the redline from 80 km/h upward.
  const base = CAR.IDLE_RPM + (CAR.MAX_RPM - CAR.IDLE_RPM) * Math.pow(t, 0.75);
  return base + throttle * CAR.THROTTLE_RPM_LIFT * (1 - t);
}

/**
 * Advances the car by one fixed step. Mutates `state` in place; allocates
 * nothing.
 */
export function stepVehicle(
  state: VehicleState,
  input: Readonly<VehicleInput>,
  conditions: Readonly<SurfaceConditions>,
  dt: number,
): void {
  const grip = gripFor(conditions.surface);
  const previousSpeed = state.speedMs;

  // ---- Longitudinal ------------------------------------------------------

  const thrust = thrustAt(state.speedMs) * clamp(input.throttle, 0, 1);
  const braking = CAR.BRAKE_G * GRAVITY * clamp(input.brake, 0, 1) * grip;
  const drag = CAR.DRAG * state.speedMs * state.speedMs;
  // Rolling resistance is very nearly constant with speed — it is the tyres
  // deforming, not the air. Making it proportional instead turns it into a
  // second drag term, and the first version of this model was capped at
  // 107 km/h because of exactly that. Tapered below 2 m/s so a constant
  // deceleration cannot oscillate around a standstill.
  const rolling =
    CAR.ROLLING_RESISTANCE *
    dragFor(conditions.surface) *
    Math.min(1, state.speedMs * 0.5);
  // Gravity along the slope. A 7% climb costs about 0.7 m/s², which is enough
  // to notice on a long drag and not enough to be a nuisance.
  const slope = GRAVITY * conditions.grade;

  let accel = thrust - drag - rolling - slope;
  // Braking only ever opposes motion; it must not reverse the car.
  if (state.speedMs > 0) accel -= braking;

  state.speedMs = Math.max(0, state.speedMs + accel * dt);
  if (state.speedMs > CAR.TOP_SPEED_MS) state.speedMs = CAR.TOP_SPEED_MS;

  // ---- Steering ----------------------------------------------------------

  // Position-mapped, so the wheel on the dash is a function of the thumb and
  // the two can never disagree (ADR-0004). The speed falloff is applied to the
  // *effect*, not to the displayed angle — the wheel still turns fully.
  const requested = clamp11(input.steer) * CAR.MAX_STEER_RAD;
  state.steerAngle = approach(state.steerAngle, requested, CAR.STEER_RATE, dt);

  const effective = state.steerAngle * steerAuthority(state.speedMs);

  // Bicycle model: the yaw rate a car of this wheelbase would want.
  const wanted =
    state.speedMs > 0.05 ? -(state.speedMs / CAR.WHEELBASE_M) * Math.tan(effective) : 0;

  // Grip clamp. Lateral acceleration is speed × yaw rate, so the fastest the
  // car can rotate without exceeding its tyres is (grip · g) / speed. This one
  // line is where understeer comes from.
  const maxLateral = grip * GRAVITY * CAR.LATERAL_GRIP_SCALE;
  const maxYaw = state.speedMs > 1 ? maxLateral / state.speedMs : Math.abs(wanted) + 1;
  const target = clamp(wanted, -maxYaw, maxYaw);

  // Eased rather than snapped: a car takes a moment to take a set on turn-in,
  // and instant yaw is the single most video-game-feeling thing a car can do.
  state.yawRate = approach(state.yawRate, target, CAR.YAW_RESPONSE, dt);
  state.heading += state.yawRate * dt;

  // ---- Slide -------------------------------------------------------------

  // Whatever rotation the grip clamp refused becomes sideways motion.
  const refused = wanted - target;
  state.lateralMs += refused * state.speedMs * CAR.SLIDE_GAIN * dt;
  // Tyres scrub it off again, faster on tarmac than on grass.
  state.lateralMs = approach(state.lateralMs, 0, CAR.SLIDE_RECOVERY * grip, dt);
  state.lateralMs = clamp(state.lateralMs, -CAR.MAX_SLIDE_MS, CAR.MAX_SLIDE_MS);

  // ---- Integrate ---------------------------------------------------------

  const forwardX = -Math.sin(state.heading);
  const forwardZ = -Math.cos(state.heading);
  const rightX = Math.cos(state.heading);
  const rightZ = -Math.sin(state.heading);

  const vx = forwardX * state.speedMs + rightX * state.lateralMs;
  const vz = forwardZ * state.speedMs + rightZ * state.lateralMs;

  state.x += vx * dt;
  state.z += vz * dt;
  state.odometerM += Math.hypot(vx, vz) * dt;

  // ---- Telemetry ---------------------------------------------------------

  // True centripetal acceleration, positive toward the car's right. A right
  // turn has a negative yaw rate (heading decreases to the right), so the sign
  // has to be flipped for this to mean what its name says.
  state.lateralAccel = -state.speedMs * state.yawRate;
  state.longAccel = (state.speedMs - previousSpeed) / dt;
  state.rpm = rpmAt(state.speedMs, input.throttle);
}

/** Angle between where the car points and where it is actually going. */
export function slipAngle(state: Readonly<VehicleState>): number {
  if (state.speedMs < 0.5) return 0;
  return wrapAngle(Math.atan2(state.lateralMs, state.speedMs));
}
