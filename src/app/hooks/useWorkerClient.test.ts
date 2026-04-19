import { describe, it, expect } from 'vitest';
import { createWorkerClient } from './useWorkerClient';

describe('worker client', () => {
  it('queues request and resolves done event', async () => {
    const { request, feedMessage } = createWorkerClient();
    const promise = request({
      jobId: 'j1',
      type: 'split',
      payload: {
        file: { id: 'f', name: 'a.pdf', bytes: new ArrayBuffer(0) },
        ranges: '1-1',
      },
    });

    feedMessage({ kind: 'done', jobId: 'j1', artifacts: [] });

    await expect(promise).resolves.toEqual([]);
  });

  it('rejects request on error event', async () => {
    const { request, feedMessage } = createWorkerClient();
    const promise = request({
      jobId: 'j2',
      type: 'split',
      payload: {
        file: { id: 'f', name: 'a.pdf', bytes: new ArrayBuffer(0) },
        ranges: '1-1',
      },
    });

    feedMessage({
      kind: 'error',
      jobId: 'j2',
      code: 'JOB_FAILED',
      message: 'boom',
      retryable: true,
    });

    await expect(promise).rejects.toThrow('boom');
  });

  it('forwards progress events and can send cancel message', async () => {
    const posted: unknown[] = [];
    const worker: {
      postMessage: (message: unknown) => void;
      onmessage: ((event: MessageEvent<any>) => void) | null;
    } = {
      postMessage: (message: unknown) => posted.push(message),
      onmessage: null,
    };

    const progressEvents: string[] = [];
    const { request, cancel } = createWorkerClient(worker as any);
    const promise = request(
      {
        jobId: 'j3',
        type: 'split',
        payload: {
          file: { id: 'f', name: 'a.pdf', bytes: new ArrayBuffer(0) },
          ranges: '1-1',
        },
      },
      {
        onProgress: (event) => progressEvents.push(event.message),
      },
    );

    worker.onmessage?.({ data: { kind: 'progress', jobId: 'j3', done: 1, total: 2, message: 'half' } } as MessageEvent<any>);
    worker.onmessage?.({ data: { kind: 'done', jobId: 'j3', artifacts: [] } } as MessageEvent<any>);
    cancel('j3');

    await expect(promise).resolves.toEqual([]);
    expect(progressEvents).toEqual(['half']);
    expect(posted.at(-1)).toEqual({ kind: 'cancel', jobId: 'j3' });
  });
});
