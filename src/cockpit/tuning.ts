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
  DEPTH_M: 0.3,
  /** Height of the top surface below the eye. Higher = more enclosed. */
  DROP_M: 0.48,
  /** How far forward the front edge is, metres. */
  FRONT_Z: -1.0,
  /** How far the mass drops below its top edge. Deep enough to leave frame. */
  FACE_M: 1.35,
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
  WIDTH_M: 0.57,
  HEIGHT_M: 0.18,
  DEPTH_M: 0.15,
  /** Centre height below the eye. */
  DROP_M: 0.48,
  Z: -0.7,
  /** How far the hood overhangs the dials. Higher = deeper shadow, more 911. */
  HOOD_M: 0.07,
} as const;

/**
 * The wheel. Thin rim, three spokes, and it turns with the finger — that is
 * the whole point (the opening brief, and ADR-0004).
 */
export const WHEEL = {
  RIM_RADIUS_M: 0.145,
  RIM_THICKNESS_M: 0.0115,
  /** Centre position relative to the eye. */
  DROP_M: 0.5,
  Z: -0.5,
  /** Rake of the column. A 70s car's wheel is close to vertical. */
  RAKE: 22 * DEG,
  SPOKES: 3,
  SPOKE_WIDTH_M: 0.03,
  SPOKE_THICKNESS_M: 0.008,
  HUB_RADIUS_M: 0.04,
  HUB_DEPTH_M: 0.022,
  /**
   * How far the wheel turns for full lock, as a multiple of the road wheel
   * angle. A real rack is about 14:1; this is the visible ratio, and higher
   * means more theatre at the same steering input.
   */
  TURNS_PER_STEER: 5.2,
} as const;

/** Five overlapping instruments, centred on the driver rather than the car. */
export const GAUGES = {
  Y: -0.405,
  Z: -0.59,
  X: [-0.165, -0.085, 0, 0.09, 0.17] as const,
  RADIUS: [0.05, 0.061, 0.072, 0.061, 0.05] as const,
  TICKS: [9, 11, 13, 11, 9] as const,
  START_ANGLE: -2.25,
  SWEEP: 4.5,
  MAX_SPEED_MS: 61.1,
} as const;

/** Broad stage-set pieces that make the phone edges read as a cabin. */
export const TRIM = {
  PILLAR_X: [-0.35, 0.86] as const,
  PILLAR_Y: -0.15,
  PILLAR_Z: -0.58,
  PILLAR_WIDTH_M: 0.045,
  PILLAR_HEIGHT_M: 0.68,
  PILLAR_ANGLE: 19 * DEG,
  SCUTTLE_Y: -0.455,
  SCUTTLE_Z: -0.62,
  SCUTTLE_WIDTH_M: 1.45,
  SCUTTLE_HEIGHT_M: 0.065,
  DOOR_X: [-0.57, 0.93] as const,
  DOOR_Y: -0.72,
  DOOR_Z: -0.42,
} as const;

/**
 * Colour. Red interior per ADR-0014 — the art target's car is red inside, and
 * a black cabin would make the bottom half of a portrait screen a dead zone.
 */
export const CABIN_COLOURS = {
  /** The main upholstered surfaces. */
  LEATHER: 0xa52b30,
  /** Shadowed sides and the underside of the hood. */
  LEATHER_DARK: 0x3d0f12,
  /** Crackle-black instrument surround and the binnacle face. */
  INSTRUMENT: 0x17151a,
  /** Lower dash and door-card vinyl. */
  PANEL: 0x17171d,
  /** The wheel rim — a darker leather than the dash. */
  RIM: 0x2a1416,
  /** Spokes and hub: brushed alloy, the one cool tone in the cabin. */
  ALLOY: 0x8c8a90,
  DIAL: 0x0c0c11,
  MARKING: 0xc6b8bb,
  NEEDLE: 0xe23a2f,
} as const;

/**
 * Cabin lighting. The direction and colours are replaced from DaylightView
 * every frame; these values are the safe startup state before that service is
 * available.
 */
export const CABIN_LIGHT = {
  /** Key direction in the eye frame: from the windscreen, slightly above. */
  KEY: [0.25, 0.62, -0.74] as const,
  KEY_STRENGTH: 0.85,
  AMBIENT: 0.42,
} as const;
