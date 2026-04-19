import { parsePageRange } from '../../domain/pageRange';
import type { RenderOptions } from '../engines/types';
import type { Artifact, PagesToImagesRequest } from '../protocol';

type ProgressReporter = (done: number, total: number, message: string) => void;
type LegacyPagesToImagesRuntime = {
  getPageCount: (file: PagesToImagesRequest['payload']['file']) => Promise<number>;
  renderPagesToImages: (
    file: PagesToImagesRequest['payload']['file'],
    pages: number[],
    format: 'png' | 'jpg',
    dpi: number,
    quality: number,
  ) => Promise<Artifact[]>;
};
type RenderAdapterRuntime = {
  getPageCount: (file: PagesToImagesRequest['payload']['file']) => Promise<number>;
  renderPages: (
    file: PagesToImagesRequest['payload']['file'],
    pages: number[],
    options: RenderOptions,
  ) => Promise<Artifact[]>;
};
type PagesToImagesRuntime = RenderAdapterRuntime | LegacyPagesToImagesRuntime;

function resolveAllPages(totalPages: number): number[] {
  return Array.from({ length: totalPages }, (_, index) => index + 1);
}

function resolvePages(ranges: string, totalPages: number): number[] {
  const normalized = ranges.trim().toLowerCase();
  if (normalized === '' || normalized === 'all') {
    return resolveAllPages(totalPages);
  }
  return parsePageRange(ranges, totalPages);
}

export async function runPagesToImages(
  runtime: PagesToImagesRuntime,
  req: PagesToImagesRequest,
  onProgress: ProgressReporter,
): Promise<Artifact[]> {
  onProgress(0, 2, 'analyzing pages');

  const totalPages = await runtime.getPageCount(req.payload.file);
  const pages = resolvePages(req.payload.ranges, totalPages);

  onProgress(1, 2, 'rendering pages');
  const artifacts =
    'renderPages' in runtime
      ? await runtime.renderPages(req.payload.file, pages, {
          format: req.payload.format,
          dpi: req.payload.dpi,
          quality: req.payload.quality,
        })
      : await runtime.renderPagesToImages(
          req.payload.file,
          pages,
          req.payload.format,
          req.payload.dpi,
          req.payload.quality,
        );

  onProgress(2, 2, 'done');
  return artifacts;
}
