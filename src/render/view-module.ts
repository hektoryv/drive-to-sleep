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

  const module: GameModule & { setLookAheadEnabled(v: boolean): void } = {
    name: 'view',

    start(ctx) {
      car = ctx.services.require('car');
      road = ctx.services.require('road');
    },

    step(dt) {
      if (car === undefined || road === undefined) return;
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
      void alpha;
      view.x = car.x;
      view.y = car.y;
      view.z = car.z;
      view.heading = car.heading;
      view.lookYaw = rig.yaw;
      view.roll = car.roll;
      view.pitch = car.pitch;
      view.heaveY = car.heaveY;

      // The eye. Offset along the car's own right axis, not the world's, so a
      // left-hand-drive seat stays on the left whichever way the car points.
      // Computed here rather than in the renderer so that the cabin and the
      // camera cannot disagree about where the driver's head is.
      const sin = Math.sin(car.heading);
      const cos = Math.cos(car.heading);
      view.eyeX = car.x + VIEW.EYE_LATERAL * cos;
      view.eyeY = car.y + VIEW.EYE_HEIGHT + car.heaveY;
      view.eyeZ = car.z - VIEW.EYE_LATERAL * sin;
    },

    setLookAheadEnabled(v: boolean) {
      enabled = v;
    },
  };

  return module;
}
