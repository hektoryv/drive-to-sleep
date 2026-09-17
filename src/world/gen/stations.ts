/**
 * The centreline, sampled at fixed intervals — the shared backbone every other
 * part of the world is built on.
 *
 * ## Why this file exists at all
 *
 * `fields.ts` gives curvature and grade as pure functions of distance. But a
 * road's *position* is the integral of its curvature, and an integral is
 * cumulative by nature: you cannot know where the road is at 50 km without
 * having summed up everything before it.
 *
 * So the honest statement of the determinism rule (ADR-0002, refined by
 * ADR-0012) is: the *fields* are pure and evaluable anywhere; the *geometry*
 * is their integral, reconstructible from the seed alone at a cost linear in
 * distance. The game only ever moves forward, so that cost is paid once at
 * startup — integrating 50 km at 4 m spacing is twelve thousand additions.
 *
 * ## Storage
 *
 * A ring buffer of parallel typed arrays. Writing station `i` overwrites
 * station `i - capacity` automatically, so eviction needs no bookkeeping and
 * no allocation ever happens after construction.
 *
 * Positions are `Float64Array`: at 500 km a float32 has a 6 cm resolution,
 * which is visible jitter in road geometry. The values handed to the GPU are
 * rebased near the camera before they become float32 — see `view/`.
 *
 * Pure. No three.js, no DOM.
 */

import { bankAt, curvatureAt, gradeAt, halfWidthAt } from './fields.js';
import { ROAD } from '../tuning.js';
import type { RoadSample } from '../../contracts/world.js';

export interface Stations {
  readonly seed: number;
  readonly spacing: number;
  readonly capacity: number;
  /** Lowest station index still held. Anything below this has been evicted. */
  firstIndex: number;
  /** One past the highest station index generated. */
  nextIndex: number;

  // Parallel arrays, indexed by slot. See `slotOf`.
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly z: Float64Array;
  /**
   * Heading in radians, deliberately *not* wrapped. Letting it run unbounded
   * means consecutive stations never straddle a ±PI discontinuity, so they can
   * be interpolated with a plain lerp. Consumers that need a bounded angle
   * wrap it themselves.
   */
  readonly heading: Float64Array;
  readonly curvature: Float32Array;
  readonly grade: Float32Array;
  readonly bank: Float32Array;
  readonly halfWidth: Float32Array;
}

export function createStations(seed: number): Stations {
  const capacity = (ROAD.CHUNKS_BEHIND + ROAD.CHUNKS_AHEAD + 1) * ROAD.STATIONS_PER_CHUNK;
  return {
    seed,
    spacing: ROAD.STATION_SPACING_M,
    capacity,
    firstIndex: 0,
    nextIndex: 0,
    x: new Float64Array(capacity),
    y: new Float64Array(capacity),
    z: new Float64Array(capacity),
    heading: new Float64Array(capacity),
    curvature: new Float32Array(capacity),
    grade: new Float32Array(capacity),
    bank: new Float32Array(capacity),
    halfWidth: new Float32Array(capacity),
  };
}

/** Station indices are non-negative, so a plain modulo is enough. */
function slotOf(st: Stations, index: number): number {
  return index % st.capacity;
}

/** How much road is currently held, in metres. */
export function liveSpanM(st: Stations): number {
  return (st.nextIndex - st.firstIndex) * st.spacing;
}

/**
 * Integrates forward until station `target` exists.
 *
 * Trapezoidal: the step uses the mean of the old and new headings rather than
 * either endpoint. Midpoint integration roughly squares the error term, which
 * matters over tens of thousands of steps — with the naive version a long
 * drive slowly drifts away from where the curvature field says the road is.
 */
export function ensureUpTo(st: Stations, target: number): void {
  while (st.nextIndex <= target) {
    const i = st.nextIndex;
    const slot = slotOf(st, i);
    const s = i * st.spacing;

    if (i === 0) {
      st.x[slot] = 0;
      st.y[slot] = 0;
      st.z[slot] = 0;
      st.heading[slot] = 0;
    } else {
      const prev = slotOf(st, i - 1);
      const prevS = s - st.spacing;
      const prevHeading = st.heading[prev] ?? 0;

      // Positive curvature turns right. Forward is (-sin h, -cos h), whose
      // right-hand normal is (cos h, -sin h) — so turning right *decreases*
      // the heading angle.
      const curvature = curvatureAt(prevS, st.seed);
      const grade = gradeAt(prevS, st.seed);
      const heading = prevHeading - curvature * st.spacing;
      const mid = (prevHeading + heading) * 0.5;

      // `spacing` is arc length along the 3D road, so the horizontal component
      // shortens as the road steepens. Ignoring this makes hills quietly
      // longer than flat ground, and distance stops meaning distance.
      const horizontal = st.spacing / Math.sqrt(1 + grade * grade);

      st.heading[slot] = heading;
      st.x[slot] = (st.x[prev] ?? 0) - Math.sin(mid) * horizontal;
      st.z[slot] = (st.z[prev] ?? 0) - Math.cos(mid) * horizontal;
      st.y[slot] = (st.y[prev] ?? 0) + grade * horizontal;
    }

    st.curvature[slot] = curvatureAt(s, st.seed);
    st.grade[slot] = gradeAt(s, st.seed);
    st.bank[slot] = bankAt(s, st.seed);
    st.halfWidth[slot] = halfWidthAt(s, st.seed);

    st.nextIndex = i + 1;
    st.firstIndex = Math.max(0, st.nextIndex - st.capacity);
  }
}

/** Whether station `index` is currently held rather than evicted or ungenerated. */
export function hasStation(st: Stations, index: number): boolean {
  return index >= st.firstIndex && index < st.nextIndex;
}

function clampIndex(st: Stations, index: number): number {
  if (index < st.firstIndex) return st.firstIndex;
  if (index >= st.nextIndex) return Math.max(st.firstIndex, st.nextIndex - 1);
  return index;
}

/** Reads one station into `out`. Returns `out`. Allocation-free. */
export function readStation(st: Stations, index: number, out: RoadSample): RoadSample {
  const i = clampIndex(st, index);
  const slot = slotOf(st, i);
  out.s = i * st.spacing;
  out.x = st.x[slot] ?? 0;
  out.y = st.y[slot] ?? 0;
  out.z = st.z[slot] ?? 0;
  out.heading = st.heading[slot] ?? 0;
  out.curvature = st.curvature[slot] ?? 0;
  out.grade = st.grade[slot] ?? 0;
  out.bank = st.bank[slot] ?? 0;
  out.halfWidth = st.halfWidth[slot] ?? ROAD.HALF_WIDTH_M;
  return out;
}

/**
 * Reads the road at an arbitrary distance, interpolating between stations.
 * Returns `out`. Allocation-free.
 */
export function sampleAt(st: Stations, s: number, out: RoadSample): RoadSample {
  const exact = s / st.spacing;
  const i0 = Math.floor(exact);
  const f = exact - i0;

  const a = clampIndex(st, i0);
  const b = clampIndex(st, i0 + 1);
  const sa = slotOf(st, a);
  const sb = slotOf(st, b);
  // If either end was clamped, the pair is degenerate and we hold the endpoint
  // rather than extrapolating off the end of the generated road.
  const t = a === b ? 0 : f;

  out.s = s;
  out.x = lerpAt(st.x, sa, sb, t);
  out.y = lerpAt(st.y, sa, sb, t);
  out.z = lerpAt(st.z, sa, sb, t);
  out.heading = lerpAt(st.heading, sa, sb, t);
  out.curvature = lerpAt(st.curvature, sa, sb, t);
  out.grade = lerpAt(st.grade, sa, sb, t);
  out.bank = lerpAt(st.bank, sa, sb, t);
  out.halfWidth = lerpAt(st.halfWidth, sa, sb, t);
  return out;
}

function lerpAt(arr: Float64Array | Float32Array, a: number, b: number, t: number): number {
  const va = arr[a] ?? 0;
  const vb = arr[b] ?? 0;
  return va + (vb - va) * t;
}

/**
 * Finds road coordinates for a world position, writing `{ s, t }` into `out`.
 *
 * `nearS` is a hint — normally the previous frame's distance. The car moves a
 * few centimetres per step, so a short local scan around the hint is both
 * exact and O(1); searching the whole ring buffer every frame would not be.
 */
const SEARCH_RADIUS_STATIONS = 8;

export function toRoadSpace(
  st: Stations,
  x: number,
  z: number,
  nearS: number,
  out: { s: number; t: number },
): void {
  const hint = clampIndex(st, Math.round(nearS / st.spacing));
  const lo = Math.max(st.firstIndex, hint - SEARCH_RADIUS_STATIONS);
  const hi = Math.min(st.nextIndex - 1, hint + SEARCH_RADIUS_STATIONS);

  let bestIndex = hint;
  let bestDist2 = Infinity;
  for (let i = lo; i <= hi; i++) {
    const slot = slotOf(st, i);
    const dx = x - (st.x[slot] ?? 0);
    const dz = z - (st.z[slot] ?? 0);
    const d2 = dx * dx + dz * dz;
    if (d2 < bestDist2) {
      bestDist2 = d2;
      bestIndex = i;
    }
  }

  const slot = slotOf(st, bestIndex);
  const bx = st.x[slot] ?? 0;
  const bz = st.z[slot] ?? 0;
  const heading = st.heading[slot] ?? 0;

  // Forward and its right-hand normal at the nearest station.
  const fx = -Math.sin(heading);
  const fz = -Math.cos(heading);
  const rx = Math.cos(heading);
  const rz = -Math.sin(heading);

  const dx = x - bx;
  const dz = z - bz;

  // Project onto the local frame: along-track refines s past the station's own
  // distance, across-track is the lateral offset we want.
  out.s = bestIndex * st.spacing + (dx * fx + dz * fz);
  out.t = dx * rx + dz * rz;
}
