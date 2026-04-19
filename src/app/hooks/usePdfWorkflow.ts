import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Artifact, BinaryFile, JobRequest, JobType, PagesToImagesRequest } from '../../worker/protocol';
import { parsePageRange } from '../../domain/pageRange';
import { useAppStore } from '../state/store';
import { createFileRegistry, type RegisteredPdf } from '../state/fileRegistry';
import { createWorkerClient } from './useWorkerClient';

type ReportSummary = {
  successCount: number;
  convertedCount: number;
  failedCount: number;
};

function readReportSummary(artifacts: Array<{ name: string; bytes: Uint8Array; metadata?: { converted?: boolean } }>): ReportSummary {
  const reportArtifact = artifacts.find((artifact) => artifact.name === 'report.json');
  if (reportArtifact) {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(reportArtifact.bytes)) as Partial<ReportSummary>;
      return {
        successCount: parsed.successCount ?? 0,
        convertedCount: parsed.convertedCount ?? 0,
        failedCount: parsed.failedCount ?? 0,
      };
    } catch {
      // ignore parse error and fall back to metadata summary
    }
  }

  const convertedCount = artifacts.filter((artifact) => artifact.metadata?.converted).length;
  return {
    successCount: Math.max(0, artifacts.length - convertedCount),
    convertedCount,
    failedCount: 0,
  };
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function readFileBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }
  const text = await file.text();
  return new TextEncoder().encode(text).buffer;
}

type PdfJsPageCountDocument = {
  numPages: number;
  cleanup?: () => void;
  destroy?: () => void;
};

type PdfJsRenderPage = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: {
    canvasContext: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void> };
};

type PdfJsRenderDocument = PdfJsPageCountDocument & {
  getPage: (pageNumber: number) => Promise<PdfJsRenderPage>;
};

type PdfJsDocumentInitParams = {
  data: Uint8Array;
  disableWorker?: boolean;
  standardFontDataUrl?: string;
  cMapUrl?: string;
  cMapPacked?: boolean;
  useSystemFonts?: boolean;
  useWorkerFetch?: boolean;
};

type PdfJsPageCountModule = {
  GlobalWorkerOptions?: {
    workerSrc?: string;
  };
  getDocument: (params: PdfJsDocumentInitParams) => { promise: Promise<PdfJsRenderDocument> };
};

const PDFJS_WORKER_FALLBACK_URL =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs';
const PDFJS_STANDARD_FONT_DATA_URL =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/standard_fonts/';
const PDFJS_CMAP_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/';

async function readPdfPageCount(bytes: ArrayBuffer): Promise<number | undefined> {
  try {
    const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJsPageCountModule;
    if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_FALLBACK_URL;
    }

    const attempts: Array<{ disableWorker?: boolean }> = [{}, { disableWorker: true }];
    let lastError: unknown = null;

    for (const attempt of attempts) {
      try {
        const document = await pdfjs
          .getDocument({
            data: new Uint8Array(bytes.slice(0)),
            disableWorker: attempt.disableWorker,
          })
          .promise;
        try {
          const pageCount = Number(document.numPages);
          if (!Number.isInteger(pageCount) || pageCount < 1) {
            return undefined;
          }
          return pageCount;
        } finally {
          document.cleanup?.();
          document.destroy?.();
        }
      } catch (error) {
        lastError = error;
      }
    }

    void lastError;
    return undefined;
  } catch {
    return undefined;
  }
}

function toPageFileName(fileName: string, page: number, format: 'png' | 'jpg'): string {
  const dotIndex = fileName.lastIndexOf('.');
  const base = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  return `${base}-page-${page}.${format}`;
}

function toMime(format: 'png' | 'jpg'): 'image/png' | 'image/jpeg' {
  return format === 'png' ? 'image/png' : 'image/jpeg';
}

function resolvePages(ranges: string, totalPages: number): number[] {
  const normalized = ranges.trim().toLowerCase();
  if (normalized === '' || normalized === 'all') {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  return parsePageRange(ranges, totalPages);
}

async function encodeCanvasElement(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpg',
  quality: number,
): Promise<Uint8Array> {
  const mime = toMime(format);
  const normalizedQuality = Math.max(0, Math.min(100, quality)) / 100;
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mime, format === 'jpg' ? normalizedQuality : undefined);
  });

  if (!blob) {
    throw new Error('CANVAS_ENCODE_UNAVAILABLE');
  }

  return new Uint8Array(await blob.arrayBuffer());
}

async function runPagesToImagesOnMainThread(
  request: PagesToImagesRequest,
  onProgress: (done: number, total: number, message: string) => void,
  isCancelled: () => boolean,
): Promise<Artifact[]> {
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJsPageCountModule;
  if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_FALLBACK_URL;
  }

  const openAttempts: Array<{ disableWorker?: boolean }> = [{}, { disableWorker: true }];
  let lastError: unknown = null;

  onProgress(0, 2, 'analyzing pages');

  for (const attempt of openAttempts) {
    try {
      const pdfDocument = await pdfjs
        .getDocument({
          data: new Uint8Array(request.payload.file.bytes.slice(0)),
          disableWorker: attempt.disableWorker,
          standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL,
          cMapUrl: PDFJS_CMAP_URL,
          cMapPacked: true,
          useSystemFonts: true,
          useWorkerFetch: true,
        })
        .promise;

      try {
        const totalPages = Number(pdfDocument.numPages);
        if (!Number.isInteger(totalPages) || totalPages < 1) {
          throw new Error('RENDER_FAILED');
        }

        const pages = resolvePages(request.payload.ranges, totalPages);
        const artifacts: Artifact[] = [];
        onProgress(1, 2, 'rendering pages');

        for (const pageNumber of pages) {
          if (isCancelled()) {
            throw new Error('JOB_CANCELLED');
          }

          const page = await pdfDocument.getPage(pageNumber);
          const viewport = page.getViewport({ scale: request.payload.dpi / 72 });
          const width = Math.max(1, Math.ceil(viewport.width));
          const height = Math.max(1, Math.ceil(viewport.height));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const context = canvas.getContext('2d');
          if (!context) {
            throw new Error('CANVAS_CONTEXT_UNAVAILABLE');
          }

          await page.render({ canvasContext: context, viewport }).promise;
          const bytes = await encodeCanvasElement(canvas, request.payload.format, request.payload.quality);

          artifacts.push({
            name: toPageFileName(request.payload.file.name, pageNumber, request.payload.format),
            mime: toMime(request.payload.format),
            bytes,
          });
        }

        if (isCancelled()) {
          throw new Error('JOB_CANCELLED');
        }

        onProgress(2, 2, 'done');
        return artifacts;
      } finally {
        pdfDocument.cleanup?.();
        pdfDocument.destroy?.();
      }
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message === 'JOB_CANCELLED') {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('RENDER_FAILED');
}

function createWorkerIfAvailable(): Worker | null {
  if (typeof Worker === 'undefined') {
    return null;
  }
  try {
    return new Worker(new URL('../../worker/index.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}

function createMergeJob(files: BinaryFile[]): JobRequest {
  const rangesByFile = Object.fromEntries(files.map((file) => [file.id, 'all']));
  return {
    jobId: createId(),
    type: 'merge',
    payload: {
      files,
      rangesByFile,
    },
  };
}

function createSplitJob(file: BinaryFile, ranges: string): JobRequest {
  return {
    jobId: createId(),
    type: 'split',
    payload: {
      file,
      ranges,
    },
  };
}

function createExtractJob(
  file: BinaryFile,
  options: { preserveOriginal: boolean; forceConvert: boolean; forceOutputFormat: 'png' | 'jpg'; quality: number },
): JobRequest {
  return {
    jobId: createId(),
    type: 'extract-images',
    payload: {
      file,
      preserveOriginal: options.preserveOriginal,
      forceOutputFormat: options.forceConvert ? options.forceOutputFormat : undefined,
      quality: options.quality,
    },
  };
}

function createPagesToImagesJob(file: BinaryFile, options: { forceOutputFormat: 'png' | 'jpg'; quality: number }): JobRequest {
  return {
    jobId: createId(),
    type: 'pages-to-images',
    payload: {
      file,
      ranges: 'all',
      format: options.forceOutputFormat,
      dpi: 144,
      quality: options.quality,
    },
  };
}

function createJobForType(
  jobType: JobType,
  files: BinaryFile[],
  options: { preserveOriginal: boolean; forceConvert: boolean; forceOutputFormat: 'png' | 'jpg'; quality: number },
  splitRanges: string | null | undefined,
): JobRequest | null {
  if (files.length === 0) {
    return null;
  }
  if (jobType === 'merge') {
    return createMergeJob(files);
  }
  if (jobType === 'split') {
    return createSplitJob(files[0], splitRanges && splitRanges.trim().length > 0 ? splitRanges : '1');
  }
  if (jobType === 'extract-images') {
    return createExtractJob(files[0], options);
  }
  return createPagesToImagesJob(files[0], options);
}

type UsePdfWorkflowOptions = {
  splitRanges?: string | null;
};

export function usePdfWorkflow(options: UsePdfWorkflowOptions = {}) {
  const activeJobType = useAppStore((state) => state.activeJobType);
  const extractionOptions = useAppStore((state) => state.extractionOptions);
  const setStatus = useAppStore((state) => state.setStatus);
  const setProgress = useAppStore((state) => state.setProgress);
  const setArtifacts = useAppStore((state) => state.setArtifacts);
  const setError = useAppStore((state) => state.setError);
  const setReportSummary = useAppStore((state) => state.setReportSummary);

  const registryRef = useRef(createFileRegistry());
  const workerRef = useRef<Worker | null>(null);
  const clientRef = useRef<ReturnType<typeof createWorkerClient> | null>(null);
  const currentJobIdRef = useRef<string | null>(null);
  const isMainThreadCancelRequestedRef = useRef(false);

  const [files, setFiles] = useState<RegisteredPdf[]>([]);

  const ensureWorkerClient = useCallback((): boolean => {
    if (workerRef.current && clientRef.current) {
      return true;
    }

    const worker = createWorkerIfAvailable();
    if (!worker) {
      workerRef.current = null;
      clientRef.current = null;
      return false;
    }

    workerRef.current = worker;
    clientRef.current = createWorkerClient(worker);
    return true;
  }, []);

  useEffect(() => {
    ensureWorkerClient();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      clientRef.current = null;
    };
  }, [ensureWorkerClient]);

  const onFilesSelected = useCallback(
    async (selected: FileList | null): Promise<void> => {
      if (!selected || selected.length === 0) {
        return;
      }

      const candidates = [...selected].filter((file) => file.name.toLowerCase().endsWith('.pdf'));
      if (candidates.length === 0) {
        return;
      }
      const mapped = await Promise.all(
        candidates.map(async (file) => {
          const bytes = await readFileBytes(file);
          return {
            id: createId(),
            name: file.name,
            bytes,
            pageCount: await readPdfPageCount(bytes),
          };
        }),
      );

      registryRef.current.clear();
      mapped.forEach((file) => registryRef.current.upsert(file));
      setFiles(registryRef.current.list());
      setStatus('idle');
      setError(null);
    },
    [setError, setStatus],
  );

  const runCurrentJob = useCallback(async (): Promise<void> => {
    const request = createJobForType(activeJobType, files, extractionOptions, options.splitRanges);
    if (!request) {
      return;
    }

    currentJobIdRef.current = request.jobId;
    isMainThreadCancelRequestedRef.current = false;
    setStatus('running');
    setError(null);
    setArtifacts([]);
    setProgress(0, 1, 'queued');

    try {
      let artifacts: Artifact[];

      if (request.type === 'pages-to-images') {
        artifacts = await runPagesToImagesOnMainThread(
          request,
          (done, total, message) => setProgress(done, total, message),
          () => isMainThreadCancelRequestedRef.current,
        );
      } else {
        if (!ensureWorkerClient() || !clientRef.current || !workerRef.current) {
          throw new Error('WORKER_UNAVAILABLE');
        }
        artifacts = await clientRef.current.request(request, {
          onProgress: (event) => setProgress(event.done, event.total, event.message),
        });
      }

      const summary = readReportSummary(artifacts);
      setArtifacts(artifacts);
      setReportSummary(summary);
      setStatus(summary.failedCount > 0 ? 'partial_failed' : 'completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'JOB_CANCELLED') {
        setStatus('cancelled');
        setError(null);
      } else {
        setStatus('failed');
        setError(message);
      }
    } finally {
      currentJobIdRef.current = null;
      isMainThreadCancelRequestedRef.current = false;
    }
  }, [activeJobType, ensureWorkerClient, extractionOptions, files, options.splitRanges, setArtifacts, setError, setProgress, setReportSummary, setStatus]);

  const cancelCurrentJob = useCallback((): void => {
    if (!currentJobIdRef.current) {
      return;
    }

    if (activeJobType === 'pages-to-images') {
      isMainThreadCancelRequestedRef.current = true;
      return;
    }

    if (!clientRef.current) {
      return;
    }
    clientRef.current.cancel(currentJobIdRef.current);
    currentJobIdRef.current = null;
    setStatus('cancelled');
  }, [activeJobType, setStatus]);

  return useMemo(
    () => ({
      uploadedFiles: files,
      uploadedFileCount: files.length,
      primaryPdfPageCount: files[0]?.pageCount ?? null,
      onFilesSelected,
      runCurrentJob,
      cancelCurrentJob,
    }),
    [cancelCurrentJob, files, onFilesSelected, runCurrentJob],
  );
}
