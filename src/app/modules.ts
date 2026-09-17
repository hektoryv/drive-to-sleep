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
import { createCruiseModule } from '../sim/cruise-module.js';
import { createViewModule } from '../render/view-module.js';

export interface ModuleSetOptions {
  view: ViewState;
}

export function createModules(options: ModuleSetOptions): GameModule[] {
  return [
    // The road first: everything downstream reads it, and one tick of
    // staleness in the other direction is invisible at 5 km of look-ahead.
    createWorldModule(),
    // PHASE 1: a placeholder cruise. The real vehicle model replaces this
    // module in Phase 2 and nothing else has to change.
    createCruiseModule(),
    // Last, so the camera sees this tick's car rather than the previous one's.
    createViewModule({ view: options.view }),
  ];
}
