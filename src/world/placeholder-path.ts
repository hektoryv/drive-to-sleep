/**
 * PHASE 0 PLACEHOLDER — deleted in Phase 1.
 *
 * A curving centreline with a closed form, so the camera look-ahead rig has
 * something to actually look ahead *at* before the real road generator exists.
 *
 * Closed form matters here: the ground shader evaluates the same path per
 * pixel to draw the road band, and it cannot integrate a heading field the way
 * the real generator will. Two sine components give a road with a long sweeper
 * and a shorter kink riding on it — enough shape to judge a camera by.
 *
 * Pure. No three.js, no DOM.
 */

/** Long sweeper: amplitude in metres, and its angular wavenumber. */
export const PATH_A1 = 70;
export const PATH_K1 = (Math.PI * 2) / 1100;
/** Shorter kink riding on top of it. */
export const PATH_A2 = 18;
export const PATH_K2 = (Math.PI * 2) / 320;
export const PATH_PHASE = 1.7;

/** Lateral position of the centreline at distance `s` along the road, metres. */
export function pathX(s: number): number {
  return PATH_A1 * Math.sin(PATH_K1 * s) + PATH_A2 * Math.sin(PATH_K2 * s + PATH_PHASE);
}

/** d(lateral)/d(distance) — the road's slope in plan view. */
export function pathSlope(s: number): number {
  return (
    PATH_A1 * PATH_K1 * Math.cos(PATH_K1 * s) +
    PATH_A2 * PATH_K2 * Math.cos(PATH_K2 * s + PATH_PHASE)
  );
}

/**
 * Heading at distance `s`, in the renderer's convention: yaw about +Y, with
 * zero looking down -Z.
 *
 * `s` is treated as distance along -Z rather than true arc length. At the
 * slopes this path produces that is a sub-1% error, and the real generator
 * integrates properly anyway.
 */
export function pathHeading(s: number): number {
  return -Math.atan(pathSlope(s));
}
