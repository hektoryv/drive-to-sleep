import { describe, expect, it } from 'vitest';
import { PLAYER_CAR_LENGTH_M } from '../src/contracts/vehicle.js';
import { scaleForPlayerCar } from '../src/cockpit/model-scale.js';

describe('cockpit model scale', () => {
  it('normalises any source unit to the physical 4.291 m car length', () => {
    const sourceLength = 0.04391;
    expect(sourceLength * scaleForPlayerCar(sourceLength)).toBeCloseTo(PLAYER_CAR_LENGTH_M, 12);
  });

  it('rejects a model with no measurable length', () => {
    expect(() => scaleForPlayerCar(0)).toThrow(/invalid source length/i);
  });
});
