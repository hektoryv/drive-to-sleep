import { describe, expect, it } from 'vitest';
import { needsGuardrail, smoothGuardrailMask } from '../src/world/gen/guardrail.js';
import { ROADSIDE } from '../src/world/tuning.js';

describe('guardrail placement', () => {
  it('protects a real drop and leaves level ground open', () => {
    expect(needsGuardrail(12, 12)).toBe(false);
    expect(needsGuardrail(12, 12 - ROADSIDE.GUARDRAIL_MIN_DROP_M + 0.01)).toBe(false);
    expect(needsGuardrail(12, 12 - ROADSIDE.GUARDRAIL_MIN_DROP_M)).toBe(true);
    expect(needsGuardrail(12, 5)).toBe(true);
  });

  it('does not mistake rising terrain for a drop', () => {
    expect(needsGuardrail(4, 10)).toBe(false);
  });

  it('joins small gaps and removes isolated fragments', () => {
    const mask = Uint8Array.from([
      0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 0,
    ]);
    smoothGuardrailMask(mask, mask.length, 2, 5);
    expect([...mask]).toEqual([
      0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });
});
