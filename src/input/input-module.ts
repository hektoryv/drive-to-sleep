/**
 * The input domain, as a module. Provides the `controls` service.
 *
 * Also carries a scripted-input override, which the screenshot harness and the
 * handling regression tests drive the car with. That is not a debug
 * afterthought: without it there is no way to photograph the car mid-corner,
 * and Phase 2 is entirely about what the car does mid-corner.
 */

import type { GameModule } from '../contracts/module.js';
import type { ControlState } from '../contracts/vehicle.js';
import type { Framing } from '../contracts/view.js';
import { loadSave } from '../core/storage.js';
import {
  createControlsState,
  makePointerSample,
  stepControls,
  type ControlsState,
  type PointerSample,
} from './controls.js';
import { createPointerCapture, type PointerCapture } from './pointer.js';

export interface InputModule extends GameModule {
  /**
   * Overrides the finger with a script. Pass null to hand control back.
   * Values are the same normalised shape the player produces.
   */
  setScriptedInput(input: { steer: number; throttle: number; brake: number } | null): void;
}

export function createInputModule(): InputModule {
  const state: ControlsState = createControlsState();
  const empty: PointerSample = makePointerSample();
  let capture: PointerCapture | undefined;
  let framing: Framing | undefined;
  let scripted: { steer: number; throttle: number; brake: number } | null = null;

  const settings = loadSave().settings;

  return {
    name: 'input',

    init(ctx) {
      capture = createPointerCapture();
      ctx.services.provide('controls', state.out as ControlState);
      framing = ctx.framing;
    },

    step(dt) {
      if (scripted !== null) {
        state.out.steer = scripted.steer;
        state.out.throttle = scripted.throttle;
        state.out.brake = scripted.brake;
        state.out.active = true;
        return;
      }
      stepControls(state, capture?.sample ?? empty, {
        screenWidth: framing?.width ?? 412,
        screenHeight: framing?.height ?? 915,
        sensitivity: settings.steerSensitivity,
        invertY: settings.invertY,
      }, dt);
    },

    resize(next) {
      framing = next;
    },

    setScriptedInput(input) {
      scripted = input;
      if (input === null) {
        state.hasOrigin = false;
        state.out.active = false;
      }
    },

    dispose() {
      capture?.dispose();
    },
  };
}
