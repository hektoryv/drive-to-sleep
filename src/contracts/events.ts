/**
 * The game's event vocabulary.
 *
 * A domain announces things here rather than calling into another domain.
 * Adding an event is safe and needs no coordination; changing or removing one
 * is a contract change (see contracts/README.md).
 */

export interface GameEventMap {
  /** The world is ready and the first frame can be drawn. */
  ready: { seed: number };
  /** The player passed a traffic car. */
  overtake: { totalOvertakes: number };
  /** Contact with another vehicle. `closingSpeed` in m/s. */
  collision: { closingSpeed: number };
  /** Wheels left or regained tarmac. */
  surfaceChange: { onRoad: boolean };
  /** Crossed a whole-kilometre boundary. */
  kilometre: { km: number };
  /** A road chunk was built or recycled. Debug and profiling. */
  chunkChange: { built: number; recycled: number; liveChunks: number };
}
