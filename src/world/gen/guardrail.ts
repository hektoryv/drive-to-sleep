/** Pure guardrail decisions, kept out of the three.js roadside renderer. */

import { ROADSIDE } from '../tuning.js';

export function needsGuardrail(railGroundY: number, outerGroundY: number): boolean {
  return railGroundY - outerGroundY >= ROADSIDE.GUARDRAIL_MIN_DROP_M;
}

/**
 * Turns noisy per-station terrain decisions into road-engineering-sized runs.
 * Mutates a preallocated byte mask so the renderer does not allocate while a
 * generated window is being recycled.
 */
export function smoothGuardrailMask(
  mask: Uint8Array,
  count: number,
  joinGap: number,
  minRun: number,
): void {
  let i = 0;
  while (i < count) {
    if (mask[i] !== 0) {
      i++;
      continue;
    }
    const start = i;
    while (i < count && mask[i] === 0) i++;
    const bounded = start > 0 && i < count;
    if (bounded && i - start <= joinGap) mask.fill(1, start, i);
  }

  i = 0;
  while (i < count) {
    if (mask[i] === 0) {
      i++;
      continue;
    }
    const start = i;
    while (i < count && mask[i] !== 0) i++;
    if (i - start < minRun) mask.fill(0, start, i);
  }
}
