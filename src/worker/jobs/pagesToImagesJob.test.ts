import { describe, expect, it, vi } from 'vitest';
import type { Artifact, BinaryFile } from '../protocol';
import { runPagesToImages } from './pagesToImagesJob';

const SAMPLE_FILE: BinaryFile = {
  id: 'f1',
  name: 'sample.pdf',
  bytes: new ArrayBuffer(0),
};

describe('runPagesToImages', () => {
  it('parsePageRange 결과를 render adapter에 전달한다', async () => {
    const artifacts: Artifact[] = [{ name: 'page-1.png', mime: 'image/png', bytes: new Uint8Array([1]) }];
    const runtime = {
      getPageCount: vi.fn().mockResolvedValue(12),
      renderPages: vi.fn().mockResolvedValue(artifacts),
    };
    const onProgress = vi.fn();

    const result = await runPagesToImages(
      runtime,
      {
        jobId: 'job-pages',
        type: 'pages-to-images',
        payload: {
          file: SAMPLE_FILE,
          ranges: '1,3-4,4',
          format: 'png',
          dpi: 200,
          quality: 90,
        },
      },
      onProgress,
    );

    expect(runtime.getPageCount).toHaveBeenCalledWith(SAMPLE_FILE);
    expect(runtime.renderPages).toHaveBeenCalledWith(SAMPLE_FILE, [1, 3, 4], {
      format: 'png',
      dpi: 200,
      quality: 90,
    });
    expect(result).toEqual(artifacts);
    expect(onProgress).toHaveBeenNthCalledWith(1, 0, 2, 'analyzing pages');
    expect(onProgress).toHaveBeenNthCalledWith(2, 1, 2, 'rendering pages');
    expect(onProgress).toHaveBeenNthCalledWith(3, 2, 2, 'done');
  });

  it('ranges가 all이면 전체 페이지를 렌더링한다', async () => {
    const artifacts: Artifact[] = [{ name: 'page-1.png', mime: 'image/png', bytes: new Uint8Array([1]) }];
    const runtime = {
      getPageCount: vi.fn().mockResolvedValue(4),
      renderPages: vi.fn().mockResolvedValue(artifacts),
    };
    const onProgress = vi.fn();

    const result = await runPagesToImages(
      runtime,
      {
        jobId: 'job-pages-all',
        type: 'pages-to-images',
        payload: {
          file: SAMPLE_FILE,
          ranges: 'all',
          format: 'png',
          dpi: 144,
          quality: 90,
        },
      },
      onProgress,
    );

    expect(runtime.renderPages).toHaveBeenCalledWith(SAMPLE_FILE, [1, 2, 3, 4], {
      format: 'png',
      dpi: 144,
      quality: 90,
    });
    expect(result).toEqual(artifacts);
  });
});
