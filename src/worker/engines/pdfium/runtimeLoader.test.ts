import { describe, expect, it, vi } from 'vitest';
import { createPdfiumRuntimeLoader } from './runtimeLoader';

describe('createPdfiumRuntimeLoader', () => {
  it('initializes @embedpdf/pdfium once and reuses module', async () => {
    const init = vi.fn().mockResolvedValue({ PDFiumExt_Init: vi.fn() });
    const fetchWasm = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);

    const loader = createPdfiumRuntimeLoader({ init, fetchWasm });
    const a = await loader.load();
    const b = await loader.load();

    expect(init).toHaveBeenCalledOnce();
    expect(a).toBe(b);
  });
});
