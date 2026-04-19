import type { Artifact, MergeRequest, SplitRequest, WorkerProgressEvent } from '../protocol';
import type { EngineFacade } from '../engines/engineFacade';

export type MergeSplitRequest = MergeRequest | SplitRequest;
export type MergeSplitAdapter = Pick<EngineFacade, 'merge' | 'split'>;

export type RunMergeSplitOptions = {
  adapter: MergeSplitAdapter;
  onProgress?: (event: WorkerProgressEvent) => void;
};

function toProgressEvent(jobId: string, done: number, total: number, message: string): WorkerProgressEvent {
  return {
    kind: 'progress',
    jobId,
    done,
    total,
    message,
  };
}

export async function runMergeOrSplit(
  request: MergeSplitRequest,
  options: RunMergeSplitOptions,
): Promise<Artifact[]> {
  const emitProgress = (done: number, total: number, message: string): void => {
    options.onProgress?.(toProgressEvent(request.jobId, done, total, message));
  };

  if (request.type === 'merge') {
    emitProgress(0, 1, 'merge:start');
    const artifacts = await options.adapter.merge(request.payload.files, request.payload.rangesByFile);
    emitProgress(1, 1, 'merge:done');
    return artifacts;
  }

  emitProgress(0, 1, 'split:start');
  const artifacts = await options.adapter.split(request.payload.file, request.payload.ranges);
  emitProgress(1, 1, 'split:done');
  return artifacts;
}
