import { describe, expect, it } from 'vitest';
import {
  createSplitGroupFromGlobalRange,
  formatSplitGroupSummary,
  getPageSplitGroupBadges,
  getGlobalPageNumber,
  getTotalPageCount,
  isPageInSplitGroups,
  resolveVirtualRange,
} from './crossPdfSplit';

const files = [
  { id: 'a', name: 'A.pdf', pageCount: 3 },
  { id: 'b', name: 'B.pdf', pageCount: 5 },
];

describe('crossPdfSplit', () => {
  it('computes total and per-thumbnail global page numbers while preserving local page numbers', () => {
    expect(getTotalPageCount(files)).toBe(8);
    expect(getGlobalPageNumber(files, 'a', 3)).toBe(3);
    expect(getGlobalPageNumber(files, 'b', 1)).toBe(4);
    expect(getGlobalPageNumber(files, 'b', 5)).toBe(8);
  });

  it('resolves a virtual range inside one PDF', () => {
    expect(resolveVirtualRange(files, 1, 2)).toEqual([{ fileId: 'a', startPage: 1, endPage: 2 }]);
  });

  it('resolves a virtual range across PDF boundaries', () => {
    expect(resolveVirtualRange(files, 3, 8)).toEqual([
      { fileId: 'a', startPage: 3, endPage: 3 },
      { fileId: 'b', startPage: 1, endPage: 5 },
    ]);
  });

  it('rejects out-of-range virtual pages', () => {
    expect(() => resolveVirtualRange(files, 0, 2)).toThrow('OUT_OF_RANGE');
    expect(() => resolveVirtualRange(files, 3, 9)).toThrow('OUT_OF_RANGE');
    expect(() => resolveVirtualRange(files, 4, 3)).toThrow('OUT_OF_RANGE');
  });

  it('creates display-ready split groups and segment summaries', () => {
    const group = createSplitGroupFromGlobalRange(files, 3, 8, 2);

    expect(group).toEqual({
      id: 'split-group-2',
      label: 'split-part-2',
      globalRange: '3-8',
      segments: [
        { fileId: 'a', startPage: 3, endPage: 3 },
        { fileId: 'b', startPage: 1, endPage: 5 },
      ],
    });
    expect(formatSplitGroupSummary(group, files)).toBe('A.pdf 3페이지 → B.pdf 1-5페이지');
  });

  it('checks whether a local PDF page belongs to any split group', () => {
    const group = createSplitGroupFromGlobalRange(files, 3, 8, 1);

    expect(isPageInSplitGroups('a', 2, [group])).toBe(false);
    expect(isPageInSplitGroups('a', 3, [group])).toBe(true);
    expect(isPageInSplitGroups('b', 5, [group])).toBe(true);
  });

  it('returns ordered badges for every split group that contains a page', () => {
    const groups = [
      createSplitGroupFromGlobalRange(files, 1, 3, 1),
      createSplitGroupFromGlobalRange(files, 3, 5, 2),
    ];

    expect(getPageSplitGroupBadges('a', 3, groups)).toEqual([
      { id: 'split-group-1', label: 'G1', title: 'split-part-1' },
      { id: 'split-group-2', label: 'G2', title: 'split-part-2' },
    ]);
    expect(getPageSplitGroupBadges('b', 3, groups)).toEqual([]);
  });
});
