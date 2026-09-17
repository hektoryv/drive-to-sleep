/**
 * Drives a set of modules through the shared lifecycle.
 *
 * Each module is handed its own scene subtree and its own DOM layer, and never
 * sees another module's. That isolation is the point: an agent working on the
 * environment can add, move and delete anything inside `world`'s group without
 * any possibility of disturbing the cockpit or the HUD (ADR-0011).
 *
 * Init runs in two passes so that registration order carries no meaning:
 * everything registers its services in pass one, everything resolves the
 * services it needs in pass two.
 */

import * as THREE from 'three';
import type { EventBus } from '../core/events.js';
import type { GameEventMap } from '../contracts/events.js';
import type { GameModule, ModuleContext } from '../contracts/module.js';
import type { ServiceRegistry } from '../contracts/services.js';
import type { Framing, ViewState } from '../contracts/view.js';

export interface RegistryOptions {
  seed: number;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  overlayRoot: HTMLElement;
  services: ServiceRegistry;
  events: EventBus<GameEventMap>;
  framing: Framing;
  /** Owned by the app, written only by the camera module, read by everyone. */
  view: ViewState;
}

export interface ModuleHost {
  readonly modules: readonly GameModule[];
  /** Per-module timings, for the debug overlay. Milliseconds, smoothed. */
  readonly timings: ReadonlyMap<string, number>;
  step(dt: number): void;
  frame(alpha: number): void;
  resize(framing: Framing): void;
  dispose(): void;
}

const TIMING_SMOOTHING = 0.08;

export function createModuleHost(modules: readonly GameModule[], options: RegistryOptions): ModuleHost {
  const contexts = new Map<string, ModuleContext>();
  const timings = new Map<string, number>();
  let framing = options.framing;

  const seen = new Set<string>();
  for (const m of modules) {
    if (seen.has(m.name)) {
      throw new Error(`Two modules are both named "${m.name}". Names must be unique.`);
    }
    seen.add(m.name);

    const group = new THREE.Group();
    group.name = m.name;
    options.scene.add(group);

    const overlay = document.createElement('div');
    overlay.className = 'module-layer';
    overlay.dataset.module = m.name;
    options.overlayRoot.appendChild(overlay);

    contexts.set(m.name, {
      seed: options.seed,
      services: options.services,
      events: options.events,
      scene: group,
      overlay,
      camera: options.camera,
      get framing() {
        return framing;
      },
    });
  }

  // Pass one: everything registers what it provides.
  for (const m of modules) m.init?.(contexts.get(m.name) as ModuleContext);
  // Pass two: everything resolves what it needs.
  for (const m of modules) m.start?.(contexts.get(m.name) as ModuleContext);

  function record(name: string, ms: number): void {
    const prev = timings.get(name) ?? ms;
    timings.set(name, prev + (ms - prev) * TIMING_SMOOTHING);
  }

  return {
    modules,
    timings,
    step(dt: number) {
      for (const m of modules) {
        if (m.step === undefined) continue;
        const t0 = performance.now();
        m.step(dt);
        record(m.name, performance.now() - t0);
      }
    },
    frame(alpha: number) {
      for (const m of modules) m.frame?.(alpha, options.view);
    },
    resize(next: Framing) {
      framing = next;
      for (const m of modules) m.resize?.(next);
    },
    dispose() {
      // Reverse order, so a module that consumed another's service tears down
      // before the thing it was using.
      for (let i = modules.length - 1; i >= 0; i--) modules[i]?.dispose?.();
      for (const ctx of contexts.values()) {
        ctx.scene.removeFromParent();
        ctx.overlay.remove();
      }
      contexts.clear();
    },
  };
}
