/** Deterministic biome selection and kilometre-scale blending. Pure. */

import { hash01 } from '../../core/rng.js';
import { smootherstep } from '../../core/math.js';
import { BIOMES } from '../tuning.js';

export type Biome = 0 | 1 | 2;

export interface BiomeWeights {
  mountain: number;
  desert: number;
  country: number;
}

export function makeBiomeWeights(): BiomeWeights {
  return { mountain: 0, desert: 0, country: 1 };
}

/** A cell may repeat its neighbour; that produces a naturally longer region. */
export function biomeForCell(cell: number, seed: number): Biome {
  return Math.floor(hash01(cell, seed + 4409) * 3) as Biome;
}

/** Fills `out` without allocation. Adjacent cells blend over BIOMES.BLEND_M. */
export function biomeWeightsAt(s: number, seed: number, out: BiomeWeights): BiomeWeights {
  const cell = Math.floor(s / BIOMES.CELL_M);
  const localM = s - cell * BIOMES.CELL_M;
  const previous = biomeForCell(cell - 1, seed);
  const current = biomeForCell(cell, seed);
  const t = smootherstep(Math.max(0, Math.min(1, localM / BIOMES.BLEND_M)));

  out.mountain = 0;
  out.desert = 0;
  out.country = 0;
  add(out, previous, 1 - t);
  add(out, current, t);
  return out;
}

function add(out: BiomeWeights, biome: Biome, weight: number): void {
  if (biome === 0) out.mountain += weight;
  else if (biome === 1) out.desert += weight;
  else out.country += weight;
}

export function dominantBiome(weights: Readonly<BiomeWeights>, roll: number): Biome {
  if (roll < weights.mountain) return 0;
  if (roll < weights.mountain + weights.desert) return 1;
  return 2;
}
