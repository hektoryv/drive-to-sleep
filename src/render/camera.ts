/**
 * The driver-eye camera rig.
 *
 * Its one job beyond sitting where the driver's head sits is **look-ahead**:
 * the view turns toward where the road goes, rather than staring rigidly down
 * the car's nose (ADR-0010).
 *
 * Kept free of three.js so it can be unit-tested and reasoned about as pure
 * maths; the renderer applies the result.
 *
 * Note for Phase 4: this yaw belongs to the *head*, not the car. Cockpit
 * geometry must stay parented to the car's heading, so that turning into a
 * corner swings the A-pillars and the dash across the view — which is the
 * effect that sells it. Adding this offset to the car's heading instead would
 * make the whole cabin rotate and look like nothing at all.
 */

import { CAMERA } from './tuning.js';
import { approach, clamp, wrapAngle } from '../core/math.js';

export interface LookAheadRig {
  /** Current smoothed yaw offset, radians. Positive turns the view right. */
  yaw: number;
}

export function makeLookAheadRig(): LookAheadRig {
  return { yaw: 0 };
}

export function resetLookAhead(rig: LookAheadRig): void {
  rig.yaw = 0;
}

/**
 * How far ahead to sample the road, in metres. A fixed part so the view still
 * anticipates at walking pace, plus a time-proportional part so the behaviour
 * feels the same at every speed.
 */
export function lookAheadDistance(speedMs: number): number {
  return CAMERA.LOOKAHEAD_BASE_M + Math.max(0, speedMs) * CAMERA.LOOKAHEAD_TIME_S;
}

/**
 * Advances the rig toward the road ahead.
 *
 * `carHeading` is where the car points; `aheadHeading` is the road's direction
 * at the look-ahead point. Both in radians, same convention. Returns the yaw
 * offset to add to the camera — and only to the camera.
 */
export function updateLookAhead(
  rig: LookAheadRig,
  carHeading: number,
  aheadHeading: number,
  dt: number,
): number {
  // Shortest way round, so a heading that wraps past ±PI doesn't send the
  // view spinning the long way.
  const delta = wrapAngle(aheadHeading - carHeading);
  const target = clamp(delta * CAMERA.FOLLOW_STRENGTH, -CAMERA.MAX_YAW, CAMERA.MAX_YAW);
  rig.yaw = approach(rig.yaw, target, CAMERA.RESPONSE_RATE, dt);
  return rig.yaw;
}
