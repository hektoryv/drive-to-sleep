import { PLAYER_CAR_LENGTH_M } from '../contracts/vehicle.js';

/** Returns the uniform scale that makes the imported car exactly 4.291 m long. */
export function scaleForPlayerCar(sourceLength: number): number {
  if (!Number.isFinite(sourceLength) || sourceLength <= 0) {
    throw new Error(`Cockpit model has an invalid source length: ${sourceLength}`);
  }
  return PLAYER_CAR_LENGTH_M / sourceLength;
}
