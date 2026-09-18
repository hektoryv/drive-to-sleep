/**
 * A driver, for when there isn't one.
 *
 * Steers toward a point down the road and picks a speed from the curvature
 * ahead. Built for three jobs, in order of how much they matter:
 *
 * 1. **The screenshot harness can drive.** Warping to a distance now means
 *    actually driving there through the real vehicle model, so a still can be
 *    taken mid-corner with the body leaning — which is the only way anything
 *    about Phase 2 is visible in a photograph at all (ADR-0008).
 * 2. **It is a handling assertion.** If a simple pursuit controller cannot
 *    keep the car on the road, the car is wrong. A test drives 20 km and
 *    checks it never leaves the tarmac.
 * 3. An attract-mode driver, if the start screen ever wants one.
 *
 * It is not meant to be a good driver, and it is definitely not meant to be
 * the player. It is a probe.
 *
 * Pure. No three.js, no DOM.
 */

import { clamp, clamp11, wrapAngle } from '../core/math.js';
import type { RoadQuery, RoadSample } from '../contracts/world.js';
import { makeRoadSample } from '../contracts/world.js';
import { AUTOPILOT, CAR, GRAVITY } from './tuning.js';

export interface AutopilotOutput {
  steer: number;
  throttle: number;
  brake: number;
}

export interface Autopilot {
  readonly out: AutopilotOutput;
  /** Recomputes the controls. Allocation-free. */
  update(road: RoadQuery, s: number, t: number, heading: number, speedMs: number): AutopilotOutput;
}

export function createAutopilot(): Autopilot {
  const out: AutopilotOutput = { steer: 0, throttle: 0, brake: 0 };
  const aim: RoadSample = makeRoadSample();
  const ahead: RoadSample = makeRoadSample();

  return {
    out,
    update(road, s, t, heading, speedMs) {
      // Look further ahead the faster you go, exactly as the camera does.
      const lookahead = AUTOPILOT.LOOKAHEAD_BASE_M + speedMs * AUTOPILOT.LOOKAHEAD_TIME_S;
      road.sampleAt(s + lookahead, aim);

      // Two terms: point the car where the road is going, and correct for
      // being off the centreline. The cross-track term is what stops it
      // drifting wide on a long corner and sitting there.
      //
      // Both are negated, because the two conventions run opposite ways:
      // steering is positive to the right, while heading *decreases* to the
      // right (forward is -Z, so its right-hand normal turns the yaw angle
      // down). A road bending right therefore produces a negative heading
      // error, and needs a positive steer.
      const headingError = wrapAngle(aim.heading - heading);
      const crossTrack = clamp(t / AUTOPILOT.CROSS_TRACK_REF_M, -1, 1);

      // The cross-track gain is scaled down with speed. A fixed gain that
      // holds the line at 50 km/h oscillates and then diverges at 110 — the
      // same correction is a much larger course change when it is applied for
      // the same number of metres at twice the speed. Cranking the gain to fix
      // running wide made the car leave the road 95% of the time.
      const crossTrackGain =
        AUTOPILOT.CROSS_TRACK_GAIN *
        Math.min(1, AUTOPILOT.CROSS_TRACK_REF_SPEED_MS / Math.max(speedMs, 1));

      out.steer = clamp11(-headingError * AUTOPILOT.HEADING_GAIN - crossTrack * crossTrackGain);

      // Speed from the sharpest curvature in the braking zone, so it slows
      // *before* the corner rather than discovering it on the way in.
      let sharpest = 0;
      const scanTo = AUTOPILOT.SPEED_SCAN_BASE_M + speedMs * AUTOPILOT.SPEED_SCAN_TIME_S;
      for (let d = 0; d <= scanTo; d += AUTOPILOT.SPEED_SCAN_STEP_M) {
        road.sampleAt(s + d, ahead);
        sharpest = Math.max(sharpest, Math.abs(ahead.curvature));
      }

      // The speed at which that corner would use up the available grip.
      const cornerSpeed =
        sharpest > 1e-6
          ? Math.sqrt((CAR.GRIP_TARMAC * CAR.LATERAL_GRIP_SCALE * GRAVITY) / sharpest)
          : CAR.TOP_SPEED_MS;
      const targetSpeed = clamp(
        Math.min(cornerSpeed * AUTOPILOT.CORNER_SPEED_MARGIN, AUTOPILOT.CRUISE_MS),
        AUTOPILOT.MIN_SPEED_MS,
        CAR.TOP_SPEED_MS,
      );

      const error = targetSpeed - speedMs;
      if (error > 0) {
        out.throttle = clamp(error * AUTOPILOT.THROTTLE_GAIN, 0, 1);
        out.brake = 0;
      } else {
        out.throttle = 0;
        // Deadband, so it coasts rather than riding the brakes on a straight.
        out.brake = clamp((-error - AUTOPILOT.BRAKE_DEADBAND_MS) * AUTOPILOT.BRAKE_GAIN, 0, 1);
      }

      return out;
    },
  };
}
