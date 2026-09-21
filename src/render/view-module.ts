/**
 * Produces the `ViewState` each frame: where the driver's eye is, how the body
 * is sitting, and where the head is looking.
 *
 * The one module allowed to write `ViewState`. Everything else receives it
 * read-only through `frame()`, which is what keeps "where the camera is" a
 * single answer rather than something three domains each nudge.
 */

import type { GameModule } from '../contracts/module.js';
import type { CarView } from '../contracts/vehicle.js';
import type { RoadQuery } from '../contracts/world.js';
import type { ViewState } from '../contracts/view.js';
import { lookAheadDistance, makeLookAheadRig, updateLookAhead } from './camera.js';
import { VIEW } from './tuning.js';
import { lerp } from '../core/math.js';

export interface ViewModuleOptions {
  /** The app's ViewState. This module writes it; everyone else reads it. */
  view: ViewState;
}

export function createViewModule(options: ViewModuleOptions): GameModule {
  const rig = makeLookAheadRig();
  const { view } = options;
  let car: CarView | undefined;
  let road: RoadQuery | undefined;
  let enabled = true;
  const previous = makePose();
  const current = makePose();

  function copyCar(out: Pose, source: CarView): void {
    out.x = source.x;
    out.y = source.y;
    out.z = source.z;
    out.heading = source.heading;
    out.roll = source.roll;
    out.pitch = source.pitch;
    out.heaveY = source.heaveY;
  }

  const module: GameModule & { setLookAheadEnabled(v: boolean): void } = {
    name: 'view',

    start(ctx) {
      car = ctx.services.require('car');
      road = ctx.services.require('road');
      copyCar(previous, car);
      copyCar(current, car);
    },

    step(dt) {
      if (car === undefined || road === undefined) return;
      copyPose(previous, current);
      copyCar(current, car);
      // Stepped in the simulation rather than the frame, so the smoothing is
      // frame-rate independent like everything else (ADR-0002).
      const here = road.headingAt(car.distanceM);
      const ahead = enabled
        ? road.headingAt(car.distanceM + lookAheadDistance(car.speedMs))
        : here;
      updateLookAhead(rig, here, ahead, dt);
    },

    frame(alpha) {
      if (car === undefined) return;
      // Interpolate the presented position between simulation steps so motion
      // stays smooth when the display rate and the 120 Hz sim disagree.
      view.x = lerp(previous.x, current.x, alpha);
      view.y = lerp(previous.y, current.y, alpha);
      view.z = lerp(previous.z, current.z, alpha);
      view.heading = lerpAngle(previous.heading, current.heading, alpha);
      view.lookYaw = rig.yaw;
      view.roll = lerp(previous.roll, current.roll, alpha);
      view.pitch = lerp(previous.pitch, current.pitch, alpha);
      view.heaveY = lerp(previous.heaveY, current.heaveY, alpha);

      // The eye. Offset along the car's own right axis, not the world's, so a
      // left-hand-drive seat stays on the left whichever way the car points.
      // Computed here rather than in the renderer so that the cabin and the
      // camera cannot disagree about where the driver's head is.
      const sin = Math.sin(view.heading);
      const cos = Math.cos(view.heading);
      view.eyeX = view.x + VIEW.EYE_LATERAL * cos;
      view.eyeY = view.y + VIEW.EYE_HEIGHT + view.heaveY;
      view.eyeZ = view.z - VIEW.EYE_LATERAL * sin;
    },

    setLookAheadEnabled(v: boolean) {
      enabled = v;
    },
  };

  return module;
}

interface Pose {
  x: number;
  y: number;
  z: number;
  heading: number;
  roll: number;
  pitch: number;
  heaveY: number;
}

function makePose(): Pose {
  return { x: 0, y: 0, z: 0, heading: 0, roll: 0, pitch: 0, heaveY: 0 };
}

function copyPose(out: Pose, source: Pose): void {
  out.x = source.x;
  out.y = source.y;
  out.z = source.z;
  out.heading = source.heading;
  out.roll = source.roll;
  out.pitch = source.pitch;
  out.heaveY = source.heaveY;
}

/** Interpolates across the -PI/PI seam along the short arc. */
function lerpAngle(a: number, b: number, t: number): number {
  let delta = (b - a + Math.PI) % (Math.PI * 2);
  if (delta < 0) delta += Math.PI * 2;
  return a + (delta - Math.PI) * t;
}
