/**
 * The audio domain's entire presence in the game.
 *
 * It reads the car through the `car` and `controls` contracts and makes a
 * noise. It provides nothing, owns no geometry, and adds nothing to its DOM
 * layer — which is why adding it changed no other domain's code. Sound was
 * ruled out at the start of the project and ruled back in on 2026-09-20
 * (ADR-0016); the architecture is the reason that cost one directory.
 *
 * ## Why the first touch matters
 *
 * Browsers, including the Android WebView, will not let a page make a sound
 * before the person has interacted with it. So the context starts suspended
 * and is resumed once `controls.active` first goes true — which is the moment
 * a finger lands, and in this game a finger has to land before anything moves
 * anyway. Chromium's activation is sticky, so resuming from the step rather
 * than from inside the touch handler is allowed, and it saves the audio
 * domain from needing a window listener of its own (docs/06-modules.md).
 */

import type { GameModule } from '../contracts/module.js';
import type { CarView, ControlState } from '../contracts/vehicle.js';
import { createAudioGraph, type AudioGraph, type SoundState } from './graph.js';
import { MASTER } from './tuning.js';

/** Seconds between attempts to start a context the browser is still refusing. */
const RESUME_RETRY_S = 0.5;

export function createAudioModule(
  createGraph: () => AudioGraph | undefined = createAudioGraph,
): GameModule {
  let car: CarView | undefined;
  let controls: ControlState | undefined;
  let graph: AudioGraph | undefined;
  let running = false;
  let sinceAttempt = RESUME_RETRY_S;
  let suspendTimer: ReturnType<typeof setTimeout> | undefined;
  let resumeGeneration = 0;

  function cancelSuspend(): void {
    if (suspendTimer === undefined) return;
    clearTimeout(suspendTimer);
    suspendTimer = undefined;
  }

  // Written in place every frame rather than rebuilt, like every other piece
  // of per-frame state in this codebase.
  const state = {
    rpm: 0,
    speedMs: 0,
    throttle: 0,
    surface: 'tarmac',
    lateralG: 0,
  } as { -readonly [K in keyof SoundState]: SoundState[K] };

  return {
    name: 'audio',

    init() {
      // Undefined where there is no Web Audio — the tests and the screenshot
      // harness both run somewhere that has none, and neither should care.
      graph = createGraph();
    },

    start(ctx) {
      car = ctx.services.require('car');
      controls = ctx.services.require('controls');
    },

    step(dt) {
      if (graph === undefined || controls === undefined) return;
      if (running || !controls.active) return;

      cancelSuspend();

      sinceAttempt += dt;
      if (sinceAttempt < RESUME_RETRY_S) return;
      sinceAttempt = 0;

      if (graph.context.state === 'running') {
        running = true;
        graph.setRunning(true);
        return;
      }
      const attempt = resumeGeneration;
      void graph.context
        .resume()
        .then(() => {
          if (graph === undefined || attempt !== resumeGeneration) return;
          running = true;
          graph.setRunning(true);
        })
        .catch(() => {
          // Autoplay policy can refuse an attempt even after a touch. The
          // fixed-step retry path will try again after RESUME_RETRY_S.
        });
    },

    frame() {
      if (graph === undefined || car === undefined || controls === undefined) return;
      state.rpm = car.rpm;
      state.speedMs = car.speedMs;
      state.throttle = controls.throttle;
      state.surface = car.surface;
      state.lateralG = car.lateralG;
      graph.update(state, car.maxRpm);
    },

    pause() {
      // Fade rather than suspend, then suspend once the fade has finished:
      // suspending an audible graph leaves the last half-cycle hanging, which
      // is audible as a click exactly when the player is leaving the app.
      graph?.setRunning(false);
      running = false;
      resumeGeneration++;
      sinceAttempt = RESUME_RETRY_S;
      cancelSuspend();
      const pausedGraph = graph;
      if (pausedGraph !== undefined) {
        suspendTimer = setTimeout(() => {
          suspendTimer = undefined;
          if (graph === pausedGraph && !running && pausedGraph.context.state === 'running') {
            void pausedGraph.context.suspend();
          }
        }, MASTER.FADE_S * 1000);
      }
    },

    resume() {
      // Deliberately does not start anything. The graph comes back on the
      // next touch, through the same path as the first one, so there is only
      // one place where sound can begin.
      sinceAttempt = RESUME_RETRY_S;
    },

    dispose() {
      cancelSuspend();
      resumeGeneration++;
      graph?.dispose();
      graph = undefined;
    },
  };
}
