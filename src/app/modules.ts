/**
 * The module manifest — the one file that knows which domains exist.
 *
 * This is deliberately the *only* shared wiring point. Adding a domain is one
 * line here and a new directory; nothing else in the codebase changes, and no
 * module ever learns the name of another.
 *
 * Order matters only for `step()`, which runs top to bottom in one simulation
 * tick. It does not matter for startup: `init` and `start` run as two separate
 * passes precisely so that a module can depend on a service without depending
 * on where its provider sits in this list.
 */

import type { GameModule } from '../contracts/module.js';
import type { ViewState } from '../contracts/view.js';
import { createWorldModule } from '../world/world-module.js';
import { createInputModule } from '../input/input-module.js';
import { createVehicleModule } from '../sim/vehicle-module.js';
import { createViewModule } from '../render/view-module.js';
import { createCockpitModule } from '../cockpit/cockpit-module.js';
import { createAudioModule } from '../audio/audio-module.js';

export interface ModuleSetOptions {
  view: ViewState;
}

export function createModules(options: ModuleSetOptions): GameModule[] {
  return [
    // The road first: everything downstream reads it, and one tick of
    // staleness in the other direction is invisible at 5 km of look-ahead.
    createWorldModule(),
    // Input before the car, so the car acts on this tick's thumb and not the
    // last one's. One frame of input latency is a thing you can feel.
    createInputModule(),
    createVehicleModule(),
    // Last, so the camera sees this tick's car rather than the previous one's.
    createViewModule({ view: options.view }),
    // After the view module, because the cabin sits exactly where the camera
    // does and reads the eye position the view module has just resolved.
    createCockpitModule(),
    // After the camera because it reads the car rather than the view, so its
    // position in this list is free. Kept at the end because a domain that
    // provides nothing is the easiest one to reason about last.
    createAudioModule(),
  ];
}
