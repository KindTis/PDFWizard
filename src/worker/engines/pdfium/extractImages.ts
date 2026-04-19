import type { Artifact, BinaryFile } from '../../protocol';
import type { PdfiumAdapter } from '../types';
import type { ExtractionOptions } from '../types';
import { decideExtractionOutput } from '../../policies/imageExtractionPolicy';
import type { SupportedEncoding } from '../../policies/imageExtractionPolicy';
import type { PdfiumRuntime } from './runtime';

const FPDF_PAGEOBJ_IMAGE = 3;
const FPDFBitmap_Gray = 1;
const FPDFBitmap_BGR = 2;
const FPDFBitmap_BGRx = 3;
const FPDFBitmap_BGRA = 4;

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
  FPDFImageObj_GetRenderedBitmap?: (document: number, page: number, imageObject: number) => number;
  FPDFImageObj_GetImageFilterCount?: (imageObject: number) => number;
  FPDFImageObj_GetImageFilter?: (imageObject: number, filterIndex: number, buffer: number, buflen: number) => number;
  FPDFBitmap_GetBuffer?: (bitmap: number) => number;
  FPDFBitmap_GetWidth?: (bitmap: number) => number;
  FPDFBitmap_GetHeight?: (bitmap: number) => number;
  FPDFBitmap_GetStride?: (bitmap: number) => number;
  FPDFBitmap_GetFormat?: (bitmap: number) => number;
  FPDFBitmap_Destroy?: (bitmap: number) => void;
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

function isPngContainer(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function hasRenderedBitmapApis(module: PdfiumLowLevelModule): module is PdfiumLowLevelModule &
  Required<
    Pick<
      PdfiumLowLevelModule,
      | 'FPDFImageObj_GetRenderedBitmap'
      | 'FPDFBitmap_GetBuffer'
      | 'FPDFBitmap_GetWidth'
      | 'FPDFBitmap_GetHeight'
      | 'FPDFBitmap_GetStride'
      | 'FPDFBitmap_GetFormat'
      | 'FPDFBitmap_Destroy'
    >
  > {
  return (
    typeof module.FPDFImageObj_GetRenderedBitmap === 'function' &&
    typeof module.FPDFBitmap_GetBuffer === 'function' &&
    typeof module.FPDFBitmap_GetWidth === 'function' &&
    typeof module.FPDFBitmap_GetHeight === 'function' &&
    typeof module.FPDFBitmap_GetStride === 'function' &&
    typeof module.FPDFBitmap_GetFormat === 'function' &&
    typeof module.FPDFBitmap_Destroy === 'function'
  );
}

function convertBitmapToRgba(
  src: Uint8Array,
  width: number,
  height: number,
  stride: number,
  format: number,
): Uint8Array | null {
  if (width <= 0 || height <= 0 || stride <= 0) {
    return null;
  }

  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const outIndex = (y * width + x) * 4;
      const rowBase = y * stride;
      if (format === FPDFBitmap_Gray) {
        const sourceIndex = rowBase + x;
        const g = src[sourceIndex] ?? 0;
        out[outIndex] = g;
        out[outIndex + 1] = g;
        out[outIndex + 2] = g;
        out[outIndex + 3] = 255;
        continue;
      }

      if (format === FPDFBitmap_BGR || format === FPDFBitmap_BGRx || format === FPDFBitmap_BGRA) {
        const bytesPerPixel = format === FPDFBitmap_BGR ? 3 : 4;
        const sourceIndex = rowBase + x * bytesPerPixel;
        const b = src[sourceIndex] ?? 0;
        const g = src[sourceIndex + 1] ?? 0;
        const r = src[sourceIndex + 2] ?? 0;
        const a = format === FPDFBitmap_BGRA ? src[sourceIndex + 3] ?? 255 : 255;
        out[outIndex] = r;
        out[outIndex + 1] = g;
        out[outIndex + 2] = b;
        out[outIndex + 3] = a;
        continue;
      }

      return null;
    }
  }

  return out;
}

type CanvasContext2DLike = {
  createImageData?: (width: number, height: number) => { data: Uint8ClampedArray };
  putImageData: (imageData: { data: Uint8ClampedArray }, dx: number, dy: number) => void;
};

type OffscreenCanvasLike = {
  getContext: (contextId: '2d') => CanvasContext2DLike | null;
  convertToBlob?: (options?: { type?: string; quality?: number }) => Promise<Blob>;
};

async function encodeRgbaToPng(bytes: Uint8Array, width: number, height: number): Promise<Uint8Array | null> {
  const CanvasCtor = (globalThis as { OffscreenCanvas?: new (w: number, h: number) => OffscreenCanvasLike }).OffscreenCanvas;
  if (typeof CanvasCtor !== 'function') {
    return null;
  }

  const canvas = new CanvasCtor(width, height);
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  const clamped = new Uint8ClampedArray(bytes.length);
  clamped.set(bytes);
  const ImageDataCtor = (globalThis as {
    ImageData?: new (data: Uint8ClampedArray, width: number, height: number) => { data: Uint8ClampedArray };
  }).ImageData;
  let imageData: { data: Uint8ClampedArray } | null = null;
  if (typeof ImageDataCtor === 'function') {
    imageData = new ImageDataCtor(clamped, width, height);
  } else if (typeof context.createImageData === 'function') {
    imageData = context.createImageData(width, height);
    imageData.data.set(clamped);
  }
  if (!imageData) {
    return null;
  }

  context.putImageData(imageData, 0, 0);
  if (typeof canvas.convertToBlob !== 'function') {
    return null;
  }
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
}

async function renderImageObjectAsPng(
  module: PdfiumLowLevelModule,
  document: number,
  page: number,
  imageObject: number,
): Promise<Uint8Array | null> {
  if (!hasRenderedBitmapApis(module)) {
    return null;
  }

  const bitmap = module.FPDFImageObj_GetRenderedBitmap(document, page, imageObject);
  if (!bitmap) {
    return null;
  }

  try {
    const width = module.FPDFBitmap_GetWidth(bitmap);
    const height = module.FPDFBitmap_GetHeight(bitmap);
    const stride = module.FPDFBitmap_GetStride(bitmap);
    const format = module.FPDFBitmap_GetFormat(bitmap);
    const bufferPtr = module.FPDFBitmap_GetBuffer(bitmap);
    if (width <= 0 || height <= 0 || stride <= 0 || bufferPtr <= 0) {
      return null;
    }

    const totalBytes = stride * height;
    const src = new Uint8Array(module.pdfium.HEAPU8.subarray(bufferPtr, bufferPtr + totalBytes));
    const rgba = convertBitmapToRgba(src, width, height, stride, format);
    if (!rgba) {
      return null;
    }

    return encodeRgbaToPng(rgba, width, height);
  } finally {
    module.FPDFBitmap_Destroy(bitmap);
  }
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

async function extractRawImagesFromPdf(module: PdfiumLowLevelModule, file: BinaryFile): Promise<ExtractedRawImage[]> {
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

            let bytes = new Uint8Array(module.pdfium.HEAPU8.subarray(imagePtr, imagePtr + writtenLength));
            const encoding = resolveSourceEncoding(module, pageObject, bytes);
            if (encoding === 'png' && !isPngContainer(bytes)) {
              const renderedPng = await renderImageObjectAsPng(module, document, page, pageObject);
              if (renderedPng && renderedPng.length > 0) {
                bytes = new Uint8Array(renderedPng);
              }
            }

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
        ? await extractRawImagesFromPdf(loadedModule, file)
        : normalizeLegacyRawImages(await module.extractImages({ name: file.name, bytes: new Uint8Array(file.bytes) }));
      const base = stripExtension(file.name);

      return Promise.all(
        rawImages.map(async (rawImage, index) => {
          const decision = decideExtractionOutput(rawImage.encoding, options);
          const canConvert = typeof module.convertImage === 'function';
          const isJpegToJpeg = decision.mode === 'convert' && rawImage.encoding === 'jpeg' && decision.outputFormat === 'jpg';
          const shouldConvert = decision.mode === 'convert' && canConvert && !isJpegToJpeg;
          const preserveOutput = resolvePreserveOutput(rawImage.encoding);
          const shouldRepackagePngPreserve =
            !shouldConvert &&
            canConvert &&
            decision.mode === 'preserve' &&
            rawImage.encoding === 'png' &&
            !isPngContainer(rawImage.bytes);

          const bytes = shouldConvert
            ? await module.convertImage!(rawImage.bytes, decision.outputFormat, decision.quality)
            : shouldRepackagePngPreserve
              ? await module.convertImage!(rawImage.bytes, 'png', 100)
              : rawImage.bytes;
          const converted = shouldConvert || shouldRepackagePngPreserve;
          const outputEncoding = shouldConvert ? resolveOutputEncoding(rawImage.encoding, decision) : preserveOutput.output;
          const mime = shouldConvert ? decision.mime : preserveOutput.mime;
          const extension = shouldConvert ? decision.extension : preserveOutput.extension;
          const metadata: Artifact['metadata'] & {
            source: SupportedEncoding;
            output: OutputEncoding;
          } = {
            converted,
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
