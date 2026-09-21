/**
 * Body attitude — the lean.
 *
 * Pillar #1, and the cheapest big win in the whole project: three damped
 * springs, and the car acquires mass.
 *
 * The damping ratios sit below 1 on purpose. A critically damped spring
 * arrives at its target and stops, which reads as a rigid object being posed.
 * The single soft overshoot at ζ ≈ 0.7 is what reads as a body on springs
 * settling. Do not "fix" it.
 *
 * Pure. No three.js, no DOM.
 */

import { clamp, impulseSpring, makeSpring, stepSpring, type Spring } from '../core/math.js';
import { ATTITUDE } from './tuning.js';

export interface AttitudeState {
  roll: Spring;
  pitch: Spring;
  heave: Spring;
  /** Distance carried since the last rumble kick, metres. */
  rumbleCarryM: number;
}

export function createAttitudeState(): AttitudeState {
  return {
    roll: makeSpring(ATTITUDE.ROLL_FREQ_HZ, ATTITUDE.ROLL_ZETA),
    pitch: makeSpring(ATTITUDE.PITCH_FREQ_HZ, ATTITUDE.PITCH_ZETA),
    heave: makeSpring(ATTITUDE.HEAVE_FREQ_HZ, ATTITUDE.HEAVE_ZETA),
    rumbleCarryM: 0,
  };
}

export interface AttitudeInput {
  /** Lateral acceleration, m/s². Positive is to the car's right. */
  lateralAccel: number;
  /** Longitudinal acceleration, m/s². Positive is speeding up. */
  longAccel: number;
  speedMs: number;
  /** 0 on tarmac, 1 on the roughest surface. Drives the rumble. */
  roughness: number;
  /** Deterministic 0–1 noise for the rumble, so a replay rumbles identically. */
  roughnessNoise: number;
}

/**
 * Advances the three springs. Mutates in place; allocates nothing.
 *
 * Note the sign on roll: the body leans **outward**, away from the turn, as a
 * real car does. Getting this backwards is a classic, and it looks instantly
 * and unmistakably wrong even to someone who could not say why.
 */
export function stepAttitude(
  state: AttitudeState,
  input: Readonly<AttitudeInput>,
  dt: number,
): void {
  // Negated: the body leans *away* from the acceleration. Cornering right
  // pushes the car right, so the body goes left — outward, as a real one does.
  const lateral = clamp(input.lateralAccel / ATTITUDE.REF_LATERAL_ACCEL, -1, 1);
  stepSpring(state.roll, -lateral * ATTITUDE.ROLL_MAX, dt);

  const longitudinal = clamp(input.longAccel / ATTITUDE.REF_LONG_ACCEL, -1, 1);
  stepSpring(state.pitch, longitudinal * ATTITUDE.PITCH_MAX, dt);

  // The heave spring rests at zero and is kicked, rather than being driven to
  // a target: a bump is an impulse, not a position.
  stepSpring(state.heave, 0, dt);

  if (input.roughness > 0 && input.speedMs > 0.5) {
    // Kicks are spaced by *distance*, not by time, so a surface has a texture
    // you drive across rather than a vibration frequency that rises with
    // speed and turns into a buzz.
    state.rumbleCarryM += input.speedMs * dt;
    if (state.rumbleCarryM >= ATTITUDE.RUMBLE_SPACING_M) {
      state.rumbleCarryM -= ATTITUDE.RUMBLE_SPACING_M;
      const strength =
        input.roughness *
        ATTITUDE.RUMBLE_IMPULSE *
        clamp(input.speedMs / 20, 0.2, 1.4) *
        (input.roughnessNoise * 2 - 1);
      impulseSpring(state.heave, strength);
    }
  } else {
    state.rumbleCarryM = 0;
  }

  state.heave.x = clamp(state.heave.x, -ATTITUDE.HEAVE_MAX_M, ATTITUDE.HEAVE_MAX_M);
}

/** Adds a jolt to every axis at once — a collision, a kerb, a landing. */
export function jolt(state: AttitudeState, severity: number, lateralBias: number): void {
  impulseSpring(state.heave, -severity * ATTITUDE.JOLT_HEAVE);
  impulseSpring(state.pitch, -severity * ATTITUDE.JOLT_PITCH);
  impulseSpring(state.roll, lateralBias * severity * ATTITUDE.JOLT_ROLL);
}
