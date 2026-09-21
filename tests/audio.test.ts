import { describe, expect, it } from 'vitest';
import {
  engineCutoffHz,
  engineEffort,
  engineGain,
  engineHz,
  surfaceVoice,
  tyreGain,
  windCentreHz,
  windGain,
} from '../src/audio/mapping.js';
import { ENGINE, TYRES, WIND } from '../src/audio/tuning.js';
import { CAR } from '../src/sim/tuning.js';

const MAX_RPM = CAR.MAX_RPM;

describe('the engine note', () => {
  it('rises with the revs and never falls back', () => {
    // No gearbox by design (ADR-0004), so the note is monotonic in rpm. If
    // this ever fails it means someone added gears, which is a design change
    // and not a bug in this file.
    let previous = 0;
    for (let rpm = CAR.IDLE_RPM; rpm <= MAX_RPM; rpm += 100) {
      const hz = engineHz(rpm);
      expect(hz).toBeGreaterThanOrEqual(previous);
      previous = hz;
    }
  });

  it('stays in a range a phone speaker can actually produce', () => {
    // Below about 28 Hz a phone reproduces nothing at all, so the fundamental
    // is floored rather than allowed to disappear at idle.
    expect(engineHz(0)).toBeGreaterThanOrEqual(ENGINE.MIN_HZ);
    expect(engineHz(CAR.IDLE_RPM)).toBeGreaterThanOrEqual(ENGINE.MIN_HZ);
    expect(engineHz(MAX_RPM)).toBeLessThan(400);
  });

  it('is quieter coasting at high revs than pulling at low ones', () => {
    // The whole difference between an engine being driven and an engine being
    // played back. Getting this backwards is what makes synths sound like a
    // dentist's drill.
    const coasting = engineEffort(6000, 0, MAX_RPM);
    const pulling = engineEffort(3000, 1, MAX_RPM);
    expect(engineGain(pulling)).toBeGreaterThan(engineGain(coasting));
  });

  it('opens up with load, and is audible even at idle', () => {
    expect(engineGain(0)).toBeCloseTo(ENGINE.GAIN_IDLE, 6);
    expect(engineGain(1)).toBeCloseTo(ENGINE.GAIN_LOAD, 6);
    expect(engineCutoffHz(1)).toBeGreaterThan(engineCutoffHz(0) * 4);
  });

  it('keeps effort inside 0..1 for any input, including silly ones', () => {
    for (const rpm of [-100, 0, 3000, MAX_RPM, MAX_RPM * 3]) {
      for (const throttle of [-1, 0, 0.5, 1, 4]) {
        const e = engineEffort(rpm, throttle, MAX_RPM);
        expect(e).toBeGreaterThanOrEqual(0);
        expect(e).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('wind', () => {
  it('is silent at a standstill', () => {
    expect(windGain(0)).toBe(0);
  });

  it('grows with the square of speed, not linearly', () => {
    // It is drag, and the ear knows what drag sounds like: doubling the speed
    // must be much more than doubling the noise.
    const half = windGain(WIND.REF_SPEED_MS / 2);
    const full = windGain(WIND.REF_SPEED_MS);
    expect(full / half).toBeGreaterThan(3.5);
    expect(full).toBeCloseTo(WIND.GAIN_MAX, 6);
  });

  it('brightens with speed and stops at the reference', () => {
    expect(windCentreHz(0)).toBeCloseTo(WIND.CENTRE_MIN_HZ, 6);
    expect(windCentreHz(WIND.REF_SPEED_MS)).toBeCloseTo(WIND.CENTRE_MAX_HZ, 6);
    // Saturates rather than running away on a downhill overspeed.
    expect(windCentreHz(WIND.REF_SPEED_MS * 3)).toBeCloseTo(WIND.CENTRE_MAX_HZ, 6);
  });
});

describe('tyres', () => {
  it('say what you are driving on', () => {
    const speed = 25;
    const tarmac = tyreGain(speed, 'tarmac', 0);
    expect(tyreGain(speed, 'gravel', 0)).toBeGreaterThan(tarmac);
    expect(tyreGain(speed, 'grass', 0)).toBeGreaterThan(tarmac);
    // Gravel is the bright one — that difference is the cue that you have put
    // a wheel off, and it has to survive being mixed under wind.
    expect(surfaceVoice('gravel').centreHz).toBeGreaterThan(surfaceVoice('tarmac').centreHz);
    expect(surfaceVoice('grass').centreHz).toBeLessThan(surfaceVoice('tarmac').centreHz);
  });

  it('scrub louder near the limit', () => {
    // The only warning the game gives that the car is at the edge, since
    // there is no fail state to find it with (ADR-0005).
    const straight = tyreGain(30, 'tarmac', 0);
    const cornering = tyreGain(30, 'tarmac', 0.8);
    expect(cornering).toBeGreaterThan(straight * 1.5);
  });

  it('is symmetric in the direction of the corner', () => {
    expect(tyreGain(30, 'tarmac', -0.6)).toBeCloseTo(tyreGain(30, 'tarmac', 0.6), 10);
  });

  it('is silent when stopped, whatever it is parked on', () => {
    for (const surface of ['tarmac', 'gravel', 'grass'] as const) {
      expect(tyreGain(0, surface, 0)).toBe(0);
    }
  });

  it('saturates rather than exploding past the reference speed', () => {
    const at = tyreGain(TYRES.REF_SPEED_MS, 'tarmac', 0);
    expect(tyreGain(TYRES.REF_SPEED_MS * 4, 'tarmac', 0)).toBeCloseTo(at, 10);
  });
});

describe('the mix', () => {
  it('never asks for more than unity, even flat out on grass in a slide', () => {
    // Three voices summing past 1.0 would clip on the way to the speaker, and
    // clipping is the one sound a calm game must never make.
    const worst =
      engineGain(1) + windGain(WIND.REF_SPEED_MS * 2) + tyreGain(200, 'grass', 1.2);
    expect(worst).toBeLessThan(1);
  });
});
