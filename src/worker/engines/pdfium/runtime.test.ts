import { describe, expect, it, vi } from 'vitest';
import { createPdfiumRuntime } from './runtime';

describe('createPdfiumRuntime', () => {
  it('loads runtime once and returns stable instance', async () => {
    const loader = vi.fn().mockResolvedValue({
      merge: vi.fn(),
      split: vi.fn(),
      extractImages: vi.fn(),
      convertImage: vi.fn(),
    });
    const runtime = createPdfiumRuntime(loader);
    const a = await runtime.load();
    const b = await runtime.load();

    expect(loader).toHaveBeenCalledOnce();
    expect(a).toBe(b);
  });
});
