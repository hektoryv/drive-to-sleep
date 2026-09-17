/**
 * Road events — hand-authored shapes injected on top of the noise.
 *
 * This is the anti-monotony mechanism, and per the roadmap it is the
 * highest-leverage place in the whole generator to spend tuning time. Pure
 * noise gives a road with no rhythm: an endless succession of medium corners,
 * nothing to anticipate, nothing to remember. Events give it punctuation — a
 * hairpin, a long sweeper you can lean on, a crest you come over, a straight
 * that lets the view open up.
 *
 * Pure functions of `(seed, s)`, like everything in `gen/`. An event's identity
 * comes from its index, its index comes from arithmetic on `s`, so events can
 * be evaluated at any distance without walking there.
 */

import { smoothstep } from '../../core/math.js';
import { hash01 } from '../../core/rng.js';
import { EVENTS, ROAD } from '../tuning.js';

export type EventKind = 'hairpin' | 'sweeper' | 'crest' | 'dip' | 'straight';

export interface RoadEvent {
  kind: EventKind;
  /** Where it starts, metres. */
  s0: number;
  /** How long it lasts, metres. */
  length: number;
  /** -1 or +1. Which way it bends, or whether it rises or falls. */
  sign: number;
  /** 0..1 scaling on the event's nominal strength. */
  strength: number;
}

/** Seed offsets so an event's properties don't correlate with each other. */
const S_KIND = 3301;
const S_JITTER = 6607;
const S_SIGN = 9241;
const S_STRENGTH = 12289;
const S_LENGTH = 15013;

/**
 * Relative frequencies. Straights are common on purpose: the point of a
 * straight is to make the next corner feel like something, and they are also
 * where the landscape gets to be the subject rather than the road.
 */
const KIND_WEIGHTS: Array<[EventKind, number]> = [
  ['straight', 0.3],
  ['sweeper', 0.28],
  ['crest', 0.16],
  ['hairpin', 0.14],
  ['dip', 0.12],
];

/** Nominal length range per kind, metres. */
const KIND_LENGTH: Record<EventKind, [number, number]> = {
  hairpin: [55, 95],
  sweeper: [240, 420],
  crest: [90, 150],
  dip: [90, 150],
  straight: [180, 340],
};

/**
 * Peak curvature contribution per kind, as a multiple of the noise amplitude.
 * A hairpin at 3.4× the noise amplitude is roughly a 75 m radius.
 */
const KIND_CURVATURE: Record<EventKind, number> = {
  hairpin: 3.4,
  sweeper: 1.25,
  crest: 0,
  dip: 0,
  straight: 0,
};

/** Peak grade contribution per kind, as a multiple of the noise amplitude. */
const KIND_GRADE: Record<EventKind, number> = {
  hairpin: 0,
  sweeper: 0,
  crest: 1.6,
  dip: 1.4,
  straight: 0,
};

function pickKind(index: number, seed: number): EventKind {
  let r = hash01(index, seed + S_KIND);
  for (const [kind, weight] of KIND_WEIGHTS) {
    if (r < weight) return kind;
    r -= weight;
  }
  return 'sweeper';
}

/** The event occupying slot `index`. Deterministic and side-effect free. */
export function eventAt(index: number, seed: number): RoadEvent {
  const kind = pickKind(index, seed);
  const jitter = (hash01(index, seed + S_JITTER) - 0.5) * EVENTS.SPACING_JITTER_M;
  const [minLen, maxLen] = KIND_LENGTH[kind];
  const length = minLen + hash01(index, seed + S_LENGTH) * (maxLen - minLen);
  return {
    kind,
    s0: index * EVENTS.SPACING_M + jitter,
    length,
    sign: hash01(index, seed + S_SIGN) < 0.5 ? -1 : 1,
    strength: 0.65 + hash01(index, seed + S_STRENGTH) * 0.35,
  };
}

/**
 * How far through an event distance `s` is, as a 0..1 envelope that rises from
 * nothing, holds, and falls back — so an event blends into the surrounding
 * noise instead of starting with a kink.
 */
function envelope(event: RoadEvent, s: number): number {
  const start = event.s0 - EVENTS.BLEND_M;
  const end = event.s0 + event.length + EVENTS.BLEND_M;
  if (s <= start || s >= end) return 0;
  const rise = smoothstep((s - start) / EVENTS.BLEND_M);
  const fall = smoothstep((end - s) / EVENTS.BLEND_M);
  return Math.min(rise, fall);
}

/**
 * The shape of an event across its own span, -1..1.
 *
 * A hairpin is a single hard arc. A sweeper holds a constant radius, which is
 * what makes it something you can settle into. Crests and dips are one smooth
 * hump, and get their sign from the caller.
 */
function shape(event: RoadEvent, s: number): number {
  const u = (s - event.s0) / event.length;
  if (u < 0 || u > 1) return 0;
  switch (event.kind) {
    case 'hairpin':
      // A tight peak in the middle — turn in, apex, unwind.
      return Math.sin(Math.PI * u);
    case 'sweeper':
      // Flat-topped: constant radius through the middle, eased at the ends.
      return smoothstep(u * 3) * smoothstep((1 - u) * 3);
    case 'crest':
    case 'dip':
      return Math.sin(Math.PI * u);
    case 'straight':
      return 0;
  }
}

/**
 * Which event slots could possibly influence distance `s`.
 *
 * Slots are `EVENTS.SPACING_M` apart, an event can be jittered by half that
 * and can run several hundred metres, so a small fixed window either side is
 * enough — and it keeps this O(1) rather than a scan.
 */
const SLOT_WINDOW = 2;

function forEachNearbyEvent(s: number, seed: number, fn: (e: RoadEvent) => void): void {
  const centre = Math.floor(s / EVENTS.SPACING_M);
  for (let i = centre - SLOT_WINDOW; i <= centre + SLOT_WINDOW; i++) {
    fn(eventAt(i, seed));
  }
}

/** Summed curvature contribution of every event overlapping `s`, in 1/metres. */
export function curvatureFromEvents(s: number, seed: number): number {
  let total = 0;
  forEachNearbyEvent(s, seed, (e) => {
    const peak = KIND_CURVATURE[e.kind];
    if (peak === 0) return;
    total += shape(e, s) * envelope(e, s) * peak * e.strength * e.sign * ROAD.CURVATURE_AMPLITUDE;
  });
  return total;
}

/** Summed grade contribution of every event overlapping `s`. */
export function gradeFromEvents(s: number, seed: number): number {
  let total = 0;
  forEachNearbyEvent(s, seed, (e) => {
    const peak = KIND_GRADE[e.kind];
    if (peak === 0) return;
    // A crest rises then falls; a dip does the reverse. Both read as a single
    // hump in the road, which is why the grade contribution is a derivative
    // shape rather than the hump itself.
    const direction = e.kind === 'crest' ? 1 : -1;
    const u = (s - e.s0) / e.length;
    const slope = Math.cos(Math.PI * u) * Math.PI;
    total += slope * envelope(e, s) * peak * e.strength * direction * ROAD.GRADE_AMPLITUDE * 0.3;
  });
  return total;
}

/**
 * 1 where the noise curvature applies in full, falling toward 0 inside a
 * straight. Multiplied into the base curvature, so a straight is actually
 * straight rather than just calmer than average.
 */
export function straightnessAt(s: number, seed: number): number {
  let suppression = 0;
  forEachNearbyEvent(s, seed, (e) => {
    if (e.kind !== 'straight') return;
    suppression = Math.max(suppression, envelope(e, s) * e.strength);
  });
  return 1 - suppression * 0.92;
}
