/**
 * Composition root.
 *
 * The one place allowed to know about both the simulation and the renderer.
 * Everything below it stays on its own side of the line (ADR-0002).
 *
 * PHASE 0: there is no vehicle and no road yet. A placeholder state cruises
 * forward in a straight line at a constant speed so the loop, the framing and
 * the screenshot harness have something real to move. Phase 1 replaces the
 * placeholder world; Phase 2 replaces the placeholder motion.
 */

import { createLoop, type Loop } from './core/loop.js';
import { createEventBus, type EventBus } from './core/events.js';
import { SIM, TIME } from './sim/tuning.js';
import { createRenderer, makeViewState, type Renderer, type ViewState } from './render/renderer.js';
import { createDebugOverlay, type DebugOverlay } from './render/debug.js';
import {
  createPlaceholderScene,
  type PlaceholderScene,
  type PlaceholderTime,
} from './render/placeholder-scene.js';

export interface GameOptions {
  canvas: HTMLCanvasElement;
  overlayParent: HTMLElement;
  seed?: number;
  time?: PlaceholderTime;
}

export interface Game {
  readonly loop: Loop;
  readonly events: EventBus;
  readonly seed: number;
  /** Distance travelled this drive, metres. */
  distanceM(): number;
  /** Fast-forwards deterministically to a distance. Used by the harness. */
  warpTo(distanceM: number): void;
  setTime(time: PlaceholderTime): void;
  setDebugVisible(v: boolean): void;
  resize(width: number, height: number, pixelRatio: number): void;
  start(): void;
  stop(): void;
  dispose(): void;
}

/** PHASE 0 placeholder: a fixed cruise, standing in for the vehicle model. */
const PLACEHOLDER_CRUISE_MS = 110 / 3.6;

export function createGame(options: GameOptions): Game {
  const seed = options.seed ?? 1;
  const events = createEventBus();

  const renderer: Renderer = createRenderer(options.canvas);
  const scene: PlaceholderScene = createPlaceholderScene(options.time ?? 'day');
  const debug: DebugOverlay = createDebugOverlay(options.overlayParent);

  const view: ViewState = makeViewState();

  // Placeholder simulation state. Everything here is temporary.
  const state: { distanceM: number; speedMs: number; timePhase: number; lastKm: number } = {
    distanceM: 0,
    speedMs: PLACEHOLDER_CRUISE_MS,
    timePhase: TIME.START_PHASE,
    lastKm: 0,
  };

  function update(dt: number): void {
    state.distanceM += state.speedMs * dt;
    state.timePhase = (state.timePhase + dt / TIME.CYCLE_SECONDS) % 1;

    const km = Math.floor(state.distanceM / 1000);
    if (km > state.lastKm) {
      state.lastKm = km;
      events.emit('kilometre', { km });
    }
  }

  function render(alpha: number): void {
    // Interpolate the presented position between simulation steps so motion
    // stays smooth when the display rate and the 120 Hz sim disagree.
    const shown = state.distanceM + state.speedMs * loop.stepDt * alpha;

    view.x = 0;
    view.z = -shown;
    view.heading = 0;

    scene.follow(view.x, view.z);
    renderer.render(scene.scene, view);

    debug.watch('dist', `${(shown / 1000).toFixed(3)} km`);
    debug.watch('speed', `${(state.speedMs * 3.6).toFixed(0)} km/h`);
    debug.watch('phase', state.timePhase);
    debug.update(loop.stats, renderer.info, renderer.framing);
  }

  const loop = createLoop(
    { update, render },
    { stepHz: SIM.STEP_HZ, maxSubSteps: SIM.MAX_SUB_STEPS },
  );

  return {
    loop,
    events,
    seed,
    distanceM: () => state.distanceM,
    warpTo(distanceM: number) {
      const remaining = distanceM - state.distanceM;
      if (remaining <= 0) return;
      // Deliberately advanced by running real simulation steps rather than by
      // assigning the distance: it exercises the same code path the game does,
      // so what the harness photographs is what the game produces.
      loop.advance(remaining / state.speedMs);
    },
    setTime: (time) => scene.setTime(time),
    setDebugVisible: (v) => debug.setVisible(v),
    resize: (width, height, pixelRatio) => renderer.resize(width, height, pixelRatio),
    start: () => loop.start(),
    stop: () => loop.stop(),
    dispose() {
      loop.stop();
      debug.dispose();
      scene.dispose();
      renderer.dispose();
      events.clear();
    },
  };
}
