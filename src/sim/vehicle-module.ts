/**
 * The car domain, as a module. Provides the `car` service.
 *
 * Thin by design: the driving itself lives in `drive.ts` so that the handling
 * regression tests exercise the same code the game runs, rather than a
 * reimplementation of it. What is left here is the wiring — controls in,
 * events out, and the autopilot switch the screenshot harness drives with.
 *
 * Replaced the Phase 1 placeholder cruise, and nothing outside `sim/` changed
 * when it did, which is the module architecture doing its job.
 */

import type { GameModule } from '../contracts/module.js';
import type { CarView, ControlState } from '../contracts/vehicle.js';
import type { RoadQuery, Surface } from '../contracts/world.js';
import type { EventBus } from '../core/events.js';
import type { GameEventMap } from '../contracts/events.js';
import { createAutopilot, type Autopilot } from './autopilot.js';
import { createDriveState, placeOnRoad, stepDrive, type DriveState } from './drive.js';
import { slipAngle, type VehicleInput } from './vehicle.js';
import { CAR } from './tuning.js';
import { GRAVITY } from './tuning.js';

export interface VehicleModule extends GameModule {
  /**
   * Hands the car to the autopilot. The screenshot harness uses this so that
   * warping to a distance drives there through the real model rather than
   * teleporting — otherwise no still could ever show the body leaning.
   */
  setAutopilot(enabled: boolean): void;
  readonly autopilotEnabled: boolean;
}

export function createVehicleModule(): VehicleModule {
  const drive: DriveState = createDriveState();
  const autopilot: Autopilot = createAutopilot();
  const input: VehicleInput = { steer: 0, throttle: 0, brake: 0 };

  let road: RoadQuery | undefined;
  let controls: ControlState | undefined;
  let events: EventBus<GameEventMap> | undefined;
  let seed = 1;

  let autopilotEnabled = false;
  let wasOnRoad = true;
  let lastKm = 0;

  const { vehicle, attitude, roadPos } = drive;

  const view: CarView = {
    get distanceM() {
      return roadPos.s;
    },
    get lateralM() {
      return roadPos.t;
    },
    get speedMs() {
      return vehicle.speedMs;
    },
    get rpm() {
      return vehicle.rpm;
    },
    get maxRpm() {
      return CAR.MAX_RPM;
    },
    get x() {
      return vehicle.x;
    },
    get y() {
      return vehicle.y;
    },
    get z() {
      return vehicle.z;
    },
    get heading() {
      return vehicle.heading;
    },
    get roll() {
      return attitude.roll.x;
    },
    get pitch() {
      return attitude.pitch.x;
    },
    get heaveY() {
      return attitude.heave.x;
    },
    get steerAngle() {
      return vehicle.steerAngle;
    },
    get onRoad() {
      return drive.surface === 'tarmac';
    },
    get surface(): Surface {
      return drive.surface;
    },
    get lateralG() {
      return vehicle.lateralAccel / GRAVITY;
    },
    get slipAngle() {
      return slipAngle(vehicle);
    },
    get yawRate() {
      return vehicle.yawRate;
    },
    get lateralMs() {
      return vehicle.lateralMs;
    },
  };

  return {
    name: 'sim',

    get autopilotEnabled() {
      return autopilotEnabled;
    },

    init(ctx) {
      seed = ctx.seed;
      events = ctx.events;
      ctx.services.provide('car', view);
    },

    start(ctx) {
      road = ctx.services.require('road');
      controls = ctx.services.require('controls');
      placeOnRoad(drive, road, 0);
    },

    step(dt) {
      if (road === undefined) return;

      if (autopilotEnabled) {
        const auto = autopilot.update(
          road,
          roadPos.s,
          roadPos.t,
          vehicle.heading,
          vehicle.speedMs,
        );
        input.steer = auto.steer;
        input.throttle = auto.throttle;
        input.brake = auto.brake;
      } else {
        input.steer = controls?.steer ?? 0;
        input.throttle = controls?.throttle ?? 0;
        input.brake = controls?.brake ?? 0;
      }

      stepDrive(drive, road, input, seed, dt);

      const onRoad = drive.surface === 'tarmac';
      if (onRoad !== wasOnRoad) {
        wasOnRoad = onRoad;
        events?.emit('surfaceChange', { onRoad });
      }

      const km = Math.floor(roadPos.s / 1000);
      if (km > lastKm) {
        lastKm = km;
        events?.emit('kilometre', { km });
      }
    },

    setAutopilot(enabled) {
      autopilotEnabled = enabled;
    },
  };
}
