import { describe, expect, it } from 'vitest';
import { chevronPlacement, needsChevrons } from '../src/world/gen/signage.js';
import { ROADSIDE } from '../src/world/tuning.js';

/** Positive curvature turns right — see world/gen/stations.ts. */
const RIGHT_HAND_BEND = 1 / 60;
const LEFT_HAND_BEND = -1 / 60;

describe('chevron placement', () => {
  it('puts the sign on the outside of the bend', () => {
    // The outside is where you end up if you get it wrong, and it is the only
    // side that stays in view all the way through the corner.
    expect(chevronPlacement(RIGHT_HAND_BEND).side).toBe(-1);
    expect(chevronPlacement(LEFT_HAND_BEND).side).toBe(1);
  });

  it('points the arrows into the bend', () => {
    // This was wrong first time round and every sign pointed out of its
    // corner, which is worse than having no signs at all.
    expect(chevronPlacement(RIGHT_HAND_BEND).turn).toBe(1);
    expect(chevronPlacement(LEFT_HAND_BEND).turn).toBe(-1);
  });

  it('never puts the sign on the side it is pointing', () => {
    for (let k = -0.05; k <= 0.05; k += 0.001) {
      const { side, turn } = chevronPlacement(k);
      expect(side).toBe(-turn);
    }
  });

  it('warns about tight corners and stays quiet about the rest', () => {
    // A sign on every bend is a sign on no bend.
    const tight = ROADSIDE.CHEVRON_MIN_CURVATURE * 1.5;
    const gentle = ROADSIDE.CHEVRON_MIN_CURVATURE * 0.5;
    expect(needsChevrons(tight)).toBe(true);
    expect(needsChevrons(-tight)).toBe(true);
    expect(needsChevrons(gentle)).toBe(false);
    expect(needsChevrons(0)).toBe(false);
  });

  it('is symmetric — a left bend is warned about exactly as a right one is', () => {
    for (let k = 0; k <= 0.05; k += 0.001) {
      expect(needsChevrons(k)).toBe(needsChevrons(-k));
    }
  });
});
