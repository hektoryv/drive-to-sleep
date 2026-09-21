import { describe, expect, it } from 'vitest';
import {
  biomeForCell,
  biomeWeightsAt,
  dominantBiome,
  makeBiomeWeights,
} from '../src/world/gen/biomes.js';
import { BIOMES } from '../src/world/tuning.js';

describe('biome blending', () => {
  it('is deterministic and normalised over a long drive', () => {
    const a = makeBiomeWeights();
    const b = makeBiomeWeights();
    for (let s = 0; s <= 100_000; s += 137) {
      biomeWeightsAt(s, 17, a);
      biomeWeightsAt(s, 17, b);
      expect(a).toEqual(b);
      expect(a.mountain + a.desert + a.country).toBeCloseTo(1, 10);
      expect(Math.min(a.mountain, a.desert, a.country)).toBeGreaterThanOrEqual(0);
    }
  });

  it('blends from the previous cell into the current one without a boundary jump', () => {
    const before = biomeWeightsAt(BIOMES.CELL_M - 0.01, 3, makeBiomeWeights());
    const after = biomeWeightsAt(BIOMES.CELL_M + 0.01, 3, makeBiomeWeights());
    expect(Math.abs(after.mountain - before.mountain)).toBeLessThan(0.001);
    expect(Math.abs(after.desert - before.desert)).toBeLessThan(0.001);
    expect(Math.abs(after.country - before.country)).toBeLessThan(0.001);
  });

  it('settles on the cell biome after the transition', () => {
    for (let cell = 0; cell < 10; cell++) {
      const weights = biomeWeightsAt(
        cell * BIOMES.CELL_M + BIOMES.BLEND_M + 1,
        9,
        makeBiomeWeights(),
      );
      expect(dominantBiome(weights, 0.5)).toBe(biomeForCell(cell, 9));
    }
  });
});
