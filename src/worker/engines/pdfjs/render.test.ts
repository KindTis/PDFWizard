import { describe, expect, it, vi } from 'vitest';
import type { BinaryFile } from '../../protocol';
import { createPdfJsRenderAdapter } from './render';

const SAMPLE_FILE: BinaryFile = {
  id: 'f1',
  name: 'sample.pdf',
  bytes: new Uint8Array([1, 2, 3]).buffer,
};

describe('createPdfJsRenderAdapter', () => {
  it('loader를 1회만 호출하고 페이지 수를 반환한다', async () => {
    const getDocument = vi.fn().mockReturnValue({
      promise: Promise.resolve({
        numPages: 7,
        getPage: vi.fn(),
      }),
    });
    const load = vi.fn().mockResolvedValue({ getDocument });
    const adapter = createPdfJsRenderAdapter({ load });

    const countA = await adapter.getPageCount(SAMPLE_FILE);
    const countB = await adapter.getPageCount(SAMPLE_FILE);

    expect(countA).toBe(7);
    expect(countB).toBe(7);
    expect(load).toHaveBeenCalledOnce();
    expect(getDocument).toHaveBeenCalledTimes(2);
    expect(getDocument).toHaveBeenNthCalledWith(1, {
      data: new Uint8Array([1, 2, 3]),
      disableWorker: true,
    });
  });

  it('요청한 페이지를 렌더링해 artifact로 반환한다', async () => {
    const renderCalls: Array<{ page: number; width: number; height: number }> = [];
    const canvases: Array<{ id: number }> = [];
    const getPage = vi.fn(async (pageNumber: number) => ({
      getViewport: vi.fn(({ scale }: { scale: number }) => ({
        width: pageNumber * 100 * scale,
        height: pageNumber * 50 * scale,
      })),
      render: vi.fn(({ viewport }: { viewport: { width: number; height: number } }) => {
        renderCalls.push({ page: pageNumber, width: viewport.width, height: viewport.height });
        return { promise: Promise.resolve() };
      }),
    }));
    const getDocument = vi.fn().mockReturnValue({
      promise: Promise.resolve({
        numPages: 10,
        getPage,
      }),
    });
    const load = vi.fn().mockResolvedValue({ getDocument });
    const createCanvas = vi.fn((width: number, height: number) => {
      const canvas = { id: canvases.length + 1, width, height };
      canvases.push(canvas);
      return {
        width,
        height,
        getContext: vi.fn().mockReturnValue({}),
        canvas,
      };
    });
    const encodeCanvas = vi.fn(
      async (_canvas: unknown, _format: 'png' | 'jpg', _quality: number) => new Uint8Array([9, 8, 7]),
    );
    const adapter = createPdfJsRenderAdapter({ load, createCanvas, encodeCanvas });

    const artifacts = await adapter.renderPages(SAMPLE_FILE, [2, 4], {
      format: 'jpg',
      dpi: 144,
      quality: 80,
    });

    expect(artifacts).toEqual([
      { name: 'sample-page-2.jpg', mime: 'image/jpeg', bytes: new Uint8Array([9, 8, 7]) },
      { name: 'sample-page-4.jpg', mime: 'image/jpeg', bytes: new Uint8Array([9, 8, 7]) },
    ]);
    expect(getPage).toHaveBeenNthCalledWith(1, 2);
    expect(getPage).toHaveBeenNthCalledWith(2, 4);
    expect(createCanvas).toHaveBeenNthCalledWith(1, 400, 200);
    expect(createCanvas).toHaveBeenNthCalledWith(2, 800, 400);
    expect(renderCalls).toEqual([
      { page: 2, width: 400, height: 200 },
      { page: 4, width: 800, height: 400 },
    ]);
    expect(encodeCanvas).toHaveBeenCalledTimes(2);
  });
});
