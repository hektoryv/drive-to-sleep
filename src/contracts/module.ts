/**
 * The module lifecycle.
 *
 * A module is one domain's entire presence in the running game: the world, the
 * cockpit, the HUD. The composition root in `app/` drives every module through
 * the same lifecycle and otherwise knows nothing about what any of them do.
 *
 * This is the piece that makes parallel work safe. A module gets:
 *
 *   - **its own scene subtree** (`scene`), which it may do anything to and
 *     which nothing else touches, so the environment cannot move the cockpit;
 *   - **its own DOM layer** (`overlay`), same deal for anything drawn in HTML;
 *   - **services**, to reach other domains through contracts rather than
 *     imports.
 *
 * A module that stays inside those three things cannot break another module.
 */

import type * as THREE from 'three';
import type { EventBus } from '../core/events.js';
import type { GameEventMap } from './events.js';
import type { ServiceRegistry } from './services.js';
import type { Framing, ViewState } from './view.js';

export interface ModuleContext {
  /** World seed. The same seed must always produce the same world (ADR-0002). */
  readonly seed: number;
  readonly services: ServiceRegistry;
  readonly events: EventBus<GameEventMap>;
  /**
   * This module's own subtree of the scene graph. Add geometry here.
   * Never reach outside it — that is the whole isolation guarantee.
   */
  readonly scene: THREE.Group;
  /** This module's own absolutely-positioned DOM layer, on top of the canvas. */
  readonly overlay: HTMLElement;
  /** The live camera. Read it; only `render/` may move it. */
  readonly camera: THREE.PerspectiveCamera;
  /** Current framing. Re-read on `resize` rather than cached. */
  readonly framing: Framing;
}

export interface GameModule {
  /** Unique, kebab-case, matching the owning domain. Used in errors and profiling. */
  readonly name: string;

  /**
   * Phase 1 of startup. Build state and **register services here**.
   * Do not resolve other modules' services yet — they may not exist.
   */
  init?(ctx: ModuleContext): void;

  /**
   * Phase 2 of startup, after every module has run `init`.
   * **Resolve other modules' services here.** Two phases is what makes
   * registration order irrelevant.
   */
  start?(ctx: ModuleContext): void;

  /**
   * Fixed-timestep simulation, always the same `dt` (ADR-0002).
   * Runs in module registration order.
   */
  step?(dt: number): void;

  /**
   * Presentation, once per displayed frame. `alpha` is 0..1 between the last
   * two simulation states — interpolate with it. Never advance simulation
   * state here; it would break at frame rates other than yours.
   */
  frame?(alpha: number, view: Readonly<ViewState>): void;

  resize?(framing: Framing): void;

  dispose?(): void;
}
