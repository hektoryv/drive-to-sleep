/**
 * Car state → sound parameters.
 *
 * Deliberately separate from the audio graph and deliberately pure: these are
 * the functions worth testing, and none of them needs a sound card to be
 * wrong. `graph.ts` does nothing but push their results into AudioParams.
 *
 * No Web Audio, no DOM, no state. Everything is a function of the car.
 */

import { clamp } from '../core/math.js';
import type { Surface } from '../contracts/world.js';
import { ENGINE, TYRES, WIND } from './tuning.js';

/** Normalised 0..1, saturating. */
function unit(value: number, reference: number): number {
  return reference > 0 ? clamp(value / reference, 0, 1) : 0;
}

/**
 * The engine's fundamental, Hz — the firing frequency, not the crank speed.
 *
 * There is no gearbox (the car has no gears by design, ADR-0004), so this
 * rises monotonically with road speed and never drops back. That is a
 * deliberate consequence rather than an oversight: gear changes are events,
 * and this game does not want events.
 */
export function engineHz(rpm: number): number {
  return Math.max((rpm / 60) * ENGINE.FIRINGS_PER_REV, ENGINE.MIN_HZ);
}

/**
 * How hard the engine sounds like it is working, 0..1.
 *
 * Mostly load and a little revs. An engine at 6000 rpm on a closed throttle is
 * much quieter than one at 3000 pulling, and getting that the wrong way round
 * is what makes synthesised engines sound like a dentist's drill.
 */
export function engineEffort(rpm: number, throttle: number, maxRpm: number): number {
  const revs = unit(rpm, maxRpm);
  const load = clamp(throttle, 0, 1);
  return clamp(load * ENGINE.LOAD_WEIGHT + revs * (1 - ENGINE.LOAD_WEIGHT), 0, 1);
}

export function engineGain(effort: number): number {
  return ENGINE.GAIN_IDLE + (ENGINE.GAIN_LOAD - ENGINE.GAIN_IDLE) * clamp(effort, 0, 1);
}

/** Lowpass cutoff, Hz. Opening this is most of what "accelerating" sounds like. */
export function engineCutoffHz(effort: number): number {
  const e = clamp(effort, 0, 1);
  // Exponential, because pitch and brightness are both perceived as ratios.
  return ENGINE.CUTOFF_MIN_HZ * Math.pow(ENGINE.CUTOFF_MAX_HZ / ENGINE.CUTOFF_MIN_HZ, e);
}

/** Wind level. Square law: it is drag, and the ear knows what drag sounds like. */
export function windGain(speedMs: number): number {
  const s = unit(speedMs, WIND.REF_SPEED_MS);
  return WIND.GAIN_MAX * s * s;
}

export function windCentreHz(speedMs: number): number {
  const s = unit(speedMs, WIND.REF_SPEED_MS);
  return WIND.CENTRE_MIN_HZ + (WIND.CENTRE_MAX_HZ - WIND.CENTRE_MIN_HZ) * s;
}

export interface SurfaceVoice {
  readonly gain: number;
  readonly centreHz: number;
  readonly q: number;
}

export function surfaceVoice(surface: Surface): SurfaceVoice {
  switch (surface) {
    case 'gravel':
      return TYRES.GRAVEL;
    case 'grass':
      return TYRES.GRASS;
    case 'tarmac':
      return TYRES.TARMAC;
  }
}

/**
 * Tyre level. Linear in speed rather than square — tyre roar is contact
 * patch noise, and it is already loud at walking pace.
 *
 * `lateralG` adds scrub. This is the only cue the game gives that the car is
 * near the limit, since there is no fail state to discover it with.
 */
export function tyreGain(speedMs: number, surface: Surface, lateralG: number): number {
  const s = unit(speedMs, TYRES.REF_SPEED_MS);
  const scrub = 1 + Math.abs(lateralG) * TYRES.SCRUB_PER_G;
  return TYRES.GAIN_MAX * s * surfaceVoice(surface).gain * scrub;
}
