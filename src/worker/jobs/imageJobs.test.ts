import { describe, expect, it, vi } from 'vitest';
import type { Artifact, BinaryFile } from '../protocol';
import { runExtractImages } from './extractImagesJob';
import { runPagesToImages } from './pagesToImagesJob';

const SAMPLE_FILE: BinaryFile = {
  id: 'f1',
  name: 'sample.pdf',
  bytes: new ArrayBuffer(0),
};

describe('image jobs', () => {
  it('runExtractImages returns artifacts and reports progress', async () => {
    const artifacts: Artifact[] = [
      { name: 'img-1.png', mime: 'image/png', bytes: new Uint8Array([1, 2, 3]) },
    ];
    const runtime = {
      extractImages: vi.fn().mockResolvedValue(artifacts),
    };
    const onProgress = vi.fn();

    const result = await runExtractImages(
      runtime,
      {
        jobId: 'j-extract',
        type: 'extract-images',
        payload: { file: SAMPLE_FILE, format: 'png', quality: 90 },
      },
      onProgress,
    );

    expect(runtime.extractImages).toHaveBeenCalledWith(SAMPLE_FILE, 'png', 90);
    expect(result).toEqual(artifacts);
    expect(onProgress).toHaveBeenNthCalledWith(1, 0, 1, 'extracting');
    expect(onProgress).toHaveBeenNthCalledWith(2, 1, 1, 'done');
  });

  it('runPagesToImages parses ranges, returns artifacts, and reports progress', async () => {
    const artifacts: Artifact[] = [
      { name: 'page-1.jpg', mime: 'image/jpeg', bytes: new Uint8Array([9]) },
      { name: 'page-3.jpg', mime: 'image/jpeg', bytes: new Uint8Array([8]) },
      { name: 'page-4.jpg', mime: 'image/jpeg', bytes: new Uint8Array([7]) },
    ];
    const runtime = {
      getPageCount: vi.fn().mockResolvedValue(10),
      renderPagesToImages: vi.fn().mockResolvedValue(artifacts),
    };
    const onProgress = vi.fn();

    const result = await runPagesToImages(
      runtime,
      {
        jobId: 'j-pages',
        type: 'pages-to-images',
        payload: {
          file: SAMPLE_FILE,
          ranges: '1,3-4',
          format: 'jpg',
          dpi: 144,
          quality: 80,
        },
      },
      onProgress,
    );

    expect(runtime.getPageCount).toHaveBeenCalledWith(SAMPLE_FILE);
    expect(runtime.renderPagesToImages).toHaveBeenCalledWith(SAMPLE_FILE, [1, 3, 4], 'jpg', 144, 80);
    expect(result).toEqual(artifacts);
    expect(onProgress).toHaveBeenNthCalledWith(1, 0, 2, 'analyzing pages');
    expect(onProgress).toHaveBeenNthCalledWith(2, 1, 2, 'rendering pages');
    expect(onProgress).toHaveBeenNthCalledWith(3, 2, 2, 'done');
  });
});
