import { describe, expect, it } from 'vitest';
import { gaugeAngle } from '../src/cockpit/gauges.js';
import { GAUGES } from '../src/cockpit/tuning.js';

describe('instrument needles', () => {
  it('sweeps monotonically across the authored arc', () => {
    expect(gaugeAngle(0, 100)).toBeCloseTo(GAUGES.START_ANGLE, 10);
    expect(gaugeAngle(50, 100)).toBeCloseTo(GAUGES.START_ANGLE + GAUGES.SWEEP / 2, 10);
    expect(gaugeAngle(100, 100)).toBeCloseTo(GAUGES.START_ANGLE + GAUGES.SWEEP, 10);
  });

  it('clamps bad telemetry at the dial stops', () => {
    expect(gaugeAngle(-10, 100)).toBeCloseTo(GAUGES.START_ANGLE, 10);
    expect(gaugeAngle(500, 100)).toBeCloseTo(GAUGES.START_ANGLE + GAUGES.SWEEP, 10);
    expect(gaugeAngle(1, 0)).toBeCloseTo(GAUGES.START_ANGLE, 10);
  });
});
