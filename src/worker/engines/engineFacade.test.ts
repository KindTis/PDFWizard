import { describe, expect, it, vi } from 'vitest';
import { createEngineFacade } from './engineFacade';

describe('EngineFacade', () => {
  it('routes merge and split to pdfium adapter', async () => {
    const pdfium = {
      merge: vi.fn().mockResolvedValue([]),
      split: vi.fn().mockResolvedValue([]),
      extractImages: vi.fn().mockResolvedValue([]),
    };
    const pdfjs = {
      getPageCount: vi.fn().mockResolvedValue(1),
      renderPages: vi.fn().mockResolvedValue([]),
    };
    const facade = createEngineFacade({ pdfium, pdfjs });
    const file = { id: 'a', name: 'a.pdf', bytes: new ArrayBuffer(0) };

    await facade.merge([file], {});
    await facade.split(file, '1');

    expect(pdfium.merge).toHaveBeenCalledOnce();
    expect(pdfium.split).toHaveBeenCalledOnce();
  });

  it('routes extract and render to corresponding adapters', async () => {
    const pdfium = {
      merge: vi.fn().mockResolvedValue([]),
      split: vi.fn().mockResolvedValue([]),
      extractImages: vi.fn().mockResolvedValue([]),
    };
    const pdfjs = {
      getPageCount: vi.fn().mockResolvedValue(3),
      renderPages: vi.fn().mockResolvedValue([]),
    };
    const facade = createEngineFacade({ pdfium, pdfjs });
    const file = { id: 'a', name: 'a.pdf', bytes: new ArrayBuffer(0) };

    await facade.extractImages(file, { preserveOriginal: true });
    await facade.getPageCount(file);
    await facade.renderPages(file, [1], { format: 'png', dpi: 144, quality: 90 });

    expect(pdfium.extractImages).toHaveBeenCalledOnce();
    expect(pdfjs.getPageCount).toHaveBeenCalledOnce();
    expect(pdfjs.renderPages).toHaveBeenCalledOnce();
  });
});
