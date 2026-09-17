/**
 * The `RoadQuery` implementation — the world's entire public surface.
 *
 * Everything outside `world/` reaches the road through this interface and
 * nothing else, so how the road is generated, stored and meshed can change
 * completely without any other domain noticing (ADR-0011).
 *
 * Pure. No three.js, no DOM.
 */

import type { RoadQuery, RoadSample, Surface } from '../../contracts/world.js';
import { ROAD } from '../tuning.js';
import {
  createStations,
  ensureUpTo,
  sampleAt,
  toRoadSpace,
  type Stations,
} from './stations.js';

export interface WorldRoad extends RoadQuery {
  /** The station store, for the mesh builders inside `world/`. Not a contract. */
  readonly stations: Stations;
}

export function createRoad(seed: number): WorldRoad {
  const stations = createStations(seed);
  const scratchSample = {
    s: 0,
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    curvature: 0,
    grade: 0,
    bank: 0,
    halfWidth: ROAD.HALF_WIDTH_M,
  };

  // Station 0 must exist before anything can query the road.
  ensureUpTo(stations, 0);

  return {
    stations,

    sampleAt(s: number, out: RoadSample): RoadSample {
      return sampleAt(stations, s, out);
    },

    headingAt(s: number): number {
      return sampleAt(stations, s, scratchSample).heading;
    },

    surfaceAt(s: number, t: number): Surface {
      const halfWidth = sampleAt(stations, s, scratchSample).halfWidth;
      const distance = Math.abs(t);
      if (distance <= halfWidth) return 'tarmac';
      if (distance <= halfWidth + ROAD.SHOULDER_M) return 'gravel';
      return 'grass';
    },

    toRoadSpace(x: number, z: number, nearS: number, out: { s: number; t: number }): void {
      toRoadSpace(stations, x, z, nearS, out);
    },

    ensureSpan(s: number): void {
      // Generate out to the far edge of the live window. Everything behind
      // falls out of the ring buffer on its own as new stations overwrite it.
      const ahead = ROAD.CHUNKS_AHEAD * ROAD.STATIONS_PER_CHUNK * ROAD.STATION_SPACING_M;
      ensureUpTo(stations, Math.ceil((s + ahead) / ROAD.STATION_SPACING_M));
    },
  };
}
