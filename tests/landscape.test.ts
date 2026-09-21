import { describe, expect, it } from 'vitest';
import {
  landscapeAt,
  makeLandscapeSample,
} from '../src/world/gen/landscape.js';
import { terrainHeightAt } from '../src/world/gen/terrain.js';
import { LANDFORMS } from '../src/world/tuning.js';

describe('landscape composition', () => {
  it('is deterministic and strongly asymmetric at feature centres', () => {
    const a = makeLandscapeSample();
    const b = makeLandscapeSample();
    for (let cell = 0; cell < 60; cell++) {
      const s = (cell + 0.5) * LANDFORMS.CELL_M;
      landscapeAt(s, 17, a);
      landscapeAt(s, 17, b);
      expect(a).toEqual(b);
      expect(a.intensity).toBeCloseTo(1, 10);

      const left = a.leftRiseM - a.leftDropM;
      const right = a.rightRiseM - a.rightDropM;
      expect(Math.abs(left - right)).toBeGreaterThan(10);
    }
  });

  it('puts lakes only in mountain and country cells', () => {
    const out = makeLandscapeSample();
    let lakes = 0;
    for (let seed = 1; seed <= 8; seed++) {
      for (let cell = 0; cell < 80; cell++) {
        landscapeAt((cell + 0.5) * LANDFORMS.CELL_M, seed, out);
        if (out.leftLake <= 0 && out.rightLake <= 0) continue;
        lakes++;
        expect(out.biome).not.toBe(1);
      }
    }
    expect(lakes).toBeGreaterThan(40);
  });

  it('fades categorical scenes to neutral ground at cell boundaries', () => {
    for (let cell = 1; cell < 30; cell++) {
      const boundary = cell * LANDFORMS.CELL_M;
      for (const t of [-120, 120]) {
        const before = terrainHeightAt(boundary - 0.05, t, 0, 5);
        const after = terrainHeightAt(boundary + 0.05, t, 0, 5);
        expect(Math.abs(after - before)).toBeLessThan(0.2);
      }
    }
  });

  it('keeps the road join calm while producing substantial 3D relief nearby', () => {
    const out = makeLandscapeSample();
    let sawRelief = false;
    for (let cell = 0; cell < 40; cell++) {
      const s = (cell + 0.5) * LANDFORMS.CELL_M;
      landscapeAt(s, 9, out);
      expect(terrainHeightAt(s, 6, 20, 9)).toBeCloseTo(19.55, 8);
      const left = terrainHeightAt(s, -120, 20, 9);
      const right = terrainHeightAt(s, 120, 20, 9);
      if (Math.abs(left - right) > 35) sawRelief = true;
    }
    expect(sawRelief).toBe(true);
  });
});
