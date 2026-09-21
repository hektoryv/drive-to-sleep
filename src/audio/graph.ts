/**
 * The audio graph: three voices and a master fader, built once.
 *
 * Everything is synthesised. There is not a single sample in the game, which
 * is not purity for its own sake — a recorded engine cannot follow the revs
 * without a crossfading playback engine behind it, weighs a megabyte, and is
 * somebody else's car. Oscillators bend perfectly and cost nothing.
 *
 * ```
 *   sub ─┐
 *  body ─┼→ lowpass ──────────┐
 *  harm ─┘                    │
 *                             ├→ master → destination
 *   noise ─┬→ wind bandpass ──┤
 *          └→ tyre bandpass ──┘
 * ```
 *
 * One noise buffer feeds both filtered voices. Nothing is created after
 * startup: `update` only writes AudioParams, so there is no allocation in the
 * hot path and no garbage between frames (non-negotiable 4).
 */

import { ENGINE, MASTER, NOISE, TYRES, WIND } from './tuning.js';
import {
  engineCutoffHz,
  engineEffort,
  engineGain,
  engineHz,
  surfaceVoice,
  tyreGain,
  windCentreHz,
  windGain,
} from './mapping.js';
import type { Surface } from '../contracts/world.js';

/** Everything `update` needs. A subset of `CarView` plus the thumb. */
export interface SoundState {
  readonly rpm: number;
  readonly speedMs: number;
  readonly throttle: number;
  readonly surface: Surface;
  readonly lateralG: number;
}

export interface AudioGraph {
  readonly context: AudioContext;
  /** Pushes the car's state into the graph. Called once per displayed frame. */
  update(state: SoundState, maxRpm: number): void;
  /** Fades the master in or out — used for pause, not for muting a voice. */
  setRunning(running: boolean): void;
  dispose(): void;
}

/**
 * White noise, generated once and looped.
 *
 * Three seconds is long enough that the loop point is not a rhythm and short
 * enough to be trivial memory. It is generated rather than fetched for the
 * same reason as everything else: the game must work with no network and no
 * assets (non-negotiable 8).
 */
function makeNoiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * NOISE.BUFFER_S);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  // Not seeded: this is texture, not world generation, and nothing about the
  // game's determinism depends on which noise came out (ADR-0002 is about the
  // simulation, and the simulation cannot hear).
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function makeNoiseSource(context: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

/**
 * Builds the graph, or returns undefined where there is no Web Audio at all.
 *
 * Headless Chromium in the screenshot harness and Node in the tests are both
 * legitimate places for this to be missing, and neither should fail because
 * the game cannot make a noise it is not going to record anyway.
 */
export function createAudioGraph(): AudioGraph | undefined {
  if (typeof AudioContext === 'undefined') return undefined;

  let context: AudioContext;
  try {
    context = new AudioContext({ latencyHint: 'interactive' });
  } catch {
    return undefined;
  }

  const master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);

  // --- engine ------------------------------------------------------------

  const engineFilter = context.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = ENGINE.CUTOFF_MIN_HZ;
  engineFilter.Q.value = ENGINE.CUTOFF_Q;

  const engineLevel = context.createGain();
  engineLevel.gain.value = ENGINE.GAIN_IDLE;
  engineFilter.connect(engineLevel).connect(master);

  function voice(type: OscillatorType, gain: number, detune = 0): OscillatorNode {
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = ENGINE.MIN_HZ;
    osc.detune.value = detune;
    const level = context.createGain();
    level.gain.value = gain;
    osc.connect(level).connect(engineFilter);
    osc.start();
    return osc;
  }

  const sub = voice('triangle', ENGINE.SUB_GAIN);
  const body = voice('sawtooth', ENGINE.BODY_GAIN, ENGINE.DETUNE_CENTS);
  const harmonic = voice('sawtooth', ENGINE.HARMONIC_GAIN, -ENGINE.DETUNE_CENTS);

  // --- wind and tyres ----------------------------------------------------

  const noise = makeNoiseBuffer(context);

  const windFilter = context.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = WIND.CENTRE_MIN_HZ;
  windFilter.Q.value = WIND.Q;
  const windLevel = context.createGain();
  windLevel.gain.value = 0;
  const windSource = makeNoiseSource(context, noise);
  windSource.connect(windFilter).connect(windLevel).connect(master);
  windSource.start();

  const tyreFilter = context.createBiquadFilter();
  tyreFilter.type = 'bandpass';
  tyreFilter.frequency.value = TYRES.TARMAC.centreHz;
  tyreFilter.Q.value = TYRES.TARMAC.q;
  const tyreLevel = context.createGain();
  tyreLevel.gain.value = 0;
  const tyreSource = makeNoiseSource(context, noise);
  // Offset so the two voices are not reading the same noise in step, which
  // would correlate them into one louder, narrower sound.
  tyreSource.connect(tyreFilter).connect(tyreLevel).connect(master);
  tyreSource.start(context.currentTime, NOISE.BUFFER_S * 0.37);

  const follow = MASTER.FOLLOW_S;

  return {
    context,

    update(state, maxRpm) {
      const now = context.currentTime;
      const hz = engineHz(state.rpm);
      const effort = engineEffort(state.rpm, state.throttle, maxRpm);

      sub.frequency.setTargetAtTime(hz * ENGINE.SUB_RATIO, now, follow);
      body.frequency.setTargetAtTime(hz, now, follow);
      harmonic.frequency.setTargetAtTime(hz * ENGINE.HARMONIC_RATIO, now, follow);
      engineFilter.frequency.setTargetAtTime(engineCutoffHz(effort), now, follow);
      engineLevel.gain.setTargetAtTime(engineGain(effort), now, follow);

      windLevel.gain.setTargetAtTime(windGain(state.speedMs), now, follow);
      windFilter.frequency.setTargetAtTime(windCentreHz(state.speedMs), now, follow);

      const voiceForSurface = surfaceVoice(state.surface);
      tyreLevel.gain.setTargetAtTime(
        tyreGain(state.speedMs, state.surface, state.lateralG),
        now,
        follow,
      );
      // The filter is what makes gravel sound like gravel, and it crosses
      // slowly on purpose: clipping a wheel onto the verge should be a slide
      // into a different surface, not a switch being thrown.
      tyreFilter.frequency.setTargetAtTime(voiceForSurface.centreHz, now, TYRES.SURFACE_BLEND_S);
      tyreFilter.Q.setTargetAtTime(voiceForSurface.q, now, TYRES.SURFACE_BLEND_S);
    },

    setRunning(running) {
      master.gain.setTargetAtTime(
        running ? MASTER.GAIN : 0,
        context.currentTime,
        MASTER.FADE_S / 3,
      );
    },

    dispose() {
      for (const osc of [sub, body, harmonic]) osc.stop();
      windSource.stop();
      tyreSource.stop();
      void context.close();
    },
  };
}
