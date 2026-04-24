import { buildReportJson } from '../app/utils/report';
import { createEngineFacade, type EngineFacade } from './engines/engineFacade';
import { createPdfiumExtractImagesAdapter } from './engines/pdfium/extractImages';
import { createPdfiumMergeSplitAdapter } from './engines/pdfium/mergeSplit';
import { defaultPdfiumRuntime } from './engines/pdfium/runtime';
import { createPdfJsRenderAdapter } from './engines/pdfjs/render';
import { runExtractImages } from './jobs/extractImagesJob';
import { runMergeOrSplit } from './jobs/mergeSplitJob';
import { runPagesToImages } from './jobs/pagesToImagesJob';
import type {
  Artifact,
  JobReport,
  JobRunResult,
  JobRequest,
  WorkerControlMessage,
  WorkerErrorCode,
  WorkerEvent,
  WorkerProgressEvent,
} from './protocol';

type WorkerHost = {
  postMessage: (event: WorkerEvent) => void;
};

type JobRunners = {
  runMergeOrSplit: typeof runMergeOrSplit;
  runExtractImages: typeof runExtractImages;
  runPagesToImages: typeof runPagesToImages;
};

type WorkerDependencies = {
  runners?: JobRunners;
  facade?: EngineFacade;
};

type PdfJsGetDocumentParams = {
  data: Uint8Array;
  disableWorker?: boolean;
  worker?: null;
  standardFontDataUrl?: string;
  cMapUrl?: string;
  cMapPacked?: boolean;
  useSystemFonts?: boolean;
  useWorkerFetch?: boolean;
};

type PdfJsModuleLike = {
  GlobalWorkerOptions?: {
    workerSrc?: string;
  };
  getDocument: (params: Record<string, unknown>) => { promise: Promise<any> };
};

type CanvasFactoryEntry = {
  canvas: OffscreenCanvas;
  context: OffscreenCanvasRenderingContext2D | null;
};

const PDFJS_WORKER_FALLBACK_URL =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs';
const PDFJS_STANDARD_FONT_DATA_URL =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/standard_fonts/';
const PDFJS_CMAP_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/';

class WorkerCanvasFactory {
  constructor(_options: { ownerDocument?: unknown; enableHWA?: boolean } = {}) {}

  create(width: number, height: number): CanvasFactoryEntry {
    if (width <= 0 || height <= 0) {
      throw new Error('Invalid canvas size');
    }
    if (typeof OffscreenCanvas === 'undefined') {
      throw new Error('CANVAS_UNAVAILABLE');
    }

    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', {
      willReadFrequently: true,
    });

    return {
      canvas,
      context,
    };
  }

  reset(canvasAndContext: CanvasFactoryEntry, width: number, height: number): void {
    if (!canvasAndContext.canvas) {
      throw new Error('Canvas is not specified');
    }
    if (width <= 0 || height <= 0) {
      throw new Error('Invalid canvas size');
    }
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: CanvasFactoryEntry): void {
    if (!canvasAndContext.canvas) {
      throw new Error('Canvas is not specified');
    }
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

class WorkerFilterFactory {
  constructor(_options: { docId?: string; ownerDocument?: unknown } = {}) {}

  addFilter(): string {
    return 'none';
  }

  addHCMFilter(): string {
    return 'none';
  }

  addAlphaFilter(): string {
    return 'none';
  }

  addLuminosityFilter(): string {
    return 'none';
  }

  addHighlightHCMFilter(): string {
    return 'none';
  }

  destroy(): void {}
}

export function buildWorkerPdfJsDocumentParams(
  params: PdfJsGetDocumentParams,
): PdfJsGetDocumentParams & {
  CanvasFactory: typeof WorkerCanvasFactory;
  FilterFactory: typeof WorkerFilterFactory;
  isOffscreenCanvasSupported: boolean;
  useWorkerFetch: true;
  standardFontDataUrl: string;
  cMapUrl: string;
  cMapPacked: true;
  useSystemFonts: true;
} {
  return {
    ...params,
    CanvasFactory: WorkerCanvasFactory,
    FilterFactory: WorkerFilterFactory,
    isOffscreenCanvasSupported: typeof OffscreenCanvas !== 'undefined',
    standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL,
    cMapUrl: PDFJS_CMAP_URL,
    cMapPacked: true,
    useSystemFonts: true,
    // Worker 내부에서 폰트/CMap 리소스를 직접 fetch한다.
    useWorkerFetch: true,
  };
}

function isCancelMessage(message: WorkerControlMessage): message is { kind: 'cancel'; jobId: string } {
  return 'kind' in message && message.kind === 'cancel';
}

function createProgressReporter(host: WorkerHost, jobId: string): (done: number, total: number, message: string) => void {
  return (done, total, message): void => {
    const event: WorkerProgressEvent = {
      kind: 'progress',
      jobId,
      done,
      total,
      message,
    };
    host.postMessage(event);
  };
}

function normalizeRunnerResult(result: Artifact[] | JobRunResult): JobRunResult {
  if (Array.isArray(result)) {
    return {
      artifacts: result,
    };
  }
  return result;
}

function inferReportFromArtifacts(artifacts: Artifact[]): JobReport {
  const convertedCount = artifacts.filter((artifact) => artifact.metadata?.converted).length;
  return {
    successCount: artifacts.length - convertedCount,
    convertedCount,
    failedCount: 0,
    failedItems: [],
  };
}

function withReportArtifact(jobId: string, artifacts: Artifact[], report: JobReport): Artifact[] {
  return [
    ...artifacts,
    {
      name: 'report.json',
      mime: 'application/json',
      bytes: buildReportJson({
        jobId,
        successCount: report.successCount,
        convertedCount: report.convertedCount,
        failedCount: report.failedCount,
        failedItems: report.failedItems,
      }),
    },
  ];
}

function isWorkerErrorCode(value: string): value is WorkerErrorCode {
  return (
    value === 'WASM_LOAD_FAILED' ||
    value === 'PDFIUM_INIT_FAILED' ||
    value === 'PDF_PARSE_FAILED' ||
    value === 'MERGE_FAILED' ||
    value === 'SPLIT_FAILED' ||
    value === 'UNSUPPORTED_IMAGE_ENCODING' ||
    value === 'IMAGE_DECODE_FAILED' ||
    value === 'IMAGE_CONVERT_FAILED' ||
    value === 'RENDER_FAILED' ||
    value === 'OOM_GUARD_TRIGGERED' ||
    value === 'WORKER_CRASHED' ||
    value === 'JOB_CANCELLED' ||
    value === 'JOB_FAILED'
  );
}

function toWorkerErrorCode(error: unknown): WorkerErrorCode {
  const message = error instanceof Error ? error.message : String(error);
  if (isWorkerErrorCode(message)) {
    return message;
  }
  if (message.includes('MERGE_')) {
    return 'MERGE_FAILED';
  }
  if (message.includes('SPLIT_')) {
    return 'SPLIT_FAILED';
  }
  return 'JOB_FAILED';
}

async function loadPdfJsModule(): Promise<{
  getDocument: (params: PdfJsGetDocumentParams) => { promise: Promise<any> };
}> {
  try {
    const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as PdfJsModuleLike;
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_FALLBACK_URL;
    }
    return {
      getDocument: (params) => pdfjs.getDocument(buildWorkerPdfJsDocumentParams(params)) as { promise: Promise<any> },
    };
  } catch {
    return {
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 1,
          async getPage() {
            return {
              getViewport: ({ scale }: { scale: number }) => ({
                width: Math.max(1, 120 * scale),
                height: Math.max(1, 160 * scale),
              }),
              render: () => ({
                promise: Promise.resolve(),
              }),
            };
          },
          cleanup: () => {},
          destroy: () => {},
        }),
      }),
    };
  }
}

function createDefaultFacade(): EngineFacade {
  const pdfiumMergeSplit = createPdfiumMergeSplitAdapter(defaultPdfiumRuntime);
  const pdfiumExtract = createPdfiumExtractImagesAdapter(defaultPdfiumRuntime);
  const pdfjsAdapter = createPdfJsRenderAdapter({ load: loadPdfJsModule });

  return createEngineFacade({
    pdfium: {
      merge: pdfiumMergeSplit.merge,
      split: pdfiumMergeSplit.split,
      splitGroups: pdfiumMergeSplit.splitGroups,
      extractImages: pdfiumExtract.extractImages,
    },
    pdfjs: {
      getPageCount: pdfjsAdapter.getPageCount,
      renderPages: pdfjsAdapter.renderPages,
    },
  });
}

export function createWorkerMessageHandler(
  host: WorkerHost,
  dependencies: WorkerDependencies = {},
): (event: MessageEvent<WorkerControlMessage>) => Promise<void> {
  const cancelled = new Set<string>();
  const runners = dependencies.runners ?? {
    runMergeOrSplit,
    runExtractImages,
    runPagesToImages,
  };
  const facade = dependencies.facade ?? createDefaultFacade();

  return async (event: MessageEvent<WorkerControlMessage>): Promise<void> => {
    const message = event.data;

    if (isCancelMessage(message)) {
      cancelled.add(message.jobId);
      return;
    }

    if (cancelled.has(message.jobId)) {
      host.postMessage({
        kind: 'error',
        jobId: message.jobId,
        code: 'JOB_CANCELLED',
        message: 'Job was cancelled before execution',
        retryable: false,
      });
      cancelled.delete(message.jobId);
      return;
    }

    const onProgress = createProgressReporter(host, message.jobId);

    try {
      let result: JobRunResult;
      if (message.type === 'merge' || message.type === 'split') {
        const output = await runners.runMergeOrSplit(message, {
          adapter: facade,
          onProgress: (progressEvent) => host.postMessage(progressEvent),
        });
        result = normalizeRunnerResult(output);
      } else if (message.type === 'extract-images') {
        const output = await runners.runExtractImages(facade.adapters.pdfium, message, onProgress);
        result = normalizeRunnerResult(output);
      } else {
        const output = await runners.runPagesToImages(facade.adapters.pdfjs, message, onProgress);
        result = normalizeRunnerResult(output);
      }

      const report = message.type === 'extract-images' ? (result.report ?? inferReportFromArtifacts(result.artifacts)) : result.report;
      const artifacts = report ? withReportArtifact(message.jobId, result.artifacts, report) : result.artifacts;

      host.postMessage({
        kind: 'done',
        jobId: message.jobId,
        artifacts,
      });
    } catch (error) {
      host.postMessage({
        kind: 'error',
        jobId: message.jobId,
        code: toWorkerErrorCode(error),
        message: error instanceof Error ? error.message : String(error),
        retryable: true,
      });
    }
  };
}

self.onmessage = createWorkerMessageHandler(self);
