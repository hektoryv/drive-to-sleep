/**
 * The composition root.
 *
 * The only place allowed to know about more than one domain. It owns the
 * canvas, the renderer, the scene, the loop and the clock, hands each module
 * its own slice of the scene graph and the DOM, and otherwise has no opinion
 * about what any of them do.
 *
 * If you find yourself wanting to add domain logic here, it belongs in a
 * module — see docs/06-modules.md.
 */

import * as THREE from 'three';
import { createLoop, type Loop } from '../core/loop.js';
import { createEventBus, type EventBus } from '../core/events.js';
import { createServiceRegistry } from '../contracts/services.js';
import type { GameEventMap } from '../contracts/events.js';
import type { CarView } from '../contracts/vehicle.js';
import type { FramingOverrides, ViewState } from '../contracts/view.js';
import { makeViewState } from '../contracts/view.js';
import { SIM } from '../sim/tuning.js';
import { createRenderer, type CameraMode, type Renderer } from '../render/renderer.js';
import { createModules } from './modules.js';
import { createModuleHost, type ModuleHost } from './registry.js';
import { createDebugOverlay, type DebugOverlay } from './debug.js';

export interface AppOptions {
  canvas: HTMLCanvasElement;
  overlayRoot: HTMLElement;
  seed?: number;
  framing?: FramingOverrides;
}

export interface App {
  readonly loop: Loop;
  readonly events: EventBus<GameEventMap>;
  readonly seed: number;
  readonly view: Readonly<ViewState>;
  readonly host: ModuleHost;
  /** Read-only view of the car, for telemetry and the test API. */
  readonly car: CarView;
  /** Distance travelled this drive, metres. */
  distanceM(): number;
  /**
   * Runs `seconds` of simulation with no rendering, deterministically.
   * The harness drives the car with this; who is steering is not its business.
   */
  advanceSeconds(seconds: number): void;
  setCameraMode(mode: CameraMode): void;
  setDebugVisible(v: boolean): void;
  setFramingOverrides(overrides: FramingOverrides): void;
  /** Camera and scene-graph state, for diagnosing a bad frame from numbers. */
  sceneReport(): SceneReport;
  resize(width: number, height: number, pixelRatio: number): void;
  start(): void;
  stop(): void;
  dispose(): void;
}

export interface SceneReport {
  camera: { x: number; y: number; z: number; yaw: number; pitch: number };
  view: { x: number; y: number; z: number; heading: number; lookYaw: number };
  groups: Array<{
    name: string;
    children: Array<{
      name: string;
      position: [number, number, number];
      drawCount: number;
      visible: boolean;
    }>;
  }>;
}

export function createApp(options: AppOptions): App {
  const seed = options.seed ?? 1;

  const events = createEventBus<GameEventMap>();
  const services = createServiceRegistry();
  const renderer: Renderer = createRenderer(options.canvas);
  const scene = new THREE.Scene();
  const view = makeViewState();

  if (options.framing !== undefined) renderer.setFramingOverrides(options.framing);

  const debug: DebugOverlay = createDebugOverlay(options.overlayRoot);

  const host = createModuleHost(createModules({ view }), {
    seed,
    scene,
    camera: renderer.camera,
    overlayRoot: options.overlayRoot,
    services,
    events,
    framing: renderer.framing,
    view,
  });

  const car = services.require('car');

  function update(dt: number): void {
    host.step(dt);
  }

  function render(alpha: number): void {
    host.frame(alpha);
    renderer.render(scene, view);
    debug.watch('dist', `${(car.distanceM / 1000).toFixed(3)} km`);
    debug.watch('speed', `${(car.speedMs * 3.6).toFixed(0)} km/h`);
    debug.watch('head', `${((view.heading * 180) / Math.PI).toFixed(1)}°`);
    debug.watch('look', `${((view.lookYaw * 180) / Math.PI).toFixed(1)}°`);
    // Handling telemetry. Tuning a car from a picture is guesswork; these are
    // the numbers that say what it is actually doing.
    debug.watch('lat', `${car.lateralG.toFixed(2)} g`);
    debug.watch('roll', `${((view.roll * 180) / Math.PI).toFixed(2)}°`);
    debug.watch('pitch', `${((view.pitch * 180) / Math.PI).toFixed(2)}°`);
    debug.watch('steer', `${((car.steerAngle * 180) / Math.PI).toFixed(1)}°`);
    debug.watch('slip', `${((car.slipAngle * 180) / Math.PI).toFixed(1)}°`);
    debug.watch('t', `${car.lateralM.toFixed(2)} m ${car.surface}`);
    debug.update(loop.stats, renderer.info, renderer.framing, host.timings);
  }

  const loop = createLoop({ update, render }, { stepHz: SIM.STEP_HZ, maxSubSteps: SIM.MAX_SUB_STEPS });

  return {
    loop,
    events,
    seed,
    view,
    host,
    car,
    distanceM: () => car.distanceM,

    advanceSeconds(seconds: number) {
      loop.advance(seconds);
    },

    setCameraMode: (mode) => renderer.setCameraMode(mode),

    setDebugVisible: (v) => debug.setVisible(v),

    sceneReport(): SceneReport {
      const cam = renderer.camera;
      return {
        camera: {
          x: cam.position.x,
          y: cam.position.y,
          z: cam.position.z,
          yaw: cam.rotation.y,
          pitch: cam.rotation.x,
        },
        view: { x: view.x, y: view.y, z: view.z, heading: view.heading, lookYaw: view.lookYaw },
        groups: scene.children.map((g) => ({
          name: g.name,
          children: (g as THREE.Group).children.map((c) => {
            const mesh = c as THREE.Mesh;
            const range = mesh.geometry?.drawRange;
            return {
              name: mesh.type,
              position: [c.position.x, c.position.y, c.position.z] as [number, number, number],
              drawCount: range === undefined ? -1 : range.count,
              visible: c.visible,
            };
          }),
        })),
      };
    },

    setFramingOverrides(overrides: FramingOverrides) {
      renderer.setFramingOverrides(overrides);
      host.resize(renderer.framing);
    },

    resize(width, height, pixelRatio) {
      renderer.resize(width, height, pixelRatio);
      host.resize(renderer.framing);
    },

    start() {
      // The modules are told as well as the loop. A module that owns something
      // with its own clock — the AudioContext — would otherwise keep going
      // while the game is backgrounded and nothing is stepping it.
      host.resume();
      loop.start();
    },

    stop() {
      loop.stop();
      host.pause();
    },

    dispose() {
      loop.stop();
      host.dispose();
      debug.dispose();
      renderer.dispose();
      events.clear();
    },
  };
}
