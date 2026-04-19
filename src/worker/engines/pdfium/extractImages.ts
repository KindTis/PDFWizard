import type { Artifact, BinaryFile } from '../../protocol';
import type { PdfiumAdapter } from '../types';
import type { ExtractionOptions } from '../types';
import { decideExtractionOutput } from '../../policies/imageExtractionPolicy';
import type { SupportedEncoding } from '../../policies/imageExtractionPolicy';
import type { PdfiumRuntime } from './runtime';

const FPDF_PAGEOBJ_IMAGE = 3;

type OutputEncoding = 'png' | 'jpg' | 'jpeg' | 'jpx' | 'jbig2' | 'ccitt';

type ExtractedRawImage = {
  bytes: Uint8Array;
  encoding: SupportedEncoding;
  page: number;
  objectId: string;
};

type LegacyRawImage = {
  bytes: Uint8Array;
  encoding: SupportedEncoding;
  page?: number;
  objectId?: string;
};

type PdfiumLowLevelModule = {
  pdfium: {
    HEAPU8: Uint8Array;
    UTF8ToString?: (ptr: number) => string;
    wasmExports: {
      malloc: (size: number) => number;
      free: (ptr: number) => void;
    };
  };
  FPDF_LoadMemDocument: (dataPtr: number, size: number, password: string) => number;
  FPDF_CloseDocument: (document: number) => void;
  FPDF_GetPageCount: (document: number) => number;
  FPDF_LoadPage: (document: number, pageIndex: number) => number;
  FPDF_ClosePage: (page: number) => void;
  FPDFPage_CountObjects: (page: number) => number;
  FPDFPage_GetObject: (page: number, objectIndex: number) => number;
  FPDFPageObj_GetType: (pageObject: number) => number;
  FPDFImageObj_GetImageDataRaw: (imageObject: number, buffer: number, buflen: number) => number;
  FPDFImageObj_GetImageFilterCount?: (imageObject: number) => number;
  FPDFImageObj_GetImageFilter?: (imageObject: number, filterIndex: number, buffer: number, buflen: number) => number;
  convertImage?: (bytes: Uint8Array, output: 'png' | 'jpg', quality: number) => Promise<Uint8Array>;
};

type PdfiumLegacyExtractModule = {
  extractImages: (file: { name: string; bytes: Uint8Array }) => Promise<LegacyRawImage[]>;
  convertImage: (bytes: Uint8Array, output: 'png' | 'jpg', quality: number) => Promise<Uint8Array>;
};

function stripExtension(name: string): string {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex < 1) {
    return name;
  }
  return name.slice(0, dotIndex);
}

function sanitizeToken(token: string): string {
  return token.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function buildArtifactName(base: string, image: ExtractedRawImage, index: number, extension: string): string {
  const parts = [base];
  parts.push(`p${image.page}`);
  parts.push(`o${sanitizeToken(image.objectId)}`);
  parts.push(`img-${index + 1}`);
  return `${parts.join('-')}.${extension}`;
}

function readCStringFromHeap(heap: Uint8Array, ptr: number, maxLength: number): string {
  const end = ptr + maxLength;
  let cursor = ptr;
  while (cursor < end && heap[cursor] !== 0) {
    cursor += 1;
  }
  return new TextDecoder().decode(heap.subarray(ptr, cursor));
}

function mapFilterToEncoding(filter: string): SupportedEncoding | undefined {
  const normalized = filter.replace(/^\//, '').toLowerCase();
  switch (normalized) {
    case 'dctdecode':
      return 'jpeg';
    case 'flatedecode':
    case 'runlengthdecode':
    case 'lzwdecode':
      return 'png';
    case 'jpxdecode':
      return 'jpx';
    case 'jbig2decode':
      return 'jbig2';
    case 'ccittfaxdecode':
      return 'ccitt';
    default:
      return undefined;
  }
}

function detectEncodingFromBytes(bytes: Uint8Array): SupportedEncoding {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x97 &&
    bytes[1] === 0x4a &&
    bytes[2] === 0x42 &&
    bytes[3] === 0x32 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'jbig2';
  }
  if (
    (bytes.length >= 4 &&
      bytes[0] === 0xff &&
      bytes[1] === 0x4f &&
      bytes[2] === 0xff &&
      bytes[3] === 0x51) ||
    (bytes.length >= 12 &&
      bytes[4] === 0x6a &&
      bytes[5] === 0x50 &&
      bytes[6] === 0x20 &&
      bytes[7] === 0x20)
  ) {
    return 'jpx';
  }
  return 'png';
}

function resolveSourceEncoding(module: PdfiumLowLevelModule, imageObject: number, bytes: Uint8Array): SupportedEncoding {
  const getFilterCount = module.FPDFImageObj_GetImageFilterCount;
  const getFilter = module.FPDFImageObj_GetImageFilter;

  if (getFilterCount && getFilter) {
    const filterCount = getFilterCount(imageObject);
    for (let filterIndex = 0; filterIndex < filterCount; filterIndex += 1) {
      const requiredLength = getFilter(imageObject, filterIndex, 0, 0);
      if (requiredLength <= 1) {
        continue;
      }

      const filterPtr = module.pdfium.wasmExports.malloc(requiredLength);
      if (!filterPtr) {
        continue;
      }

      try {
        getFilter(imageObject, filterIndex, filterPtr, requiredLength);
        const rawFilter =
          module.pdfium.UTF8ToString?.(filterPtr) ??
          readCStringFromHeap(module.pdfium.HEAPU8, filterPtr, requiredLength);
        const mapped = mapFilterToEncoding(rawFilter);
        if (mapped) {
          return mapped;
        }
      } finally {
        module.pdfium.wasmExports.free(filterPtr);
      }
    }
  }

  return detectEncodingFromBytes(bytes);
}

function extractRawImagesFromPdf(module: PdfiumLowLevelModule, file: BinaryFile): ExtractedRawImage[] {
  const inputBytes = new Uint8Array(file.bytes);
  const filePtr = module.pdfium.wasmExports.malloc(inputBytes.length);
  if (!filePtr && inputBytes.length > 0) {
    throw new Error('PDFIUM_MALLOC_INPUT_FAILED');
  }

  let document = 0;
  try {
    if (inputBytes.length > 0) {
      module.pdfium.HEAPU8.set(inputBytes, filePtr);
    }
    document = module.FPDF_LoadMemDocument(filePtr, inputBytes.length, '');
    if (!document) {
      throw new Error('PDFIUM_LOAD_DOCUMENT_FAILED');
    }

    const pageCount = module.FPDF_GetPageCount(document);
    const images: ExtractedRawImage[] = [];

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const page = module.FPDF_LoadPage(document, pageIndex);
      if (!page) {
        continue;
      }

      try {
        const objectCount = module.FPDFPage_CountObjects(page);
        for (let objectIndex = 0; objectIndex < objectCount; objectIndex += 1) {
          const pageObject = module.FPDFPage_GetObject(page, objectIndex);
          if (!pageObject) {
            continue;
          }
          if (module.FPDFPageObj_GetType(pageObject) !== FPDF_PAGEOBJ_IMAGE) {
            continue;
          }

          const requiredLength = module.FPDFImageObj_GetImageDataRaw(pageObject, 0, 0);
          if (requiredLength <= 0) {
            continue;
          }

          const imagePtr = module.pdfium.wasmExports.malloc(requiredLength);
          if (!imagePtr) {
            continue;
          }

          try {
            const writtenLength = module.FPDFImageObj_GetImageDataRaw(pageObject, imagePtr, requiredLength);
            if (writtenLength <= 0) {
              continue;
            }

            const bytes = new Uint8Array(module.pdfium.HEAPU8.subarray(imagePtr, imagePtr + writtenLength));
            const encoding = resolveSourceEncoding(module, pageObject, bytes);

            images.push({
              bytes,
              encoding,
              page: pageIndex + 1,
              objectId: String(objectIndex + 1),
            });
          } finally {
            module.pdfium.wasmExports.free(imagePtr);
          }
        }
      } finally {
        module.FPDF_ClosePage(page);
      }
    }

    return images;
  } finally {
    if (document) {
      module.FPDF_CloseDocument(document);
    }
    if (filePtr) {
      module.pdfium.wasmExports.free(filePtr);
    }
  }
}

function resolveOutputEncoding(
  sourceEncoding: SupportedEncoding,
  decision: ReturnType<typeof decideExtractionOutput>,
): OutputEncoding {
  if (decision.mode === 'convert') {
    return decision.outputFormat;
  }
  return sourceEncoding === 'jpeg' ? 'jpeg' : sourceEncoding;
}

function resolvePreserveOutput(encoding: SupportedEncoding): { mime: string; extension: string; output: OutputEncoding } {
  if (encoding === 'jpeg') {
    return { mime: 'image/jpeg', extension: 'jpg', output: 'jpeg' };
  }
  if (encoding === 'png') {
    return { mime: 'image/png', extension: 'png', output: 'png' };
  }
  if (encoding === 'jpx') {
    return { mime: 'image/jpx', extension: 'jpx', output: 'jpx' };
  }
  if (encoding === 'jbig2') {
    return { mime: 'image/x-jbig2', extension: 'jb2', output: 'jbig2' };
  }
  return { mime: 'image/tiff', extension: 'tiff', output: 'ccitt' };
}

function isLowLevelModule(candidate: unknown): candidate is PdfiumLowLevelModule {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }
  const module = candidate as Partial<PdfiumLowLevelModule>;
  return (
    typeof module.FPDF_LoadMemDocument === 'function' &&
    typeof module.FPDF_GetPageCount === 'function' &&
    typeof module.FPDF_LoadPage === 'function' &&
    typeof module.FPDFPage_CountObjects === 'function' &&
    typeof module.FPDFPage_GetObject === 'function' &&
    typeof module.FPDFImageObj_GetImageDataRaw === 'function' &&
    !!module.pdfium &&
    typeof module.pdfium.wasmExports?.malloc === 'function' &&
    typeof module.pdfium.wasmExports?.free === 'function' &&
    module.pdfium.HEAPU8 instanceof Uint8Array
  );
}

function normalizeLegacyRawImages(images: LegacyRawImage[]): ExtractedRawImage[] {
  return images.map((image, index) => ({
    bytes: image.bytes,
    encoding: image.encoding,
    page: image.page ?? 1,
    objectId: image.objectId ?? String(index + 1),
  }));
}

export function createPdfiumExtractImagesAdapter(runtime: PdfiumRuntime): Pick<PdfiumAdapter, 'extractImages'> {
  return {
    async extractImages(file: BinaryFile, options: ExtractionOptions): Promise<Artifact[]> {
      const loadedModule = (await runtime.load()) as unknown;
      const module = loadedModule as PdfiumLegacyExtractModule;
      const rawImages = isLowLevelModule(loadedModule)
        ? extractRawImagesFromPdf(loadedModule, file)
        : normalizeLegacyRawImages(await module.extractImages({ name: file.name, bytes: new Uint8Array(file.bytes) }));
      const base = stripExtension(file.name);

      return Promise.all(
        rawImages.map(async (rawImage, index) => {
          const decision = decideExtractionOutput(rawImage.encoding, options);
          const canConvert = typeof module.convertImage === 'function';
          const shouldConvert = decision.mode === 'convert' && canConvert;
          const preserveOutput = resolvePreserveOutput(rawImage.encoding);

          const bytes = shouldConvert
            ? await module.convertImage!(rawImage.bytes, decision.outputFormat, decision.quality)
            : rawImage.bytes;
          const outputEncoding = shouldConvert ? resolveOutputEncoding(rawImage.encoding, decision) : preserveOutput.output;
          const mime = shouldConvert ? decision.mime : preserveOutput.mime;
          const extension = shouldConvert ? decision.extension : preserveOutput.extension;
          const metadata: Artifact['metadata'] & {
            source: SupportedEncoding;
            output: OutputEncoding;
          } = {
            converted: shouldConvert,
            source: rawImage.encoding,
            output: outputEncoding,
            sourceEncoding: rawImage.encoding,
            outputEncoding,
          };

          return {
            name: buildArtifactName(base, rawImage, index, extension),
            mime,
            bytes,
            metadata,
          };
        }),
      );
    },
  };
}
