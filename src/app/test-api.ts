/**
 * The hook the screenshot harness drives the game through (ADR-0008).
 *
 * Screenshots are how this game gets looked at, so this is a first-class
 * interface rather than a debug afterthought: everything needed to put the
 * game into a specific, reproducible state goes through here.
 */

import type { App } from './app.js';
import type { FramingOverrides } from '../contracts/view.js';

export interface TestApi {
  /** Resolves once the first frame has been drawn. */
  ready: Promise<void>;
  /** Fast-forwards the simulation to a distance in metres, then holds. */
  warpTo(distanceM: number): void;
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

export function installTestApi(app: App, ready: Promise<void>): TestApi {
  const api: TestApi = {
    ready,
    warpTo: (d) => app.warpTo(d),
    setDebugVisible: (v) => app.setDebugVisible(v),
    setFramingOverrides: (o) => app.setFramingOverrides(o),
    setLookAheadEnabled(v: boolean) {
      // Reached through the module rather than the app: turning look-ahead off
      // is the view domain's business, and the app has no opinion about it.
      const mod = app.host.modules.find((m) => m.name === 'view') as
        | { setLookAheadEnabled?: (v: boolean) => void }
        | undefined;
      mod?.setLookAheadEnabled?.(v);
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
