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
const SEED_CRAG = 51059;
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
  const firstFaceEnd = LANDFORMS.BREAK_START_M + LANDFORMS.WALL_FACE_ONE_BLEND_M;
  const secondFaceStart = firstFaceEnd + LANDFORMS.WALL_LEDGE_M;
  const secondFaceEnd = secondFaceStart + LANDFORMS.WALL_FACE_TWO_BLEND_M;
  const wallFaceOne = smoothstep(
    (distance - LANDFORMS.BREAK_START_M) / LANDFORMS.WALL_FACE_ONE_BLEND_M,
  );
  const wallFaceTwo = smoothstep(
    (distance - secondFaceStart) / LANDFORMS.WALL_FACE_TWO_BLEND_M,
  );
  const wallFar = smoothstep(
    (distance - secondFaceEnd) / (TERRAIN.WIDTH_M - secondFaceEnd),
  );
  const wallProfile =
    wallFaceOne * LANDFORMS.WALL_FACE_ONE_SHARE +
    wallFaceTwo * LANDFORMS.WALL_FACE_TWO_SHARE +
    wallFar * (1 - LANDFORMS.WALL_FACE_ONE_SHARE - LANDFORMS.WALL_FACE_TWO_SHARE);
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
  const cragFade =
    smoothstep((distance - LANDFORMS.BREAK_START_M) / 7) *
    (1 -
      smoothstep(
        (distance - LANDFORMS.CRAG_FADE_START_M) / LANDFORMS.CRAG_FADE_M,
      ));
  const cragAmplitude =
    biome.mountain * LANDFORMS.CRAG_MOUNTAIN_M +
    biome.desert * LANDFORMS.CRAG_DESERT_M +
    biome.country * LANDFORMS.CRAG_COUNTRY_M;
  const crag = fbm2(
    s / LANDFORMS.CRAG_SCALE_ALONG_M,
    distance / LANDFORMS.CRAG_SCALE_ACROSS_M,
    seed + SEED_CRAG + (left ? 0 : 1),
    { octaves: 3, lacunarity: 2.15, gain: 0.46 },
  );
  const cragDetail = riseM > 0 ? crag * cragAmplitude * cragFade * landscape.intensity : 0;

  return (
    base +
    (relief * TERRAIN.RELIEF_M + sideRelief * sideReliefM) * blend +
    (riseM * wallProfile - dropM * dropProfile) * macroScale +
    cragDetail
  );
}
