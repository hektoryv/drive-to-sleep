/**
 * Sound constants. Owned by the `audio` domain.
 *
 * Every number here shapes what the car *sounds* like, and like the handling
 * constants in `sim/tuning.ts` each carries a note saying which direction
 * makes it more of something. Sound is tuned by memory even more than
 * handling is — you cannot see it in a screenshot, and you cannot hold two
 * versions of it in your head at once.
 *
 * Pure data. Imports nothing, touches nothing.
 */

/** Everything is scaled by this. The game is meant to be calming. */
export const MASTER = {
  /** Overall level, 0–1. Higher = louder relative to the rest of the phone. */
  GAIN: 0.5,
  /** Seconds to fade in from silence, and out again on pause. */
  FADE_S: 0.35,
  /**
   * Time constant for every parameter that follows the car, seconds. This is
   * the single most important number in the file: too low and the engine
   * zippers as the note steps, too high and lifting off takes a moment to be
   * heard and the car feels disconnected from the thumb.
   */
  FOLLOW_S: 0.045,
} as const;

/**
 * The engine.
 *
 * Synthesised, not sampled — a sample would be a megabyte of somebody else's
 * car, would need a licence, and could not follow the revs without a whole
 * crossfading playback engine. Oscillators cost nothing and bend perfectly.
 */
export const ENGINE = {
  /**
   * Power strokes per revolution. A flat six fires three times per two
   * revolutions of the crank, so the fundamental is rpm/60 × 1.5. Raising it
   * makes the engine sound like it has more cylinders.
   */
  FIRINGS_PER_REV: 1.5,
  /** Floor on the fundamental, Hz. Below ~30 Hz a phone speaker renders nothing. */
  MIN_HZ: 28,

  /**
   * The three voices, as multiples of the firing frequency, with their
   * relative levels. The half-order sub is what gives it weight on a speaker
   * too small to reproduce the fundamental.
   */
  SUB_RATIO: 0.5,
  SUB_GAIN: 0.55,
  BODY_GAIN: 1.0,
  HARMONIC_RATIO: 2.02,
  HARMONIC_GAIN: 0.38,
  /** Detune on the body voice, cents. Higher = rougher, more mechanical. */
  DETUNE_CENTS: 11,

  /** Level at idle with a closed throttle, and at full load. */
  GAIN_IDLE: 0.055,
  GAIN_LOAD: 0.2,
  /**
   * How much of the level comes from load rather than revs, 0–1. High values
   * mean the car goes quiet the moment you lift, which is most of what makes
   * an engine sound like it is being driven rather than played back.
   */
  LOAD_WEIGHT: 0.62,

  /** Lowpass cutoff, Hz, closed throttle at idle and wide open at the limit. */
  CUTOFF_MIN_HZ: 240,
  CUTOFF_MAX_HZ: 2100,
  /** Resonance at the cutoff. Higher = more of a hard edge as it opens up. */
  CUTOFF_Q: 1.6,
} as const;

/**
 * Wind. Rises with the square of speed, because that is what drag does and
 * the ear is very good at knowing when it doesn't.
 */
export const WIND = {
  /** Speed, m/s, at which wind reaches full level. */
  REF_SPEED_MS: 190 / 3.6,
  /** Level at that speed. Higher = more motorway, less country lane. */
  GAIN_MAX: 0.14,
  /** Bandpass centre at a standstill and at the reference speed, Hz. */
  CENTRE_MIN_HZ: 320,
  CENTRE_MAX_HZ: 1150,
  /** Bandwidth. Lower Q = broader, more like air and less like a whistle. */
  Q: 0.55,
} as const;

/** Tyres on the road. The channel that says what you are driving on. */
export const TYRES = {
  REF_SPEED_MS: 140 / 3.6,
  GAIN_MAX: 0.1,
  /** Per-surface level multiplier and filter centre, Hz. */
  TARMAC: { gain: 1.0, centreHz: 620, q: 0.9 },
  /** Gravel is louder and much brighter — it is the sound of being off line. */
  GRAVEL: { gain: 2.1, centreHz: 1650, q: 0.6 },
  /** Grass is loud but dull: a rush rather than a rattle. */
  GRASS: { gain: 1.7, centreHz: 420, q: 0.5 },
  /**
   * Extra level per g of lateral acceleration — the tyres scrubbing. Higher =
   * a more vocal warning that you are near the limit, which is the only
   * warning the game gives.
   */
  SCRUB_PER_G: 0.85,
  /** Seconds to cross from one surface's filter to the next. */
  SURFACE_BLEND_S: 0.12,
} as const;

/** The noise source both wind and tyres are filtered out of. */
export const NOISE = {
  /** Seconds of buffer, generated once at startup and looped forever. */
  BUFFER_S: 3,
} as const;
