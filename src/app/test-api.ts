/**
 * The hook the screenshot harness drives the game through (ADR-0008).
 *
 * Screenshots are how this game gets looked at, so this is a first-class
 * interface rather than a debug afterthought: everything needed to put the
 * game into a specific, reproducible state goes through here.
 */

import type { App } from './app.js';
import type { GameModule } from '../contracts/module.js';
import type { FramingOverrides } from '../contracts/view.js';
import type { CameraMode } from '../render/renderer.js';

export interface TestApi {
  /** Resolves once the first frame has been drawn. */
  ready: Promise<void>;
  /**
   * Drives to a distance in metres under autopilot, then hands control back.
   *
   * Deliberately *drives* rather than teleports: the car arrives having gone
   * round the corners, so a still taken here shows the body where the physics
   * actually put it. A teleported car would be level and centred, which is the
   * one thing Phase 2 must never be photographed as.
   */
  warpTo(distanceM: number): void;
  /** Runs a fixed number of seconds of simulation. */
  advanceSeconds(seconds: number): void;
  /** Hands the car to the autopilot, or back to the finger. */
  setAutopilot(enabled: boolean): void;
  /** Overrides the finger with fixed control values. null returns control. */
  setScriptedInput(input: { steer: number; throttle: number; brake: number } | null): void;
  setCameraMode(mode: CameraMode): void;
  /**
   * Sets the time of day. 0 = midnight, 0.25 = dawn, 0.5 = noon,
   * 0.76 = golden hour (the art target), 0.88 = twilight.
   * Also freezes the clock, so a shot lands exactly where it was asked for.
   */
  setTime(phase: number): void;
  setTimeFrozen(frozen: boolean): void;
  /** Everything the handling is doing right now. */
  telemetry(): {
    distanceM: number;
    lateralM: number;
    speedKmh: number;
    lateralG: number;
    rollDeg: number;
    pitchDeg: number;
    steerDeg: number;
    slipDeg: number;
    yawRate: number;
    surface: string;
    onRoad: boolean;
  };
  setDebugVisible(v: boolean): void;
  /** Retunes the framing live, for sweep shots. */
  setFramingOverrides(overrides: FramingOverrides): void;
  /** Turns camera look-ahead off, for before/after comparison. */
  setLookAheadEnabled(v: boolean): void;
  pause(): void;
  resume(): void;
  distanceM(): number;
  /** Which modules are loaded, and what each costs per step. */
  modules(): Array<{ name: string; stepMs: number }>;
  /**
   * Camera and scene-graph state. Exists because a broken frame is much easier
   * to diagnose from numbers than from a photograph of the result.
   */
  sceneReport(): {
    camera: { x: number; y: number; z: number; yaw: number; pitch: number };
    view: { x: number; y: number; z: number; heading: number; lookYaw: number };
    groups: Array<{
      name: string;
      children: Array<{ name: string; position: [number, number, number]; drawCount: number; visible: boolean }>;
    }>;
  };
  stats(): {
    fps: number;
    frameMs: number;
    simMs: number;
    renderMs: number;
    totalSteps: number;
    simTime: number;
    droppedFrames: number;
  };
}

declare global {
  interface Window {
    __dts?: TestApi;
  }
}

/** Finds a module by name and narrows it to whatever extra surface it exposes. */
function moduleAs<T>(app: App, name: string): (GameModule & Partial<T>) | undefined {
  return app.host.modules.find((m) => m.name === name) as (GameModule & Partial<T>) | undefined;
}

interface AutopilotCapable {
  setAutopilot(enabled: boolean): void;
}
interface ScriptCapable {
  setScriptedInput(input: { steer: number; throttle: number; brake: number } | null): void;
}
interface LookAheadCapable {
  setLookAheadEnabled(v: boolean): void;
}
interface TimeCapable {
  setTimePhase(phase: number): void;
  setTimeFrozen(frozen: boolean): void;
}

export function installTestApi(app: App, ready: Promise<void>): TestApi {
  const setAutopilot = (enabled: boolean): void => {
    moduleAs<AutopilotCapable>(app, 'sim')?.setAutopilot?.(enabled);
  };

  const api: TestApi = {
    ready,

    warpTo(distanceM: number) {
      if (app.car.distanceM >= distanceM) return;
      setAutopilot(true);
      // Chunked rather than one long advance, so the loop is asked for a
      // sensible slice at a time and a stuck car cannot spin forever.
      const CHUNK_S = 0.5;
      const maxChunks = Math.ceil((distanceM / 8) / CHUNK_S) + 400;
      let chunks = 0;
      while (app.car.distanceM < distanceM && chunks < maxChunks) {
        app.advanceSeconds(CHUNK_S);
        chunks++;
      }
      setAutopilot(false);
    },

    advanceSeconds: (s) => app.advanceSeconds(s),
    setAutopilot,
    setScriptedInput(input) {
      moduleAs<ScriptCapable>(app, 'input')?.setScriptedInput?.(input);
    },
    setCameraMode: (mode) => app.setCameraMode(mode),

    setTime(phase: number) {
      const world = moduleAs<TimeCapable>(app, 'world');
      world?.setTimeFrozen?.(true);
      world?.setTimePhase?.(phase);
    },
    setTimeFrozen(frozen: boolean) {
      moduleAs<TimeCapable>(app, 'world')?.setTimeFrozen?.(frozen);
    },

    telemetry() {
      const c = app.car;
      return {
        distanceM: c.distanceM,
        lateralM: c.lateralM,
        speedKmh: c.speedMs * 3.6,
        lateralG: c.lateralG,
        rollDeg: (c.roll * 180) / Math.PI,
        pitchDeg: (c.pitch * 180) / Math.PI,
        steerDeg: (c.steerAngle * 180) / Math.PI,
        slipDeg: (c.slipAngle * 180) / Math.PI,
        yawRate: c.yawRate,
        surface: c.surface,
        onRoad: c.onRoad,
      };
    },

    setDebugVisible: (v) => app.setDebugVisible(v),
    setFramingOverrides: (o) => app.setFramingOverrides(o),
    setLookAheadEnabled(v: boolean) {
      // Reached through the module rather than the app: turning look-ahead off
      // is the view domain's business, and the app has no opinion about it.
      moduleAs<LookAheadCapable>(app, 'view')?.setLookAheadEnabled?.(v);
    },
    sceneReport: () => app.sceneReport(),
    pause: () => app.stop(),
    resume: () => app.start(),
    distanceM: () => app.distanceM(),
    modules: () =>
      app.host.modules.map((m) => ({ name: m.name, stepMs: app.host.timings.get(m.name) ?? 0 })),
    stats: () => {
      const s = app.loop.stats;
      return {
        fps: s.fps,
        frameMs: s.frameMs,
        simMs: s.simMs,
        renderMs: s.renderMs,
        totalSteps: s.totalSteps,
        simTime: s.simTime,
        droppedFrames: s.droppedFrames,
      };
    },
  };
  window.__dts = api;
  return api;
}
