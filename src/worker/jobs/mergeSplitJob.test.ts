import { describe, expect, it, vi } from 'vitest';
import type { Artifact, MergeRequest, SplitRequest } from '../protocol';
import type { EngineFacade } from '../engines/engineFacade';
import { runMergeOrSplit } from './mergeSplitJob';

type MergeSplitAdapter = Pick<EngineFacade, 'merge' | 'split' | 'splitGroups'>;

describe('runMergeOrSplit', () => {
  it('merge 경로에서 adapter.merge를 호출하고 progress를 발행한다', async () => {
    const request: MergeRequest = {
      jobId: 'job-merge-1',
      type: 'merge',
      payload: {
        files: [
          { id: 'a', name: 'a.pdf', bytes: new ArrayBuffer(1) },
          { id: 'b', name: 'b.pdf', bytes: new ArrayBuffer(1) },
        ],
        rangesByFile: {
          a: '1-2',
          b: '3',
        },
      },
    };

    const artifact: Artifact = {
      name: 'merged.pdf',
      mime: 'application/pdf',
      bytes: new Uint8Array([1, 2, 3]),
    };

    const adapter: MergeSplitAdapter = {
      merge: vi.fn().mockResolvedValue([artifact]),
      split: vi.fn(),
      splitGroups: vi.fn(),
    };

    const onProgress = vi.fn();
    const result = await runMergeOrSplit(request, { adapter, onProgress });

    expect(result).toEqual([artifact]);
    expect(adapter.merge).toHaveBeenCalledOnce();
    expect(adapter.merge).toHaveBeenCalledWith(request.payload.files, request.payload.rangesByFile);
    expect(adapter.split).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, {
      kind: 'progress',
      jobId: 'job-merge-1',
      done: 0,
      total: 1,
      message: 'merge:start',
    });
    expect(onProgress).toHaveBeenNthCalledWith(2, {
      kind: 'progress',
      jobId: 'job-merge-1',
      done: 1,
      total: 1,
      message: 'merge:done',
    });
  });

  it('split 경로에서 adapter.split를 호출하고 progress를 발행한다', async () => {
    const file = { id: 'src', name: 'source.pdf', bytes: new ArrayBuffer(1) };
    const ranges = '1,2-3';
    const request: SplitRequest = {
      jobId: 'job-split-1',
      type: 'split',
      payload: {
        file,
        ranges,
      },
    };

    const artifacts: Artifact[] = [
      { name: 'part-1.pdf', mime: 'application/pdf', bytes: new Uint8Array([11]) },
      { name: 'part-2.pdf', mime: 'application/pdf', bytes: new Uint8Array([22]) },
    ];

    const adapter: MergeSplitAdapter = {
      merge: vi.fn(),
      split: vi.fn().mockResolvedValue(artifacts),
      splitGroups: vi.fn(),
    };

    const onProgress = vi.fn();
    const result = await runMergeOrSplit(request, { adapter, onProgress });

    expect(result).toEqual(artifacts);
    expect(adapter.split).toHaveBeenCalledOnce();
    expect(adapter.split).toHaveBeenCalledWith(file, ranges);
    expect(adapter.merge).not.toHaveBeenCalled();
    expect(adapter.splitGroups).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, {
      kind: 'progress',
      jobId: 'job-split-1',
      done: 0,
      total: 1,
      message: 'split:start',
    });
    expect(onProgress).toHaveBeenNthCalledWith(2, {
      kind: 'progress',
      jobId: 'job-split-1',
      done: 1,
      total: 1,
      message: 'split:done',
    });
  });

  it('cross-PDF split 경로에서 adapter.splitGroups를 호출하고 progress를 발행한다', async () => {
    const files = [
      { id: 'a', name: 'A.pdf', bytes: new ArrayBuffer(1) },
      { id: 'b', name: 'B.pdf', bytes: new ArrayBuffer(1) },
    ];
    const groups = [
      {
        id: 'group-1',
        label: 'split-part-1',
        globalRange: '3-4',
        segments: [
          { fileId: 'a', startPage: 3, endPage: 3 },
          { fileId: 'b', startPage: 1, endPage: 1 },
        ],
      },
    ];
    const request: SplitRequest = {
      jobId: 'job-split-cross-1',
      type: 'split',
      payload: {
        mode: 'cross-pdf',
        files,
        groups,
      },
    };

    const artifacts: Artifact[] = [{ name: 'split-part-1.pdf', mime: 'application/pdf', bytes: new Uint8Array([33]) }];
    const adapter: MergeSplitAdapter = {
      merge: vi.fn(),
      split: vi.fn(),
      splitGroups: vi.fn().mockResolvedValue(artifacts),
    };
    const onProgress = vi.fn();

    const result = await runMergeOrSplit(request, { adapter, onProgress });

    expect(result).toEqual(artifacts);
    expect(adapter.splitGroups).toHaveBeenCalledWith(files, groups);
    expect(adapter.split).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, {
      kind: 'progress',
      jobId: 'job-split-cross-1',
      done: 0,
      total: 1,
      message: 'split:start',
    });
    expect(onProgress).toHaveBeenNthCalledWith(2, {
      kind: 'progress',
      jobId: 'job-split-cross-1',
      done: 1,
      total: 1,
      message: 'split:done',
    });
  });
});
