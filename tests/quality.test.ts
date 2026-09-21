import { describe, expect, it } from 'vitest';
import { QUALITY, qualityTier } from '../src/render/tuning.js';

describe('render quality tiers', () => {
  it('accepts named tiers and falls back to balanced', () => {
    expect(qualityTier('low')).toBe('low');
    expect(qualityTier('balanced')).toBe('balanced');
    expect(qualityTier('high')).toBe('high');
    expect(qualityTier('potato')).toBe('balanced');
    expect(qualityTier(null)).toBe('balanced');
  });

  it('orders fill-rate and bloom cost', () => {
    expect(QUALITY.low.maxPixelRatio).toBeLessThan(QUALITY.balanced.maxPixelRatio);
    expect(QUALITY.balanced.maxPixelRatio).toBeLessThan(QUALITY.high.maxPixelRatio);
    expect(QUALITY.low.bloom).toBe(0);
    expect(QUALITY.high.bloom).toBeGreaterThan(QUALITY.balanced.bloom);
  });
});
