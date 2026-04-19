import { describe, expect, it } from 'vitest';
import { computeChunkSize } from './memoryGuard';

describe('computeChunkSize', () => {
  it('returns smaller chunks when pressure is high', () => {
    expect(computeChunkSize(2000, 0.9)).toBeLessThan(computeChunkSize(2000, 0.5));
  });

  it('always returns at least 1', () => {
    expect(computeChunkSize(1, 0.95)).toBe(1);
  });
});