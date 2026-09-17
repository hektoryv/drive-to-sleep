/**
 * The hook the screenshot harness drives the game through (ADR-0008).
 *
 * Screenshots are how this game gets looked at, so this is a first-class
 * interface, not a debug afterthought: everything the harness needs to put the
 * game in a specific, reproducible state goes through here, and it stays
 * stable as the phases land.
 */

import type { Game } from './game.js';
import type { PlaceholderTime } from './render/placeholder-scene.js';

export interface TestApi {
  /** Resolves once the first frame has been drawn. */
  ready: Promise<void>;
  /** Fast-forwards the simulation to a distance in metres, then holds. */
  warpTo(distanceM: number): void;
  /** PHASE 0: three fixed moods. Phase 3 replaces this with the real cycle. */
  setTime(time: PlaceholderTime): void;
  setDebugVisible(v: boolean): void;
  pause(): void;
  resume(): void;
  distanceM(): number;
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

export function installTestApi(game: Game, ready: Promise<void>): TestApi {
  const api: TestApi = {
    ready,
    warpTo: (d) => game.warpTo(d),
    setTime: (t) => game.setTime(t),
    setDebugVisible: (v) => game.setDebugVisible(v),
    pause: () => game.stop(),
    resume: () => game.start(),
    distanceM: () => game.distanceM(),
    stats: () => {
      const s = game.loop.stats;
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
