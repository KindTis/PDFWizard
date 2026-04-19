import type { Artifact, BinaryFile } from '../../protocol';
import type { RenderOptions } from '../types';

type PdfJsViewport = { width: number; height: number };

type PdfJsPageProxy = {
  getViewport: (params: { scale: number }) => PdfJsViewport;
  render: (params: { canvasContext: unknown; viewport: PdfJsViewport }) => { promise: Promise<void> };
};

type PdfJsDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfJsPageProxy>;
  destroy?: () => void;
  cleanup?: () => void;
};

type PdfJsLoadingTask = {
  promise: Promise<PdfJsDocumentProxy>;
};

type PdfJsModule = {
  getDocument: (params: { data: Uint8Array; disableWorker?: boolean; worker?: null }) => PdfJsLoadingTask;
};

type CanvasLike = {
  width: number;
  height: number;
  getContext: (contextId: '2d') => unknown;
  convertToBlob?: (options: { type: string; quality?: number }) => Promise<Blob>;
  toDataURL?: (type: string, quality?: number) => string;
};

type CreatePdfJsRenderAdapterDeps = {
  load: () => Promise<PdfJsModule>;
  createCanvas?: (width: number, height: number) => CanvasLike;
  encodeCanvas?: (canvas: CanvasLike, format: 'png' | 'jpg', quality: number) => Promise<Uint8Array>;
};

function toMime(format: 'png' | 'jpg'): 'image/png' | 'image/jpeg' {
  return format === 'png' ? 'image/png' : 'image/jpeg';
}

function toPageFileName(fileName: string, page: number, format: 'png' | 'jpg'): string {
  const dotIndex = fileName.lastIndexOf('.');
  const base = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  return `${base}-page-${page}.${format}`;
}

function createDefaultCanvas(width: number, height: number): CanvasLike {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }

  throw new Error('CANVAS_UNAVAILABLE');
}

async function defaultEncodeCanvas(canvas: CanvasLike, format: 'png' | 'jpg', quality: number): Promise<Uint8Array> {
  const type = format === 'png' ? 'image/png' : 'image/jpeg';
  const normalizedQuality = Math.max(0, Math.min(100, quality)) / 100;

  if (canvas.convertToBlob) {
    const blob = await canvas.convertToBlob({
      type,
      quality: format === 'jpg' ? normalizedQuality : undefined,
    });
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
  }

  if (canvas.toDataURL) {
    const dataUrl = canvas.toDataURL(type, format === 'jpg' ? normalizedQuality : undefined);
    const base64 = dataUrl.split(',')[1] ?? '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  throw new Error('CANVAS_ENCODE_UNAVAILABLE');
}

export function createPdfJsRenderAdapter(deps: CreatePdfJsRenderAdapterDeps) {
  let modulePromise: Promise<PdfJsModule> | null = null;

  const loadModule = async (): Promise<PdfJsModule> => {
    if (!modulePromise) {
      modulePromise = deps.load();
    }
    return modulePromise;
  };

  const openDocument = async (file: BinaryFile): Promise<PdfJsDocumentProxy> => {
    const module = await loadModule();
    const attempts: Array<{ disableWorker?: boolean; worker?: null }> = [
      { disableWorker: true },
      { worker: null },
      {},
    ];
    let lastError: unknown = null;

    for (const attempt of attempts) {
      const data = new Uint8Array(file.bytes.slice(0));
      try {
        return await module.getDocument({ data, ...attempt }).promise;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          !message.includes('Cannot transfer object of unsupported type') &&
          !message.includes('GlobalWorkerOptions.workerSrc')
        ) {
          throw error;
        }
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('RENDER_FAILED');
  };

  const createCanvas = deps.createCanvas ?? createDefaultCanvas;
  const encodeCanvas = deps.encodeCanvas ?? defaultEncodeCanvas;

  return {
    async getPageCount(file: BinaryFile): Promise<number> {
      const document = await openDocument(file);
      return document.numPages;
    },
    async renderPages(file: BinaryFile, pages: number[], options: RenderOptions): Promise<Artifact[]> {
      const document = await openDocument(file);
      const artifacts: Artifact[] = [];

      for (const pageNumber of pages) {
        const page = await document.getPage(pageNumber);
        const viewport = page.getViewport({ scale: options.dpi / 72 });
        const width = Math.max(1, Math.ceil(viewport.width));
        const height = Math.max(1, Math.ceil(viewport.height));
        const canvas = createCanvas(width, height);
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('CANVAS_CONTEXT_UNAVAILABLE');
        }

        await page.render({ canvasContext: context, viewport }).promise;
        const bytes = await encodeCanvas(canvas, options.format, options.quality);

        artifacts.push({
          name: toPageFileName(file.name, pageNumber, options.format),
          mime: toMime(options.format),
          bytes,
        });
      }

      document.cleanup?.();
      document.destroy?.();

      return artifacts;
    },
  };
}
