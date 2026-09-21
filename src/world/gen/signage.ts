/**
 * Where roadside signs go, and which way they face.
 *
 * Pure, and in `gen/` rather than `view/` on purpose. Deciding that a corner
 * warrants a warning and which side of the road it belongs on is a fact about
 * the road, not about how it is drawn — and it is a fact that can be got
 * backwards silently, which makes it exactly the sort of thing that should be
 * a tested function rather than two lines inside a mesh builder.
 *
 * It was got backwards, first time. Every sign pointed out of its corner
 * instead of into it, which is worse than having no signs at all.
 */

import { ROADSIDE } from '../tuning.js';

/** -1 is left of the centreline, +1 is right. Matches `CarView.lateralM`. */
export type Side = -1 | 1;

export interface ChevronPlacement {
  /** Which side of the road the sign stands on. Always the outside of the bend. */
  side: Side;
  /** Which way the arrows point. Always into the bend, so always the inside. */
  turn: Side;
}

/**
 * Whether this corner is tight enough to be worth warning about.
 *
 * A sign on every bend is a sign on no bend: the player stops reading them,
 * and the one place they would have mattered goes unnoticed.
 */
export function needsChevrons(curvature: number): boolean {
  return Math.abs(curvature) >= ROADSIDE.CHEVRON_MIN_CURVATURE;
}

/**
 * Positive curvature turns right (`world/gen/stations.ts`).
 *
 * The outside of a right-hand bend is the left, which is where the sign goes —
 * because the outside is where you end up if you get it wrong, and it is also
 * the only place the sign stays in view all the way through the corner. The
 * arrows point the other way, into the bend, showing the way the road goes.
 *
 * So `side` and `turn` are always opposite. That is the whole convention, and
 * `tests/signage.test.ts` is where it is pinned down.
 */
export function chevronPlacement(curvature: number): ChevronPlacement {
  const turn: Side = curvature > 0 ? 1 : -1;
  return { side: (-turn) as Side, turn };
}
