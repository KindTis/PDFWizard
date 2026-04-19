import { describe, expect, it, vi } from 'vitest';
import { createPdfiumExtractImagesAdapter } from './extractImages';

function createMockLowLevelModule(input: { rawBytes: number[]; filterName: string; pageObjectTypes: number[] }) {
  const heap = new Uint8Array(4096);
  let nextPtr = 64;
  const encoder = new TextEncoder();

  const malloc = vi.fn((size: number) => {
    const ptr = nextPtr;
    nextPtr += size + 8;
    return ptr;
  });
  const free = vi.fn();

  const imageObjectIndex = input.pageObjectTypes.indexOf(3);
  const imageObjectHandle = imageObjectIndex >= 0 ? 301 + imageObjectIndex : -1;
  const imageFilterBytes = encoder.encode(`${input.filterName}\0`);

  const module = {
    pdfium: {
      HEAPU8: heap,
      UTF8ToString: (ptr: number) => {
        let cursor = ptr;
        while (heap[cursor] !== 0) {
          cursor += 1;
        }
        return new TextDecoder().decode(heap.subarray(ptr, cursor));
      },
      wasmExports: {
        malloc,
        free,
      },
    },
    FPDF_LoadMemDocument: vi.fn().mockReturnValue(11),
    FPDF_CloseDocument: vi.fn(),
    FPDF_GetPageCount: vi.fn().mockReturnValue(1),
    FPDF_LoadPage: vi.fn().mockReturnValue(21),
    FPDF_ClosePage: vi.fn(),
    FPDFPage_CountObjects: vi.fn().mockReturnValue(input.pageObjectTypes.length),
    FPDFPage_GetObject: vi.fn((_: number, objectIndex: number) => 300 + objectIndex + 1),
    FPDFPageObj_GetType: vi.fn((pageObject: number) => input.pageObjectTypes[pageObject - 301]),
    FPDFImageObj_GetImageDataRaw: vi.fn((imageObject: number, buffer: number, buflen: number) => {
      if (imageObject !== imageObjectHandle) {
        return 0;
      }
      if (buffer === 0 && buflen === 0) {
        return input.rawBytes.length;
      }
      heap.set(input.rawBytes, buffer);
      return input.rawBytes.length;
    }),
    FPDFImageObj_GetImageFilterCount: vi.fn((imageObject: number) => (imageObject === imageObjectHandle ? 1 : 0)),
    FPDFImageObj_GetImageFilter: vi.fn((imageObject: number, filterIndex: number, buffer: number, buflen: number) => {
      if (imageObject !== imageObjectHandle || filterIndex !== 0) {
        return 0;
      }
      if (buffer === 0 && buflen === 0) {
        return imageFilterBytes.length;
      }
      heap.set(imageFilterBytes, buffer);
      return imageFilterBytes.length;
    }),
    convertImage: vi.fn(),
  };

  return module;
}

describe('createPdfiumExtractImagesAdapter', () => {
  it('preserves original bytes/mime when preserveOriginal=true', async () => {
    const module = createMockLowLevelModule({
      rawBytes: [1, 2, 3],
      filterName: 'DCTDecode',
      pageObjectTypes: [1, 3],
    });
    const runtime = { load: vi.fn().mockResolvedValue(module) };
    const adapter = createPdfiumExtractImagesAdapter(runtime);

    const result = await adapter.extractImages(
      { id: 'f1', name: 'sample.pdf', bytes: new Uint8Array([9, 8, 7]).buffer },
      { preserveOriginal: true },
    );

    expect(runtime.load).toHaveBeenCalledOnce();
    expect(module.FPDFPage_CountObjects).toHaveBeenCalledWith(21);
    expect(module.FPDFPage_GetObject).toHaveBeenNthCalledWith(1, 21, 0);
    expect(module.FPDFPage_GetObject).toHaveBeenNthCalledWith(2, 21, 1);
    expect(module.FPDFImageObj_GetImageDataRaw).toHaveBeenCalledTimes(2);
    expect(module.FPDFImageObj_GetImageDataRaw).toHaveBeenNthCalledWith(1, 302, 0, 0);
    expect(module.FPDFImageObj_GetImageDataRaw).toHaveBeenNthCalledWith(2, 302, expect.any(Number), 3);
    expect(module.convertImage).not.toHaveBeenCalled();
    expect(result).toEqual([
      {
        name: 'sample-p1-o2-img-1.jpg',
        mime: 'image/jpeg',
        bytes: new Uint8Array([1, 2, 3]),
        metadata: {
          converted: false,
          source: 'jpeg',
          output: 'jpeg',
          sourceEncoding: 'jpeg',
          outputEncoding: 'jpeg',
        },
      },
    ]);
  });

  it('converts when preserveOriginal=false and applies quality', async () => {
    const module = createMockLowLevelModule({
      rawBytes: [9, 9],
      filterName: 'CCITTFaxDecode',
      pageObjectTypes: [3],
    });
    module.convertImage.mockResolvedValue(new Uint8Array([7, 7]));
    const runtime = { load: vi.fn().mockResolvedValue(module) };
    const adapter = createPdfiumExtractImagesAdapter(runtime);

    const result = await adapter.extractImages(
      { id: 'f1', name: 'fax.pdf', bytes: new Uint8Array([1]).buffer },
      { preserveOriginal: false, forceOutputFormat: 'jpg', quality: 82 },
    );

    expect(module.FPDFPage_CountObjects).toHaveBeenCalledWith(21);
    expect(module.FPDFPage_GetObject).toHaveBeenCalledWith(21, 0);
    expect(module.FPDFImageObj_GetImageDataRaw).toHaveBeenCalledTimes(2);
    expect(module.convertImage).toHaveBeenCalledWith(new Uint8Array([9, 9]), 'jpg', 82);
    expect(result).toEqual([
      {
        name: 'fax-p1-o1-img-1.jpg',
        mime: 'image/jpeg',
        bytes: new Uint8Array([7, 7]),
        metadata: {
          converted: true,
          source: 'ccitt',
          output: 'jpg',
          sourceEncoding: 'ccitt',
          outputEncoding: 'jpg',
        },
      },
    ]);
  });

  it('uses low-level extraction even when convertImage is missing', async () => {
    const module = createMockLowLevelModule({
      rawBytes: [0xff, 0xd8, 0xff, 0xdb],
      filterName: 'DCTDecode',
      pageObjectTypes: [3],
    });
    const lowLevelWithoutConvert = {
      ...module,
      convertImage: undefined,
    };
    const runtime = { load: vi.fn().mockResolvedValue(lowLevelWithoutConvert) };
    const adapter = createPdfiumExtractImagesAdapter(runtime);

    const result = await adapter.extractImages(
      { id: 'f1', name: 'scan.pdf', bytes: new Uint8Array([1, 2, 3]).buffer },
      { preserveOriginal: true },
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'scan-p1-o1-img-1.jpg',
      mime: 'image/jpeg',
      metadata: {
        converted: false,
        source: 'jpeg',
        output: 'jpeg',
      },
    });
    expect(lowLevelWithoutConvert.FPDFPage_CountObjects).toHaveBeenCalledWith(21);
  });
});
