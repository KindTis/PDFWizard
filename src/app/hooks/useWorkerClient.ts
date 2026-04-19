import type { Artifact, JobRequest, WorkerEvent } from '../../worker/protocol';

type WorkerLike = {
  postMessage: (message: JobRequest | { kind: 'cancel'; jobId: string }) => void;
  onmessage: ((event: MessageEvent<WorkerEvent>) => void) | null;
};

type PendingRequest = {
  resolve: (artifacts: Artifact[]) => void;
  reject: (error: Error) => void;
  onProgress?: (event: Extract<WorkerEvent, { kind: 'progress' }>) => void;
};

type RequestOptions = {
  onProgress?: (event: Extract<WorkerEvent, { kind: 'progress' }>) => void;
};

export function createWorkerClient(worker?: WorkerLike) {
  const pending = new Map<string, PendingRequest>();

  const feedMessage = (event: WorkerEvent): void => {
    const req = pending.get(event.jobId);
    if (!req) return;

    if (event.kind === 'progress') {
      req.onProgress?.(event);
      return;
    }

    if (event.kind === 'done') {
      pending.delete(event.jobId);
      req.resolve(event.artifacts);
      return;
    }

    if (event.kind === 'error') {
      pending.delete(event.jobId);
      req.reject(new Error(event.message));
    }
  };

  if (worker) {
    worker.onmessage = (e) => {
      feedMessage(e.data);
    };
  }

  const request = (job: JobRequest, options: RequestOptions = {}): Promise<Artifact[]> =>
    new Promise<Artifact[]>((resolve, reject) => {
      pending.set(job.jobId, { resolve, reject, onProgress: options.onProgress });
      if (worker) {
        worker.postMessage(job);
      }
    });

  const cancel = (jobId: string): void => {
    pending.delete(jobId);
    worker?.postMessage({ kind: 'cancel', jobId });
  };

  return {
    request,
    cancel,
    feedMessage,
    pendingCount: () => pending.size,
  };
}
