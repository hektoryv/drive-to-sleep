/**
 * PHASE 1 PLACEHOLDER — replaced by the real vehicle model in Phase 2.
 *
 * Drives the centreline at a constant speed. It exists so that something
 * provides the `car` service while the road is being built, and so the road
 * can be looked at in motion before there is anything to drive it with.
 *
 * Deliberately implements the full `CarView` contract rather than a cut-down
 * one: when the real vehicle lands it replaces this file and nothing else.
 */

import type { EventBus } from '../core/events.js';
import type { GameEventMap } from '../contracts/events.js';
import type { GameModule } from '../contracts/module.js';
import type { CarView } from '../contracts/vehicle.js';
import type { RoadQuery, RoadSample } from '../contracts/world.js';
import { makeRoadSample } from '../contracts/world.js';
import { CAR } from './tuning.js';

const CRUISE_MS = 110 / 3.6;

export function createCruiseModule(): GameModule {
  let road: RoadQuery | undefined;
  const sample: RoadSample = makeRoadSample();

  const state: {
    distanceM: number;
    lateralM: number;
    speedMs: number;
    rpm: number;
    x: number;
    y: number;
    z: number;
    heading: number;
    roll: number;
    pitch: number;
    heaveY: number;
    steerAngle: number;
    onRoad: boolean;
  } = {
    distanceM: 0,
    lateralM: 0,
    speedMs: CRUISE_MS,
    rpm: CAR.IDLE_RPM,
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    roll: 0,
    pitch: 0,
    heaveY: 0,
    steerAngle: 0,
    onRoad: true,
  };

  const view: CarView = {
    get distanceM() {
      return state.distanceM;
    },
    get lateralM() {
      return state.lateralM;
    },
    get speedMs() {
      return state.speedMs;
    },
    get rpm() {
      return state.rpm;
    },
    get x() {
      return state.x;
    },
    get y() {
      return state.y;
    },
    get z() {
      return state.z;
    },
    get heading() {
      return state.heading;
    },
    get roll() {
      return state.roll;
    },
    get pitch() {
      return state.pitch;
    },
    get heaveY() {
      return state.heaveY;
    },
    get steerAngle() {
      return state.steerAngle;
    },
    get onRoad() {
      return state.onRoad;
    },
  };

  let events: EventBus<GameEventMap> | undefined;
  let lastKm = 0;

  return {
    name: 'sim',

    init(ctx) {
      events = ctx.events;
      ctx.services.provide('car', view);
    },

    start(ctx) {
      road = ctx.services.require('road');
    },

    step(dt) {
      state.distanceM += state.speedMs * dt;
      if (road === undefined) return;

      road.sampleAt(state.distanceM, sample);
      state.x = sample.x;
      state.y = sample.y;
      state.z = sample.z;
      state.heading = sample.heading;

      // Stand-ins so the tachometer and the body have something to read. The
      // real versions come from the vehicle model in Phase 2.
      state.rpm = CAR.IDLE_RPM + (state.speedMs / CAR.TOP_SPEED_MS) * (CAR.MAX_RPM - CAR.IDLE_RPM);
      state.steerAngle = sample.curvature * 140;

      const km = Math.floor(state.distanceM / 1000);
      if (km > lastKm) {
        lastKm = km;
        events?.emit('kilometre', { km });
      }
    },
  };
}
