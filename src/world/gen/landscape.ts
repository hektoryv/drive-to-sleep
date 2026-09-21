/**
 * Kilometre-scale landscape composition around the road.
 *
 * Fine noise cannot compose a view: it produces the same rolling sheet on
 * both sides forever. Landscape cells instead describe a deliberate section
 * of road — an exposed shelf, a rock pass, a canyon or a lake valley — and
 * fade to neutral ground at their ends. The left and right parameters are
 * intentionally independent.
 *
 * Pure and allocation-free when the caller reuses its output object.
 */

import { smootherstep } from '../../core/math.js';
import { hash01 } from '../../core/rng.js';
import { BIOMES, LANDFORMS } from '../tuning.js';
import { biomeForCell, type Biome } from './biomes.js';

export interface LandscapeSample {
  cell: number;
  biome: Biome;
  intensity: number;
  leftRiseM: number;
  rightRiseM: number;
  leftDropM: number;
  rightDropM: number;
  leftLake: number;
  rightLake: number;
}

export function makeLandscapeSample(): LandscapeSample {
  return {
    cell: 0,
    biome: 2,
    intensity: 0,
    leftRiseM: 0,
    rightRiseM: 0,
    leftDropM: 0,
    rightDropM: 0,
    leftLake: 0,
    rightLake: 0,
  };
}

/** Fills the large-scale composition at distance `s`. */
export function landscapeAt(s: number, seed: number, out: LandscapeSample): LandscapeSample {
  const cell = Math.floor(s / LANDFORMS.CELL_M);
  const localM = s - cell * LANDFORMS.CELL_M;
  const centreS = (cell + 0.5) * LANDFORMS.CELL_M;
  const biomeCell = Math.floor(centreS / BIOMES.CELL_M);
  const biome = biomeForCell(biomeCell, seed);
  const enter = smootherstep(localM / LANDFORMS.EDGE_BLEND_M);
  const leave = smootherstep((LANDFORMS.CELL_M - localM) / LANDFORMS.EDGE_BLEND_M);
  const intensity = enter * leave;
  const openLeft = hash01(cell, seed + 23801) < 0.5;
  const roll = hash01(cell, seed + 27917);

  out.cell = cell;
  out.biome = biome;
  out.intensity = intensity;
  out.leftRiseM = 0;
  out.rightRiseM = 0;
  out.leftDropM = 0;
  out.rightDropM = 0;
  out.leftLake = 0;
  out.rightLake = 0;

  if (biome === 0) {
    if (roll < LANDFORMS.MOUNTAIN_LAKE_CHANCE) {
      setShelf(
        out,
        openLeft,
        LANDFORMS.MOUNTAIN_DROP_M,
        LANDFORMS.MOUNTAIN_WALL_M,
        true,
      );
    } else if (roll < 0.8) {
      setShelf(
        out,
        openLeft,
        LANDFORMS.MOUNTAIN_DROP_M,
        LANDFORMS.MOUNTAIN_WALL_M,
        false,
      );
    } else {
      // A pass closes in on both sides, but never symmetrically.
      out.leftRiseM = LANDFORMS.MOUNTAIN_PASS_WALL_M * (openLeft ? 0.72 : 1);
      out.rightRiseM = LANDFORMS.MOUNTAIN_PASS_WALL_M * (openLeft ? 1 : 0.72);
    }
  } else if (biome === 1) {
    if (roll < 0.68) {
      // Desert canyon: one wall towers while the other side falls toward the
      // broad floor. It uses the same grammar as a lake shelf without water.
      setShelf(out, openLeft, LANDFORMS.DESERT_DROP_M, LANDFORMS.DESERT_WALL_M, false);
    } else {
      out.leftRiseM = LANDFORMS.DESERT_WALL_M * (openLeft ? 0.58 : 0.94);
      out.rightRiseM = LANDFORMS.DESERT_WALL_M * (openLeft ? 0.94 : 0.58);
    }
  } else if (roll < LANDFORMS.COUNTRY_LAKE_CHANCE) {
    setShelf(out, openLeft, LANDFORMS.COUNTRY_DROP_M, LANDFORMS.COUNTRY_WALL_M, true);
  } else {
    setShelf(out, openLeft, LANDFORMS.COUNTRY_DROP_M * 0.42, LANDFORMS.COUNTRY_WALL_M, false);
  }

  scale(out, intensity);
  return out;
}

function setShelf(
  out: LandscapeSample,
  openLeft: boolean,
  dropM: number,
  wallM: number,
  lake: boolean,
): void {
  if (openLeft) {
    out.leftDropM = dropM;
    out.rightRiseM = wallM;
    out.leftLake = lake ? 1 : 0;
  } else {
    out.rightDropM = dropM;
    out.leftRiseM = wallM;
    out.rightLake = lake ? 1 : 0;
  }
}

function scale(out: LandscapeSample, amount: number): void {
  out.leftRiseM *= amount;
  out.rightRiseM *= amount;
  out.leftDropM *= amount;
  out.rightDropM *= amount;
  out.leftLake *= amount;
  out.rightLake *= amount;
}
