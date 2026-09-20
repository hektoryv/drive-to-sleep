/** Layered cockpit sprite composition. Owned by `cockpit/`. */

export const COCKPIT_SPRITES = {
  /** All layers occupy one camera-facing plane one metre ahead of the eye. */
  DISTANCE_M: 1,
  CABIN_FILL: { width: 2, height: 2.3, x: 0, y: -1.96 },
  /** Tall on purpose: the source is landscape art adapted to a portrait view. */
  EXTERIOR: { width: 1.62, height: 3.77, x: 0, y: -0.07 },
  INTERIOR: { width: 1.62, height: 2.4, x: 0, y: -0.72 },
  LIGHTING: { width: 1.62, height: 2.4, x: 0, y: -1.02 },
  WHEEL: { width: 1.5, height: 1.5, x: -0.16, y: -1.75 },
  /** A modest shift preserves look-ahead parallax without skewing the atlas. */
  LOOK_SHIFT_M_PER_RAD: 0.55,
  /** Visible wheel rotation divided by road-wheel rotation. */
  STEERING_RATIO: 5.2,
  LIGHTING_OPACITY_MIN: 0.12,
  LIGHTING_OPACITY_DUSK: 0.28,
  LIGHTING_OPACITY_GLOW: 0.14,
} as const;
