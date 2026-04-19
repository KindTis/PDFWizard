import { describe, expect, it, vi } from 'vitest';
import type { BinaryFile } from '../protocol';
import { runExtractImages } from './extractImagesJob';

const SAMPLE_FILE: BinaryFile = {
  id: 'f1',
  name: 'sample.pdf',
  bytes: new ArrayBuffer(0),
};

describe('runExtractImages', () => {
  it('uses modern payload path as default for new extractImages payload', async () => {
    const runtime = {
      extractImages: vi.fn().mockResolvedValue([]),
    };
    const onProgress = vi.fn();

    await runExtractImages(
      runtime,
      {
        jobId: 'j1',
        type: 'extract-images',
        payload: {
          file: SAMPLE_FILE,
          preserveOriginal: true,
        },
      },
      onProgress,
    );

    expect(runtime.extractImages).toHaveBeenCalledWith(SAMPLE_FILE, {
      preserveOriginal: true,
      forceOutputFormat: undefined,
      quality: undefined,
    });
    expect(onProgress).toHaveBeenNthCalledWith(1, 0, 1, 'extracting');
    expect(onProgress).toHaveBeenNthCalledWith(2, 1, 1, 'done');
  });

  it('keeps compatibility with legacy runtime signature', async () => {
    const runtime = {
      extractImages: vi.fn().mockResolvedValue([]),
    };
    Object.defineProperty(runtime.extractImages, 'length', { value: 3 });

    await runExtractImages(
      runtime,
      {
        jobId: 'j2',
        type: 'extract-images',
        payload: {
          file: SAMPLE_FILE,
          preserveOriginal: false,
          forceOutputFormat: 'jpg',
          quality: 61,
        },
      },
      vi.fn(),
    );

    expect(runtime.extractImages).toHaveBeenCalledWith(SAMPLE_FILE, 'jpg', 61);
  });
});
