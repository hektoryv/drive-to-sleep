/**
 * Terrain height, as a function of road coordinates rather than world
 * coordinates.
 *
 * Working in `(s, t)` rather than `(x, z)` is what makes the terrain meet the
 * road exactly: near the road the height *is* the road's height, and relief
 * only fades in beyond the verge. Generating a world-space heightfield and
 * then trying to cut a road into it is the version of this that produces
 * hills poking through the tarmac.
 *
 * Pure. No three.js, no DOM.
 */

import { smoothstep } from '../../core/math.js';
import { fbm2 } from '../../core/rng.js';
import { TERRAIN } from '../tuning.js';

const SEED_TERRAIN = 24593;

/** Height of the verge relative to the road surface, metres. */
export const VERGE_DROP_M = 0.45;

/**
 * Terrain height at road coordinates `(s, t)`, given the road's own height
 * there.
 *
 * Held flat out to `FLAT_MARGIN_M` either side, then relief blends in over
 * `BLEND_M`. The road mesh uses this same function for its outer verge
 * vertices, so the two meshes meet by construction rather than by agreement.
 */
export function terrainHeightAt(s: number, t: number, roadY: number, seed: number): number {
  const base = roadY - VERGE_DROP_M;
  const distance = Math.abs(t);
  const blend = smoothstep((distance - TERRAIN.FLAT_MARGIN_M) / TERRAIN.BLEND_M);
  if (blend <= 0) return base;
  const relief = fbm2(s / TERRAIN.RELIEF_SCALE_M, t / TERRAIN.RELIEF_SCALE_M, seed + SEED_TERRAIN, {
    octaves: 4,
    lacunarity: 2.1,
    gain: 0.5,
  });
  return base + relief * TERRAIN.RELIEF_M * blend;
}
