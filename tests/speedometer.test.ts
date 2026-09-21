import { describe, expect, it } from 'vitest';
import { formatSpeedKmh } from '../src/ui/speedometer.js';

describe('speedometer', () => {
  it('shows rounded kilometres per hour and never a negative speed', () => {
    expect(formatSpeedKmh(0)).toBe('0');
    expect(formatSpeedKmh(100 / 3.6)).toBe('100');
    expect(formatSpeedKmh(27.9)).toBe('100');
    expect(formatSpeedKmh(-4)).toBe('0');
  });
});
