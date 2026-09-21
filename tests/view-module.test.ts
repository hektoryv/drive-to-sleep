import { describe, expect, it } from 'vitest';
import type { ModuleContext } from '../src/contracts/module.js';
import { createServiceRegistry } from '../src/contracts/services.js';
import type { CarView } from '../src/contracts/vehicle.js';
import type { RoadQuery } from '../src/contracts/world.js';
import { makeViewState } from '../src/contracts/view.js';
import { createViewModule } from '../src/render/view-module.js';

type MutableCar = { -readonly [K in keyof CarView]: CarView[K] };

function makeCar(): MutableCar {
  return {
    distanceM: 0, lateralM: 0, speedMs: 0, rpm: 900, maxRpm: 7000,
    x: 0, y: 2, z: 0, heading: (179 * Math.PI) / 180,
    roll: 0, pitch: 0, heaveY: 0, steerAngle: 0,
    onRoad: true, surface: 'tarmac', lateralG: 0, slipAngle: 0, yawRate: 0, lateralMs: 0,
  };
}

const ROAD: RoadQuery = {
  sampleAt(_s, out) { return out; },
  headingAt() { return 0; },
  surfaceAt() { return 'tarmac'; },
  groundHeightAt() { return 0; },
  toRoadSpace(_x, _z, _nearS, out) { out.s = 0; out.t = 0; },
  ensureSpan() {},
};

describe('view presentation', () => {
  it('interpolates the car pose and takes the short arc across wrapped headings', () => {
    const car = makeCar();
    const services = createServiceRegistry();
    services.provide('car', car);
    services.provide('road', ROAD);
    const view = makeViewState();
    const module = createViewModule({ view });
    const context = { services } as unknown as ModuleContext;
    module.start?.(context);

    car.x = 10;
    car.y = 4;
    car.heading = (-179 * Math.PI) / 180;
    module.step?.(1 / 120);
    module.frame?.(0.5, view);

    expect(view.x).toBeCloseTo(5, 8);
    expect(view.y).toBeCloseTo(3, 8);
    expect(Math.abs(view.heading)).toBeCloseTo(Math.PI, 6);
    expect(view.eyeX).not.toBeCloseTo(car.x, 3);
  });
});
