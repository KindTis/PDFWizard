import { describe, expect, it } from 'vitest';
import { parsePageRange } from './pageRange';

describe('parsePageRange', () => {
  it('parses 1-3,8,10-12', () => {
    expect(parsePageRange('1-3,8,10-12', 20)).toEqual([1, 2, 3, 8, 10, 11, 12]);
  });

  it('rejects out-of-range pages', () => {
    expect(() => parsePageRange('1,999', 10)).toThrow('OUT_OF_RANGE');
  });

  it('deduplicates and sorts pages', () => {
    expect(parsePageRange('3,1,3,2', 5)).toEqual([1, 2, 3]);
  });
});