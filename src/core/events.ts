/**
 * A tiny typed event bus.
 *
 * Exists so the simulation can announce things ("you overtook a car", "you hit
 * something") without knowing that a renderer, a HUD or a particle system
 * exists — which is the sim/render separation from ADR-0002 in practice.
 *
 * Emitting allocates nothing: payloads are passed as a single object the
 * caller owns and may reuse, and listeners are stored in plain arrays.
 * Listeners must therefore not retain the payload past the call.
 */

export interface GameEventMap {
  /** Fired once when the world is ready and the first frame can be drawn. */
  ready: { seed: number };
  /** The player passed a traffic car. */
  overtake: { totalOvertakes: number };
  /** Contact with another vehicle. `closingSpeed` is in m/s. */
  collision: { closingSpeed: number };
  /** Wheels left or regained tarmac. */
  surfaceChange: { onRoad: boolean };
  /** Crossed a whole-kilometre boundary. */
  kilometre: { km: number };
}

export type EventName = keyof GameEventMap;
export type Listener<K extends EventName> = (payload: GameEventMap[K]) => void;

export interface EventBus {
  on<K extends EventName>(name: K, fn: Listener<K>): () => void;
  off<K extends EventName>(name: K, fn: Listener<K>): void;
  emit<K extends EventName>(name: K, payload: GameEventMap[K]): void;
  clear(): void;
}

export function createEventBus(): EventBus {
  // One array per event name, created lazily and then reused forever.
  // Slots are nulled rather than spliced while a dispatch is in progress:
  // splicing mid-dispatch shifts the remaining listeners down and silently
  // skips the one after the listener that removed itself.
  const listeners = new Map<EventName, Array<Listener<EventName> | null>>();
  let dispatchDepth = 0;
  let needsCompaction = false;

  function listFor(name: EventName): Array<Listener<EventName> | null> {
    let list = listeners.get(name);
    if (list === undefined) {
      list = [];
      listeners.set(name, list);
    }
    return list;
  }

  function compact(): void {
    for (const list of listeners.values()) {
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i] === null) list.splice(i, 1);
      }
    }
    needsCompaction = false;
  }

  const bus: EventBus = {
    on(name, fn) {
      listFor(name).push(fn as Listener<EventName>);
      return () => bus.off(name, fn);
    },
    off(name, fn) {
      const list = listeners.get(name);
      if (list === undefined) return;
      const i = list.indexOf(fn as Listener<EventName>);
      if (i < 0) return;
      if (dispatchDepth > 0) {
        list[i] = null;
        needsCompaction = true;
      } else {
        list.splice(i, 1);
      }
    },
    emit(name, payload) {
      const list = listeners.get(name);
      if (list === undefined) return;
      dispatchDepth++;
      // Length is read each iteration so a listener added during dispatch is
      // reached, and nulls are skipped so one removed during dispatch is not.
      for (let i = 0; i < list.length; i++) {
        const fn = list[i];
        if (fn !== null && fn !== undefined) (fn as Listener<typeof name>)(payload);
      }
      dispatchDepth--;
      if (dispatchDepth === 0 && needsCompaction) compact();
    },
    clear() {
      listeners.clear();
      needsCompaction = false;
    },
  };

  return bus;
}
