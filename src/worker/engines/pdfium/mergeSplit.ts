import type { BinaryFile, SplitGroup, SplitSegment } from '../../protocol';
import type { EngineFacade } from '../engineFacade';
import type { PdfiumRuntime } from './runtime';
import { freeNativePointer, mallocNativePointer, readNativeBytes, writeNativeBytes } from './nativeMemory';

export type PdfiumMergeSplitAdapter = Pick<EngineFacade, 'merge' | 'split' | 'splitGroups'>;

type PdfiumLegacyModule = {
  merge: (files: Array<{ name: string; bytes: Uint8Array }>, rangesByFile: Record<string, string>) => Promise<Uint8Array>;
  split: (file: { name: string; bytes: Uint8Array }, ranges: string) => Promise<Uint8Array[]>;
};

type PdfiumNativeModule = {
  pdfium: {
    HEAPU8: Uint8Array;
    wasmExports: {
      malloc: (size: number) => number;
      free: (ptr: number) => void;
    };
  };
  FPDF_LoadMemDocument: (dataPtr: number, size: number, password: string) => number;
  FPDF_CreateNewDocument: () => number;
  FPDF_ImportPages: (destDoc: number, srcDoc: number, pageRange: string, index: number) => boolean;
  FPDF_GetPageCount: (doc: number) => number;
  FPDF_CloseDocument: (doc: number) => void;
  PDFiumExt_SaveAsCopy: (doc: number, writer: number) => number;
  PDFiumExt_OpenFileWriter: () => number;
  PDFiumExt_GetFileWriterSize: (writer: number) => number;
  PDFiumExt_GetFileWriterData: (writer: number, dataPtr: number, size: number) => number;
  PDFiumExt_CloseFileWriter: (writer: number) => void;
};

type LoadedDocument = {
  doc: number;
  close: () => void;
};

function toLegacyPdfiumFile(file: BinaryFile): { name: string; bytes: Uint8Array } {
  return {
    name: file.name,
    bytes: new Uint8Array(file.bytes),
  };
}

function stripExtension(name: string): string {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex < 1) {
    return name;
  }
  return name.slice(0, dotIndex);
}

function sanitizeFileBaseName(value: string): string {
  const sanitized = stripExtension(value).trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  return sanitized.length > 0 ? sanitized : 'split-part';
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isPdfiumLegacyModule(module: unknown): module is PdfiumLegacyModule {
  if (!isObjectRecord(module)) {
    return false;
  }

  return typeof module.merge === 'function' && typeof module.split === 'function';
}

function isPdfiumNativeModule(module: unknown): module is PdfiumNativeModule {
  if (!isObjectRecord(module)) {
    return false;
  }

  const candidate = module as Partial<PdfiumNativeModule>;
  if (!isObjectRecord(candidate.pdfium) || !isObjectRecord(candidate.pdfium.wasmExports)) {
    return false;
  }

  return (
    candidate.pdfium.HEAPU8 instanceof Uint8Array &&
    typeof candidate.pdfium.wasmExports.malloc === 'function' &&
    typeof candidate.pdfium.wasmExports.free === 'function' &&
    typeof candidate.FPDF_LoadMemDocument === 'function' &&
    typeof candidate.FPDF_CreateNewDocument === 'function' &&
    typeof candidate.FPDF_ImportPages === 'function' &&
    typeof candidate.FPDF_GetPageCount === 'function' &&
    typeof candidate.FPDF_CloseDocument === 'function' &&
    typeof candidate.PDFiumExt_OpenFileWriter === 'function' &&
    typeof candidate.PDFiumExt_SaveAsCopy === 'function' &&
    typeof candidate.PDFiumExt_GetFileWriterSize === 'function' &&
    typeof candidate.PDFiumExt_GetFileWriterData === 'function' &&
    typeof candidate.PDFiumExt_CloseFileWriter === 'function'
  );
}

function parseRangeTokens(input: string): string[] {
  const tokens = input
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    throw new Error('OUT_OF_RANGE');
  }
  return tokens;
}

function isAllRange(value: string | undefined): boolean {
  if (value === undefined) {
    return true;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '' || normalized === 'all';
}

function toAllRange(pageCount: number): string {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error('OUT_OF_RANGE');
  }
  return `1-${pageCount}`;
}

function resolveImportRange(rawRange: string | undefined, getPageCount: () => number): string {
  if (rawRange !== undefined && !isAllRange(rawRange)) {
    return rawRange.trim();
  }
  return toAllRange(getPageCount());
}

function segmentToImportRange(segment: SplitSegment, getPageCount: () => number): string {
  const pageCount = getPageCount();
  if (
    !Number.isInteger(segment.startPage) ||
    !Number.isInteger(segment.endPage) ||
    segment.startPage < 1 ||
    segment.endPage > pageCount ||
    segment.startPage > segment.endPage
  ) {
    throw new Error('OUT_OF_RANGE');
  }
  return segment.startPage === segment.endPage ? String(segment.startPage) : `${segment.startPage}-${segment.endPage}`;
}

function openDocumentFromBytes(module: PdfiumNativeModule, bytes: Uint8Array): LoadedDocument {
  if (bytes.length === 0) {
    throw new Error('PDF_PARSE_FAILED');
  }

  const dataPtr = mallocNativePointer(module, bytes.length);
  writeNativeBytes(module, dataPtr, bytes);

  const doc = module.FPDF_LoadMemDocument(dataPtr, bytes.length, '');
  if (doc === 0) {
    freeNativePointer(module, dataPtr);
    throw new Error('PDF_PARSE_FAILED');
  }

  let closed = false;
  return {
    doc,
    close: () => {
      if (closed) {
        return;
      }
      closed = true;
      try {
        module.FPDF_CloseDocument(doc);
      } finally {
        freeNativePointer(module, dataPtr);
      }
    },
  };
}

function saveAsCopy(module: PdfiumNativeModule, doc: number): Uint8Array {
  const writer = module.PDFiumExt_OpenFileWriter();
  if (writer === 0) {
    throw new Error('PDF_SAVE_FAILED');
  }
  const saved = module.PDFiumExt_SaveAsCopy(doc, writer);
  if (!saved) {
    module.PDFiumExt_CloseFileWriter(writer);
    throw new Error('PDF_SAVE_FAILED');
  }

  let outputPtr = 0;
  try {
    const outputSize = module.PDFiumExt_GetFileWriterSize(writer);
    if (!Number.isInteger(outputSize) || outputSize < 0) {
      throw new Error('PDF_SAVE_FAILED');
    }
    if (outputSize === 0) {
      return new Uint8Array(0);
    }

    outputPtr = mallocNativePointer(module, outputSize);
    const copied = module.PDFiumExt_GetFileWriterData(writer, outputPtr, outputSize);
    if (copied < outputSize) {
      throw new Error('PDF_SAVE_FAILED');
    }
    return readNativeBytes(module, outputPtr, outputSize);
  } finally {
    if (outputPtr !== 0) {
      freeNativePointer(module, outputPtr);
    }
    module.PDFiumExt_CloseFileWriter(writer);
  }
}

function mergeWithNative(
  module: PdfiumNativeModule,
  files: BinaryFile[],
  rangesByFile: Record<string, string>,
): Uint8Array {
  const mergedDoc = module.FPDF_CreateNewDocument();
  if (mergedDoc === 0) {
    throw new Error('MERGE_FAILED');
  }

  try {
    for (const file of files) {
      const source = openDocumentFromBytes(module, new Uint8Array(file.bytes));
      try {
        const range = resolveImportRange(rangesByFile[file.id], () => module.FPDF_GetPageCount(source.doc));
        const insertIndex = module.FPDF_GetPageCount(mergedDoc);
        const imported = module.FPDF_ImportPages(mergedDoc, source.doc, range, insertIndex);
        if (!imported) {
          throw new Error('MERGE_FAILED');
        }
      } finally {
        source.close();
      }
    }

    return saveAsCopy(module, mergedDoc);
  } finally {
    module.FPDF_CloseDocument(mergedDoc);
  }
}

function splitWithNative(module: PdfiumNativeModule, file: BinaryFile, ranges: string): Uint8Array[] {
  const source = openDocumentFromBytes(module, new Uint8Array(file.bytes));
  try {
    const tokens = parseRangeTokens(ranges);
    const artifacts: Uint8Array[] = [];

    for (const token of tokens) {
      const partDoc = module.FPDF_CreateNewDocument();
      if (partDoc === 0) {
        throw new Error('SPLIT_FAILED');
      }

      try {
        const importRange = resolveImportRange(token, () => module.FPDF_GetPageCount(source.doc));
        const insertIndex = module.FPDF_GetPageCount(partDoc);
        const imported = module.FPDF_ImportPages(partDoc, source.doc, importRange, insertIndex);
        if (!imported) {
          throw new Error('SPLIT_FAILED');
        }
        artifacts.push(saveAsCopy(module, partDoc));
      } finally {
        module.FPDF_CloseDocument(partDoc);
      }
    }

    return artifacts;
  } finally {
    source.close();
  }
}

function splitGroupsWithNative(module: PdfiumNativeModule, files: BinaryFile[], groups: SplitGroup[]): Uint8Array[] {
  if (groups.length === 0) {
    throw new Error('SPLIT_FAILED');
  }

  const fileById = new Map(files.map((file) => [file.id, file]));
  const artifacts: Uint8Array[] = [];

  for (const group of groups) {
    if (group.segments.length === 0) {
      throw new Error('SPLIT_FAILED');
    }

    const partDoc = module.FPDF_CreateNewDocument();
    if (partDoc === 0) {
      throw new Error('SPLIT_FAILED');
    }

    try {
      for (const segment of group.segments) {
        const file = fileById.get(segment.fileId);
        if (!file) {
          throw new Error('SPLIT_FAILED');
        }

        const source = openDocumentFromBytes(module, new Uint8Array(file.bytes));
        try {
          const importRange = segmentToImportRange(segment, () => module.FPDF_GetPageCount(source.doc));
          const insertIndex = module.FPDF_GetPageCount(partDoc);
          const imported = module.FPDF_ImportPages(partDoc, source.doc, importRange, insertIndex);
          if (!imported) {
            throw new Error('SPLIT_FAILED');
          }
        } finally {
          source.close();
        }
      }

      artifacts.push(saveAsCopy(module, partDoc));
    } finally {
      module.FPDF_CloseDocument(partDoc);
    }
  }

  return artifacts;
}

export function createPdfiumMergeSplitAdapter(runtime: PdfiumRuntime): PdfiumMergeSplitAdapter {
  return {
    async merge(files, rangesByFile) {
      const loaded = await runtime.load();
      let bytes: Uint8Array;
      if (isPdfiumNativeModule(loaded)) {
        bytes = mergeWithNative(loaded, files, rangesByFile);
      } else if (isPdfiumLegacyModule(loaded)) {
        bytes = await loaded.merge(files.map(toLegacyPdfiumFile), rangesByFile);
      } else {
        throw new Error('PDFIUM_RUNTIME_UNSUPPORTED');
      }

      return [
        {
          name: 'merged.pdf',
          mime: 'application/pdf',
          bytes,
        },
      ];
    },

    async split(file, ranges) {
      const loaded = await runtime.load();
      let parts: Uint8Array[];
      if (isPdfiumNativeModule(loaded)) {
        parts = splitWithNative(loaded, file, ranges);
      } else if (isPdfiumLegacyModule(loaded)) {
        parts = await loaded.split(toLegacyPdfiumFile(file), ranges);
      } else {
        throw new Error('PDFIUM_RUNTIME_UNSUPPORTED');
      }
      const baseName = sanitizeFileBaseName(file.name) || 'split';

      return parts.map((bytes, index) => ({
        name: `${baseName}-part-${index + 1}.pdf`,
        mime: 'application/pdf',
        bytes,
      }));
    },

    async splitGroups(files, groups) {
      const loaded = await runtime.load();
      let parts: Uint8Array[];
      if (isPdfiumNativeModule(loaded)) {
        parts = splitGroupsWithNative(loaded, files, groups);
      } else {
        throw new Error('PDFIUM_RUNTIME_UNSUPPORTED');
      }

      return parts.map((bytes, index) => ({
        name: `${sanitizeFileBaseName(groups[index]?.label ?? `split-part-${index + 1}`)}.pdf`,
        mime: 'application/pdf',
        bytes,
      }));
    },
  };
}
