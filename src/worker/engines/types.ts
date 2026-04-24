import type { Artifact, BinaryFile, SplitGroup } from '../protocol';

export type ExtractionOptions = {
  preserveOriginal: boolean;
  forceOutputFormat?: 'png' | 'jpg';
  quality?: number;
};

export type RenderOptions = {
  format: 'png' | 'jpg';
  dpi: number;
  quality: number;
};

export type PdfiumAdapter = {
  merge: (files: BinaryFile[], rangesByFile: Record<string, string>) => Promise<Artifact[]>;
  split: (file: BinaryFile, ranges: string) => Promise<Artifact[]>;
  splitGroups: (files: BinaryFile[], groups: SplitGroup[]) => Promise<Artifact[]>;
  extractImages: (file: BinaryFile, options: ExtractionOptions) => Promise<Artifact[]>;
};

export type PdfJsAdapter = {
  getPageCount: (file: BinaryFile) => Promise<number>;
  renderPages: (file: BinaryFile, pages: number[], options: RenderOptions) => Promise<Artifact[]>;
};
