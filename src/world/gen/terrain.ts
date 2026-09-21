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
import { LANDFORMS, TERRAIN } from '../tuning.js';
import { biomeWeightsAt, makeBiomeWeights } from './biomes.js';
import { landscapeAt, makeLandscapeSample } from './landscape.js';

const SEED_TERRAIN = 24593;
const SEED_LEFT = 31847;
const SEED_RIGHT = 39041;
const SEED_MACRO = 44771;
const landscape = makeLandscapeSample();
const biome = makeBiomeWeights();

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

  landscapeAt(s, seed, landscape);
  biomeWeightsAt(s, seed, biome);
  const left = t < 0;
  const riseM = left ? landscape.leftRiseM : landscape.rightRiseM;
  const dropM = left ? landscape.leftDropM : landscape.rightDropM;
  const wallNear = smoothstep(
    (distance - LANDFORMS.BREAK_START_M) / LANDFORMS.WALL_BLEND_M,
  );
  const wallFar = smoothstep(
    (distance - LANDFORMS.BREAK_START_M - LANDFORMS.WALL_BLEND_M) /
      (TERRAIN.WIDTH_M - LANDFORMS.BREAK_START_M - LANDFORMS.WALL_BLEND_M),
  );
  const wallProfile =
    wallNear *
    (LANDFORMS.WALL_NEAR_HEIGHT_SHARE +
      (1 - LANDFORMS.WALL_NEAR_HEIGHT_SHARE) * wallFar);
  const dropNear = smoothstep(
    (distance - LANDFORMS.BREAK_START_M) / LANDFORMS.DROP_BLEND_M,
  );
  const dropFar = smoothstep(
    (distance - LANDFORMS.BREAK_START_M - LANDFORMS.DROP_BLEND_M) /
      (TERRAIN.WIDTH_M - LANDFORMS.BREAK_START_M - LANDFORMS.DROP_BLEND_M),
  );
  const dropProfile =
    dropNear *
    (LANDFORMS.DROP_NEAR_HEIGHT_SHARE +
      (1 - LANDFORMS.DROP_NEAR_HEIGHT_SHARE) * dropFar);

  const relief = fbm2(s / TERRAIN.RELIEF_SCALE_M, t / TERRAIN.RELIEF_SCALE_M, seed + SEED_TERRAIN, {
    octaves: 4,
    lacunarity: 2.1,
    gain: 0.5,
  });
  const sideReliefM =
    biome.mountain * LANDFORMS.SIDE_NOISE_MOUNTAIN_M +
    biome.desert * LANDFORMS.SIDE_NOISE_DESERT_M +
    biome.country * LANDFORMS.SIDE_NOISE_COUNTRY_M;
  const sideRelief = fbm2(
    s / LANDFORMS.SIDE_NOISE_SCALE_M,
    distance / LANDFORMS.SIDE_NOISE_SCALE_M,
    seed + (left ? SEED_LEFT : SEED_RIGHT),
    { octaves: 3, lacunarity: 2.05, gain: 0.48 },
  );
  const macro = fbm2(
    s / LANDFORMS.MACRO_NOISE_SCALE_M,
    distance / LANDFORMS.MACRO_NOISE_SCALE_M,
    seed + SEED_MACRO + (left ? 0 : 1),
    { octaves: 2, lacunarity: 2, gain: 0.45 },
  );
  const macroScale = 1 + macro * LANDFORMS.MACRO_VARIATION;

  return (
    base +
    (relief * TERRAIN.RELIEF_M + sideRelief * sideReliefM) * blend +
    (riseM * wallProfile - dropM * dropProfile) * macroScale
  );
}
