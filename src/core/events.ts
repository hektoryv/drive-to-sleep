/**
 * A tiny typed event bus, generic over an event map.
 *
 * Exists so one domain can announce something without knowing which other
 * domains care — the sim says "you overtook a car" and has no idea whether a
 * HUD, a particle system, both or neither is listening (ADR-0011).
 *
 * The game's event vocabulary lives in `contracts/events.ts`, not here.
 *
 * Emitting allocates nothing: payloads are passed as a single object the caller
 * owns and may reuse, and listeners live in plain arrays. Listeners must
 * therefore not retain a payload past the call.
 */

export type Listener<T> = (payload: T) => void;

export interface EventBus<M> {
  on<K extends keyof M>(name: K, fn: Listener<M[K]>): () => void;
  off<K extends keyof M>(name: K, fn: Listener<M[K]>): void;
  emit<K extends keyof M>(name: K, payload: M[K]): void;
  clear(): void;
}

export function createEventBus<M>(): EventBus<M> {
  // One array per event name, created lazily and then reused forever.
  // Slots are nulled rather than spliced while a dispatch is in progress:
  // splicing mid-dispatch shifts the remaining listeners down and silently
  // skips the one after the listener that removed itself.
  const listeners = new Map<keyof M, Array<Listener<never> | null>>();
  let dispatchDepth = 0;
  let needsCompaction = false;

  function listFor(name: keyof M): Array<Listener<never> | null> {
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

  const bus: EventBus<M> = {
    on(name, fn) {
      listFor(name).push(fn as Listener<never>);
      return () => bus.off(name, fn);
    },
    off(name, fn) {
      const list = listeners.get(name);
      if (list === undefined) return;
      const i = list.indexOf(fn as Listener<never>);
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
        if (fn !== null && fn !== undefined) (fn as Listener<M[typeof name]>)(payload);
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
