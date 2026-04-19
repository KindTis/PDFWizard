import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JobReport, JobRequest, WorkerControlMessage } from './protocol';
import { buildWorkerPdfJsDocumentParams, createWorkerMessageHandler } from './index';

function createFacadeMock() {
  return {
    adapters: {
      pdfium: {
        merge: vi.fn(),
        split: vi.fn(),
        extractImages: vi.fn(),
      },
      pdfjs: {
        getPageCount: vi.fn(),
        renderPages: vi.fn(),
      },
    },
    merge: vi.fn(),
    split: vi.fn(),
    extractImages: vi.fn(),
    getPageCount: vi.fn(),
    renderPages: vi.fn(),
  } as any;
}

describe('buildWorkerPdfJsDocumentParams', () => {
  const originalOffscreenCanvas = (globalThis as Record<string, unknown>).OffscreenCanvas;

  afterEach(() => {
    if (typeof originalOffscreenCanvas === 'undefined') {
      delete (globalThis as Record<string, unknown>).OffscreenCanvas;
      return;
    }
    (globalThis as Record<string, unknown>).OffscreenCanvas = originalOffscreenCanvas;
  });

  it('워커 안전 옵션을 주입하고 전달 파라미터를 보존한다', () => {
    class FakeOffscreenCanvas {
      width: number;
      height: number;

      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }

      getContext() {
        return {};
      }
    }

    (globalThis as Record<string, unknown>).OffscreenCanvas = FakeOffscreenCanvas;

    const params = buildWorkerPdfJsDocumentParams({
      data: new Uint8Array([1, 2, 3]),
      disableWorker: true,
      worker: null,
    });

    expect(params.data).toEqual(new Uint8Array([1, 2, 3]));
    expect(params.disableWorker).toBe(true);
    expect(params.worker).toBeNull();
    expect(params.useWorkerFetch).toBe(true);
    expect(params.isOffscreenCanvasSupported).toBe(true);
    expect(typeof params.standardFontDataUrl).toBe('string');
    expect(typeof params.cMapUrl).toBe('string');
    expect(params.standardFontDataUrl.length).toBeGreaterThan(0);
    expect(params.cMapUrl.length).toBeGreaterThan(0);
    expect(params.standardFontDataUrl.endsWith('/')).toBe(true);
    expect(params.cMapUrl.endsWith('/')).toBe(true);
    expect(params.cMapPacked).toBe(true);
    expect(params.useSystemFonts).toBe(true);

    const canvasFactory = new params.CanvasFactory();
    const created = canvasFactory.create(300, 200);

    expect(created.canvas.width).toBe(300);
    expect(created.canvas.height).toBe(200);
    expect(created.context).toEqual({});

    const filterFactory = new params.FilterFactory();
    expect(filterFactory.addFilter()).toBe('none');
    expect(filterFactory.addAlphaFilter()).toBe('none');
  });
});

describe('worker dispatch', () => {
  it('routes merge request to merge split handler and posts done event', async () => {
    const posted: unknown[] = [];
    const runMergeOrSplit = vi.fn().mockResolvedValue([
      { name: 'merged.pdf', mime: 'application/pdf', bytes: new Uint8Array([1]) },
    ]);

    const handler = createWorkerMessageHandler(
      { postMessage: (event: unknown) => posted.push(event) },
      {
        facade: createFacadeMock(),
        runners: {
          runMergeOrSplit,
          runExtractImages: vi.fn(),
          runPagesToImages: vi.fn(),
        },
      },
    );

    const request: JobRequest = {
      jobId: 'job-1',
      type: 'merge',
      payload: { files: [], rangesByFile: {} },
    };

    await handler({ data: request } as MessageEvent<WorkerControlMessage>);

    expect(runMergeOrSplit).toHaveBeenCalledOnce();
    expect(posted.at(-1)).toMatchObject({ kind: 'done', jobId: 'job-1' });
  });

  it('returns cancelled error when job is cancelled before dispatch', async () => {
    const posted: unknown[] = [];

    const handler = createWorkerMessageHandler(
      { postMessage: (event: unknown) => posted.push(event) },
      {
        facade: createFacadeMock(),
        runners: {
          runMergeOrSplit: vi.fn(),
          runExtractImages: vi.fn(),
          runPagesToImages: vi.fn(),
        },
      },
    );

    await handler({ data: { kind: 'cancel', jobId: 'job-2' } } as MessageEvent<WorkerControlMessage>);
    await handler({
      data: {
        jobId: 'job-2',
        type: 'extract-images',
        payload: {
          file: { id: 'f', name: 'a.pdf', bytes: new ArrayBuffer(0) },
          preserveOriginal: true,
        },
      },
    } as MessageEvent<WorkerControlMessage>);

    expect(posted.at(-1)).toMatchObject({ kind: 'error', jobId: 'job-2', code: 'JOB_CANCELLED' });
  });

  it('adds inferred report.json on extract-images completion', async () => {
    const posted: unknown[] = [];
    const runExtractImages = vi.fn().mockResolvedValue([
      {
        name: 'image-1.jpg',
        mime: 'image/jpeg',
        bytes: new Uint8Array([1]),
        metadata: { converted: true, sourceEncoding: 'ccitt', outputEncoding: 'jpg' },
      },
      {
        name: 'image-2.png',
        mime: 'image/png',
        bytes: new Uint8Array([2]),
        metadata: { converted: false, sourceEncoding: 'png', outputEncoding: 'png' },
      },
    ]);

    const handler = createWorkerMessageHandler(
      { postMessage: (event: unknown) => posted.push(event) },
      {
        facade: createFacadeMock(),
        runners: {
          runMergeOrSplit: vi.fn(),
          runExtractImages,
          runPagesToImages: vi.fn(),
        },
      },
    );

    await handler({
      data: {
        jobId: 'job-3',
        type: 'extract-images',
        payload: {
          file: { id: 'f', name: 'a.pdf', bytes: new ArrayBuffer(0) },
          preserveOriginal: false,
          forceOutputFormat: 'jpg',
          quality: 80,
        },
      },
    } as MessageEvent<WorkerControlMessage>);

    const done = posted.at(-1) as { kind: string; artifacts: Array<{ name: string; bytes: Uint8Array }> };
    expect(done.kind).toBe('done');
    expect(done.artifacts.at(-1)?.name).toBe('report.json');
    const reportText = new TextDecoder().decode(done.artifacts.at(-1)?.bytes);
    expect(reportText).toContain('"convertedCount": 1');
    expect(reportText).toContain('"successCount": 1');
  });

  it('uses explicit report from runner when provided', async () => {
    const posted: unknown[] = [];
    const report: JobReport = {
      successCount: 1,
      convertedCount: 0,
      failedCount: 1,
      failedItems: [{ reasonCode: 'IMAGE_CONVERT_FAILED', page: 2 }],
    };
    const runExtractImages = vi.fn().mockResolvedValue({
      artifacts: [{ name: 'image-1.png', mime: 'image/png', bytes: new Uint8Array([1]) }],
      report,
    });

    const handler = createWorkerMessageHandler(
      { postMessage: (event: unknown) => posted.push(event) },
      {
        facade: createFacadeMock(),
        runners: {
          runMergeOrSplit: vi.fn(),
          runExtractImages,
          runPagesToImages: vi.fn(),
        },
      },
    );

    await handler({
      data: {
        jobId: 'job-4',
        type: 'extract-images',
        payload: {
          file: { id: 'f', name: 'a.pdf', bytes: new ArrayBuffer(0) },
          preserveOriginal: true,
        },
      },
    } as MessageEvent<WorkerControlMessage>);

    const done = posted.at(-1) as { artifacts: Array<{ name: string; bytes: Uint8Array }> };
    const reportArtifact = done.artifacts.find((artifact) => artifact.name === 'report.json');
    expect(reportArtifact).toBeDefined();
    expect(new TextDecoder().decode(reportArtifact?.bytes)).toContain('"failedCount": 1');
  });
});
