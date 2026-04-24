import type { BinaryFile, SplitGroup } from '../protocol';
import type { ExtractionOptions, PdfiumAdapter, PdfJsAdapter, RenderOptions } from './types';

export type EngineFacade = ReturnType<typeof createEngineFacade>;

export function createEngineFacade(adapters: { pdfium: PdfiumAdapter; pdfjs: PdfJsAdapter }) {
  return {
    adapters,
    merge: (files: BinaryFile[], rangesByFile: Record<string, string>) => adapters.pdfium.merge(files, rangesByFile),
    split: (file: BinaryFile, ranges: string) => adapters.pdfium.split(file, ranges),
    splitGroups: (files: BinaryFile[], groups: SplitGroup[]) => adapters.pdfium.splitGroups(files, groups),
    extractImages: (file: BinaryFile, options: ExtractionOptions) => adapters.pdfium.extractImages(file, options),
    getPageCount: (file: BinaryFile) => adapters.pdfjs.getPageCount(file),
    renderPages: (file: BinaryFile, pages: number[], options: RenderOptions) => adapters.pdfjs.renderPages(file, pages, options),
  };
}
