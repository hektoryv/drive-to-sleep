/**
 * The service registry — how one domain gets at another domain's capabilities
 * without importing it.
 *
 * A domain that *provides* something registers it during `init`. A domain that
 * *consumes* something resolves it during `start`. Because those are two
 * separate phases, module registration order does not matter, and no module
 * needs to know which other modules exist.
 */

import type { RoadQuery } from './world.js';
import type { CarView, ControlState } from './vehicle.js';

/**
 * Everything one domain may expose to another.
 *
 * Adding a key here is the coordination event: it means a new cross-domain
 * capability exists. Keep it small — most things do not belong here.
 */
export interface Services {
  /** Provided by `world/`. The road, queryable at any distance. */
  road: RoadQuery;
  /** Provided by `sim/`. Read-only state of the driver's car. */
  car: CarView;
  /** Provided by `input/`. The current control input. */
  controls: ControlState;
}

export type ServiceKey = keyof Services;

export interface ServiceRegistry {
  /** Called during `init`. Registering the same key twice is an error. */
  provide<K extends ServiceKey>(key: K, value: Services[K]): void;
  /** Called during `start`. Throws if nothing provided the key. */
  require<K extends ServiceKey>(key: K): Services[K];
  /** For genuinely optional dependencies — a debug overlay, say. */
  optional<K extends ServiceKey>(key: K): Services[K] | undefined;
  has(key: ServiceKey): boolean;
}

export function createServiceRegistry(): ServiceRegistry {
  const map = new Map<ServiceKey, Services[ServiceKey]>();
  return {
    provide(key, value) {
      if (map.has(key)) {
        throw new Error(
          `Two modules both provide "${key}". Exactly one domain owns each service ` +
            `— see docs/06-modules.md.`,
        );
      }
      map.set(key, value);
    },
    require(key) {
      const v = map.get(key);
      if (v === undefined) {
        throw new Error(
          `No module provides "${key}". Either its owning module is not registered ` +
            `in app/modules.ts, or it registered after start.`,
        );
      }
      return v as Services[typeof key];
    },
    optional(key) {
      return map.get(key) as Services[typeof key] | undefined;
    },
    has: (key) => map.has(key),
  };
}
