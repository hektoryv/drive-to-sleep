/**
 * Cabin geometry and colour. Owned by the `cockpit` domain.
 *
 * Every length is in metres, in the **driver's eye frame**: x to the right,
 * y up, z backward, so the road is at negative z. The eye is the origin
 * because that is the one point the whole cabin is composed around — where
 * things sit relative to your head is what decides whether you are sitting
 * in a car or looking at a picture of one.
 *
 * No badges, no model names, no marques (non-negotiable 7). It is a 1970s
 * sports car, and every shape here is generic to the period.
 */

import { DEG } from '../core/math.js';

/**
 * Where the cabin sits relative to the eye. The eye is left of centre in a
 * left-hand-drive car (`render/tuning.ts` EYE_LATERAL), so the cabin's own
 * centreline is to the right of it by the same amount.
 */
export const CABIN = {
  /** Offset from the eye to the car's centreline, metres. */
  CENTRE_X: 0.36,
} as const;

/** The dash top: the wide shelf under the windscreen. */
export const DASH = {
  /** Far wider than the frame. A cabin you can see the end of is a prop. */
  WIDTH_M: 4.0,
  /**
   * Forward and back extent. Bounded by the wheel: the dash's rear face has
   * to stay in front of the rim, or the mass swallows the wheel — which is
   * exactly what happened the first time it was made deeper.
   */
  DEPTH_M: 0.34,
  /** Height of the top surface below the eye. Higher = more enclosed. */
  DROP_M: 0.5,
  /** How far forward the front edge is, metres. */
  FRONT_Z: -1.0,
  /** How far the mass drops below its top edge. Deep enough to leave frame. */
  FACE_M: 2.0,
  /** Rake of the top surface — the far edge sits lower, as a real dash does. */
  RAKE: 7 * DEG,
} as const;

/**
 * The instrument binnacle: the hooded pod carrying the dials, sitting behind
 * the wheel. Shallow on purpose (`render/tuning.ts` DASH_FRACTION) — the dials
 * are allowed to overlap the top of the wheel rather than take a band of their
 * own.
 */
export const BINNACLE = {
  WIDTH_M: 0.62,
  HEIGHT_M: 0.2,
  DEPTH_M: 0.2,
  /** Centre height below the eye. */
  DROP_M: 0.46,
  Z: -0.72,
  /** How far the hood overhangs the dials. Higher = deeper shadow, more 911. */
  HOOD_M: 0.07,
} as const;

/**
 * The wheel. Thin rim, three spokes, and it turns with the finger — that is
 * the whole point (the opening brief, and ADR-0004).
 */
export const WHEEL = {
  RIM_RADIUS_M: 0.165,
  RIM_THICKNESS_M: 0.0135,
  /** Centre position relative to the eye. */
  DROP_M: 0.52,
  Z: -0.46,
  /** Rake of the column. A 70s car's wheel is close to vertical. */
  RAKE: 22 * DEG,
  SPOKES: 3,
  SPOKE_WIDTH_M: 0.019,
  SPOKE_THICKNESS_M: 0.007,
  HUB_RADIUS_M: 0.038,
  HUB_DEPTH_M: 0.022,
  /**
   * How far the wheel turns for full lock, as a multiple of the road wheel
   * angle. A real rack is about 14:1; this is the visible ratio, and higher
   * means more theatre at the same steering input.
   */
  TURNS_PER_STEER: 5.2,
} as const;

/**
 * Colour. Red interior per ADR-0014 — the art target's car is red inside, and
 * a black cabin would make the bottom half of a portrait screen a dead zone.
 */
export const CABIN_COLOURS = {
  /** The main upholstered surfaces. */
  LEATHER: 0x7d1f22,
  /** Shadowed sides and the underside of the hood. */
  LEATHER_DARK: 0x3d0f12,
  /** Crackle-black instrument surround and the binnacle face. */
  INSTRUMENT: 0x17151a,
  /** The wheel rim — a darker leather than the dash. */
  RIM: 0x2a1416,
  /** Spokes and hub: brushed alloy, the one cool tone in the cabin. */
  ALLOY: 0x8c8a90,
} as const;

/**
 * Cabin lighting. Fixed, not driven by the sky — yet. The day cycle reaching
 * in here needs a contract that does not exist, and inventing one before the
 * cabin is drawn would be designing the seam before knowing its shape.
 */
export const CABIN_LIGHT = {
  /** Key direction in the eye frame: from the windscreen, slightly above. */
  KEY: [0.25, 0.62, -0.74] as const,
  KEY_STRENGTH: 0.85,
  AMBIENT: 0.42,
} as const;
