import { describe, expect, it, vi } from 'vitest';
import type { PdfiumRuntime } from './runtime';
import { createPdfiumMergeSplitAdapter } from './mergeSplit';

describe('createPdfiumMergeSplitAdapter', () => {
  it('merge: FPDF_ImportPages/PDFiumExt_SaveAsCopy 호출 시퀀스로 merged.pdf를 만든다', async () => {
    const callSequence: string[] = [];
    const heap = new Uint8Array(256);
    let nextPtr = 16;

    const malloc = vi.fn((size: number) => {
      const ptr = nextPtr;
      nextPtr += size + 1;
      callSequence.push(`malloc:${size}`);
      return ptr;
    });
    const free = vi.fn((ptr: number) => {
      callSequence.push(`free:${ptr}`);
    });

    const sourceDocs = [101, 102];
    let mergedPageCount = 0;
    const savedBytes = new Uint8Array([1, 2, 3]);

    const module = {
      pdfium: {
        HEAPU8: heap,
        wasmExports: {
          malloc,
          free,
        },
      },
      FPDF_LoadMemDocument: vi.fn((ptr: number, size: number) => {
        callSequence.push(`load:${ptr}:${size}`);
        return sourceDocs.shift() ?? 0;
      }),
      FPDF_CreateNewDocument: vi.fn(() => {
        callSequence.push('create');
        return 900;
      }),
      FPDF_ImportPages: vi.fn((destDoc: number, srcDoc: number, range: string, index: number) => {
        callSequence.push(`import:${destDoc}:${srcDoc}:${range}:${index}`);
        if (range === '1-2') {
          mergedPageCount += 2;
        }
        return true;
      }),
      FPDF_GetPageCount: vi.fn((doc: number) => {
        if (doc === 900) {
          callSequence.push(`count:dest:${mergedPageCount}`);
          return mergedPageCount;
        }
        callSequence.push(`count:src:${doc}:2`);
        return 2;
      }),
      FPDF_CloseDocument: vi.fn((doc: number) => {
        callSequence.push(`close:${doc}`);
      }),
      PDFiumExt_OpenFileWriter: vi.fn(() => {
        callSequence.push('writer-open:700');
        return 700;
      }),
      PDFiumExt_SaveAsCopy: vi.fn((doc: number, writer: number) => {
        callSequence.push(`save:${doc}:${writer}`);
        return 1;
      }),
      PDFiumExt_GetFileWriterSize: vi.fn((writer: number) => {
        callSequence.push(`writer-size:${writer}`);
        return savedBytes.length;
      }),
      PDFiumExt_GetFileWriterData: vi.fn((writer: number, dataPtr: number, size: number) => {
        callSequence.push(`writer-data:${writer}:${size}`);
        heap.set(savedBytes, dataPtr);
        return size;
      }),
      PDFiumExt_CloseFileWriter: vi.fn((writer: number) => {
        callSequence.push(`writer-close:${writer}`);
      }),
    };
    const runtime: PdfiumRuntime = {
      load: vi.fn().mockResolvedValue(module as unknown as Awaited<ReturnType<PdfiumRuntime['load']>>),
    };

    const adapter = createPdfiumMergeSplitAdapter(runtime);
    const files = [
      { id: 'a', name: 'a.pdf', bytes: new Uint8Array([10]).buffer },
      { id: 'b', name: 'b.pdf', bytes: new Uint8Array([20, 30]).buffer },
    ];

    const result = await adapter.merge(files, { a: '1-2', b: 'all' });

    expect(runtime.load).toHaveBeenCalledOnce();
    expect(module.FPDF_ImportPages).toHaveBeenNthCalledWith(1, 900, 101, '1-2', 0);
    expect(module.FPDF_ImportPages).toHaveBeenNthCalledWith(2, 900, 102, '1-2', 2);
    expect(module.PDFiumExt_OpenFileWriter).toHaveBeenCalledOnce();
    expect(module.PDFiumExt_SaveAsCopy).toHaveBeenCalledWith(900, 700);
    expect(result).toEqual([
      {
        name: 'merged.pdf',
        mime: 'application/pdf',
        bytes: savedBytes,
      },
    ]);
    expect(callSequence).toEqual([
      'create',
      'malloc:1',
      'load:16:1',
      'count:dest:0',
      'import:900:101:1-2:0',
      'close:101',
      'free:16',
      'malloc:2',
      'load:18:2',
      'count:src:102:2',
      'count:dest:2',
      'import:900:102:1-2:2',
      'close:102',
      'free:18',
      'writer-open:700',
      'save:900:700',
      'writer-size:700',
      'malloc:3',
      'writer-data:700:3',
      'free:21',
      'writer-close:700',
      'close:900',
    ]);
  });

  it('split: 각 range 토큰별로 ImportPages/SaveAsCopy 시퀀스를 수행한다', async () => {
    const callSequence: string[] = [];
    const heap = new Uint8Array(256);
    let nextPtr = 40;
    const writerBytes = new Map<number, Uint8Array>([
      [801, new Uint8Array([7])],
      [802, new Uint8Array([8, 9])],
    ]);

    const malloc = vi.fn((size: number) => {
      const ptr = nextPtr;
      nextPtr += size + 2;
      callSequence.push(`malloc:${size}`);
      return ptr;
    });
    const free = vi.fn((ptr: number) => {
      callSequence.push(`free:${ptr}`);
    });

    const partDocs = [601, 602];
    const writers = [801, 802];
    const module = {
      pdfium: {
        HEAPU8: heap,
        wasmExports: {
          malloc,
          free,
        },
      },
      FPDF_LoadMemDocument: vi.fn((ptr: number, size: number) => {
        callSequence.push(`load:${ptr}:${size}`);
        return 501;
      }),
      FPDF_CreateNewDocument: vi.fn(() => {
        const doc = partDocs.shift() ?? 0;
        callSequence.push(`create:${doc}`);
        return doc;
      }),
      FPDF_ImportPages: vi.fn((destDoc: number, srcDoc: number, range: string, index: number) => {
        callSequence.push(`import:${destDoc}:${srcDoc}:${range}:${index}`);
        return true;
      }),
      FPDF_GetPageCount: vi.fn((doc: number) => {
        callSequence.push(`count:${doc}:0`);
        return 0;
      }),
      FPDF_CloseDocument: vi.fn((doc: number) => {
        callSequence.push(`close:${doc}`);
      }),
      PDFiumExt_OpenFileWriter: vi.fn(() => {
        const writer = writers.shift() ?? 0;
        callSequence.push(`writer-open:${writer}`);
        return writer;
      }),
      PDFiumExt_SaveAsCopy: vi.fn((doc: number, writer: number) => {
        callSequence.push(`save:${doc}:${writer}`);
        return writer === 0 ? 0 : 1;
      }),
      PDFiumExt_GetFileWriterSize: vi.fn((writer: number) => {
        callSequence.push(`writer-size:${writer}`);
        return writerBytes.get(writer)?.length ?? 0;
      }),
      PDFiumExt_GetFileWriterData: vi.fn((writer: number, dataPtr: number, size: number) => {
        callSequence.push(`writer-data:${writer}:${size}`);
        const bytes = writerBytes.get(writer) ?? new Uint8Array(0);
        heap.set(bytes, dataPtr);
        return size;
      }),
      PDFiumExt_CloseFileWriter: vi.fn((writer: number) => {
        callSequence.push(`writer-close:${writer}`);
      }),
    };
    const runtime: PdfiumRuntime = {
      load: vi.fn().mockResolvedValue(module as unknown as Awaited<ReturnType<PdfiumRuntime['load']>>),
    };

    const adapter = createPdfiumMergeSplitAdapter(runtime);
    const file = {
      id: 'src',
      name: 'source.pdf',
      bytes: new Uint8Array([99, 100]).buffer,
    };

    const result = await adapter.split(file, '1,3-4');

    expect(runtime.load).toHaveBeenCalledOnce();
    expect(module.FPDF_ImportPages).toHaveBeenNthCalledWith(1, 601, 501, '1', 0);
    expect(module.FPDF_ImportPages).toHaveBeenNthCalledWith(2, 602, 501, '3-4', 0);
    expect(module.PDFiumExt_SaveAsCopy).toHaveBeenNthCalledWith(1, 601, 801);
    expect(module.PDFiumExt_SaveAsCopy).toHaveBeenNthCalledWith(2, 602, 802);
    expect(result).toEqual([
      { name: 'source-part-1.pdf', mime: 'application/pdf', bytes: new Uint8Array([7]) },
      { name: 'source-part-2.pdf', mime: 'application/pdf', bytes: new Uint8Array([8, 9]) },
    ]);
    expect(callSequence).toEqual([
      'malloc:2',
      'load:40:2',
      'create:601',
      'count:601:0',
      'import:601:501:1:0',
      'writer-open:801',
      'save:601:801',
      'writer-size:801',
      'malloc:1',
      'writer-data:801:1',
      'free:44',
      'writer-close:801',
      'close:601',
      'create:602',
      'count:602:0',
      'import:602:501:3-4:0',
      'writer-open:802',
      'save:602:802',
      'writer-size:802',
      'malloc:2',
      'writer-data:802:2',
      'free:47',
      'writer-close:802',
      'close:602',
      'close:501',
      'free:40',
    ]);
  });

  it('splitGroups: 여러 PDF의 세그먼트를 그룹별 part PDF로 저장한다', async () => {
    const heap = new Uint8Array(512);
    let nextPtr = 64;
    const sourceDocs = [501, 502, 503];
    const partDocs = [601, 602];
    const writerBytes = [new Uint8Array([7]), new Uint8Array([8, 9])];
    const writerForDoc = new Map<number, number>();
    const partPageCounts = new Map<number, number>([
      [601, 0],
      [602, 0],
    ]);

    const module = {
      pdfium: {
        HEAPU8: heap,
        wasmExports: {
          malloc: vi.fn((size: number) => {
            const ptr = nextPtr;
            nextPtr += size + 1;
            return ptr;
          }),
          free: vi.fn(),
        },
      },
      FPDF_LoadMemDocument: vi.fn(() => sourceDocs.shift() ?? 0),
      FPDF_CreateNewDocument: vi.fn(() => partDocs.shift() ?? 0),
      FPDF_ImportPages: vi.fn((destDoc: number, _srcDoc: number, range: string) => {
        const [startToken, endToken] = range.split('-');
        const importedPages = endToken ? Number(endToken) - Number(startToken) + 1 : 1;
        partPageCounts.set(destDoc, (partPageCounts.get(destDoc) ?? 0) + importedPages);
        return true;
      }),
      FPDF_GetPageCount: vi.fn((doc: number) => {
        if (partPageCounts.has(doc)) {
          return partPageCounts.get(doc) ?? 0;
        }
        if (doc === 501) return 3;
        if (doc === 502 || doc === 503) return 5;
        return 0;
      }),
      FPDF_CloseDocument: vi.fn(),
      PDFiumExt_OpenFileWriter: vi.fn(() => 800 + writerForDoc.size + 1),
      PDFiumExt_SaveAsCopy: vi.fn((doc: number, writer: number) => {
        writerForDoc.set(writer, doc);
        return 1;
      }),
      PDFiumExt_GetFileWriterSize: vi.fn((writer: number) => {
        const index = writer - 801;
        return writerBytes[index]?.length ?? 0;
      }),
      PDFiumExt_GetFileWriterData: vi.fn((writer: number, dataPtr: number, size: number) => {
        const index = writer - 801;
        const bytes = writerBytes[index] ?? new Uint8Array();
        heap.set(bytes, dataPtr);
        return size;
      }),
      PDFiumExt_CloseFileWriter: vi.fn(),
    };
    const runtime: PdfiumRuntime = {
      load: vi.fn().mockResolvedValue(module as unknown as Awaited<ReturnType<PdfiumRuntime['load']>>),
    };
    const adapter = createPdfiumMergeSplitAdapter(runtime);

    const result = await adapter.splitGroups(
      [
        { id: 'a', name: 'A.pdf', bytes: new Uint8Array([1]).buffer },
        { id: 'b', name: 'B.pdf', bytes: new Uint8Array([2]).buffer },
      ],
      [
        {
          id: 'group-1',
          label: 'split-part-1',
          globalRange: '1-2',
          segments: [{ fileId: 'a', startPage: 1, endPage: 2 }],
        },
        {
          id: 'group-2',
          label: 'split-part-2',
          globalRange: '3-8',
          segments: [
            { fileId: 'a', startPage: 3, endPage: 3 },
            { fileId: 'b', startPage: 1, endPage: 5 },
          ],
        },
      ],
    );

    expect(module.FPDF_ImportPages).toHaveBeenNthCalledWith(1, 601, 501, '1-2', 0);
    expect(module.FPDF_ImportPages).toHaveBeenNthCalledWith(2, 602, 502, '3', 0);
    expect(module.FPDF_ImportPages).toHaveBeenNthCalledWith(3, 602, 503, '1-5', 1);
    expect(result).toEqual([
      { name: 'split-part-1.pdf', mime: 'application/pdf', bytes: new Uint8Array([7]) },
      { name: 'split-part-2.pdf', mime: 'application/pdf', bytes: new Uint8Array([8, 9]) },
    ]);
  });
});
