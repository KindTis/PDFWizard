import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ThumbnailWorkspace from './ThumbnailWorkspace';
import type { ThumbnailPreview } from '../hooks/usePdfWorkflow';

function createThumbnail(
  overrides: Partial<ThumbnailPreview> & { pageNumber: number; fileId: string; fileName: string; fileIndex: number },
): ThumbnailPreview {
  return {
    pageNumber: overrides.pageNumber,
    fileId: overrides.fileId,
    fileName: overrides.fileName,
    fileIndex: overrides.fileIndex,
    imageUrl: null,
    status: 'ready',
  } as ThumbnailPreview;
}

describe('ThumbnailWorkspace', () => {
  it('renders a separator at the point where another PDF starts', () => {
    const thumbnails = [
      createThumbnail({ fileId: 'a', fileName: 'first.pdf', fileIndex: 0, pageNumber: 1 }),
      createThumbnail({ fileId: 'a', fileName: 'first.pdf', fileIndex: 0, pageNumber: 2 }),
      createThumbnail({ fileId: 'b', fileName: 'second.pdf', fileIndex: 1, pageNumber: 1 }),
      createThumbnail({ fileId: 'b', fileName: 'second.pdf', fileIndex: 1, pageNumber: 2 }),
    ];

    render(
      <ThumbnailWorkspace
        uploadedFileCount={2}
        primaryPdfPageCount={2}
        primaryFileSizeBytes={1024}
        uploadedFileNames={['first.pdf', 'second.pdf']}
        thumbnails={thumbnails}
        isThumbnailLoading={false}
        thumbnailError={null}
        onFilesSelected={() => {}}
        selectedRange={null}
      />,
    );

    expect(screen.getByText('first.pdf 시작')).toBeInTheDocument();
    expect(screen.getByText('second.pdf 시작')).toBeInTheDocument();
  });

  it('does not render separators when only one PDF is uploaded', () => {
    const thumbnails = [
      createThumbnail({ fileId: 'solo', fileName: 'single.pdf', fileIndex: 0, pageNumber: 1 }),
      createThumbnail({ fileId: 'solo', fileName: 'single.pdf', fileIndex: 0, pageNumber: 2 }),
    ];

    render(
      <ThumbnailWorkspace
        uploadedFileCount={1}
        primaryPdfPageCount={2}
        primaryFileSizeBytes={1024}
        uploadedFileNames={['single.pdf']}
        thumbnails={thumbnails}
        isThumbnailLoading={false}
        thumbnailError={null}
        onFilesSelected={() => {}}
        selectedRange={null}
      />,
    );

    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });
});
