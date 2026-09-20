/**
 * What time of day it is, for anything that is not the sky.
 *
 * The world owns the clock and the palette (`world/gen/daylight.ts`), and it
 * always has: one phase value drives the sun, the fog, the terrain and every
 * colour in the scene, which is what keeps them from drifting apart.
 *
 * This is the seam that lets anything *else* know. The cabin is the first
 * consumer and the reason it exists: an interior lit by a fixed lamp looks
 * wrong the moment the road outside turns orange, and the art target is a car
 * interior lit by a sunset. The dashboard lighting in Phase 4 reads the same
 * values.
 *
 * Plain data. No three.js, so pure modules can read it too.
 */

/** A colour, 0–1 per channel, in sRGB. Authored values, not linear light. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Read-only, and re-used in place every frame like `CarView` — consumers must
 * read what they need during `frame()` rather than keeping the object.
 */
export interface DaylightView {
  /** 0 is midnight, 0.25 dawn, 0.5 noon, 0.75 sunset. Wraps. */
  readonly phase: number;

  /** Unit vector pointing *at* the sun, in world space. */
  readonly sunX: number;
  readonly sunY: number;
  readonly sunZ: number;

  /** The directional light's colour. */
  readonly sunLight: Rgb;
  /** Fill light — the sky's colour, never grey. */
  readonly ambient: Rgb;

  /**
   * 0–1, how much daylight there is. Rises before sunrise and lingers after
   * sunset, because the sky keeps working for a while after the sun stops.
   */
  readonly daylight: number;
  /**
   * 0–1, how much the instruments should be lighting themselves. The inverse
   * of usable daylight, roughly, and the thing the dials read.
   */
  readonly instrumentGlow: number;
}
