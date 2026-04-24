import { fireEvent, render, screen } from '@testing-library/react';
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
  it('does not render inactive undo, redo, or view toggle controls', () => {
    render(
      <ThumbnailWorkspace
        uploadedFileCount={1}
        primaryPdfPageCount={1}
        primaryFileSizeBytes={1024}
        uploadedFileNames={['single.pdf']}
        thumbnails={[createThumbnail({ fileId: 'solo', fileName: 'single.pdf', fileIndex: 0, pageNumber: 1 })]}
        isThumbnailLoading={false}
        thumbnailError={null}
        onFilesSelected={() => {}}
        selectedRange={null}
      />,
    );

    expect(screen.queryByRole('button', { name: '실행 취소' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 실행' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '그리드 보기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '목록 보기' })).not.toBeInTheDocument();
  });

  it('changes thumbnail grid scale with zoom controls', () => {
    render(
      <ThumbnailWorkspace
        uploadedFileCount={1}
        primaryPdfPageCount={1}
        primaryFileSizeBytes={1024}
        uploadedFileNames={['single.pdf']}
        thumbnails={[createThumbnail({ fileId: 'solo', fileName: 'single.pdf', fileIndex: 0, pageNumber: 1 })]}
        isThumbnailLoading={false}
        thumbnailError={null}
        onFilesSelected={() => {}}
        selectedRange={null}
      />,
    );

    const grid = screen.getByLabelText('PDF 페이지 썸네일 목록');
    const slider = screen.getByLabelText('줌 비율') as HTMLInputElement;

    expect(slider).toHaveValue('100');
    expect(grid).toHaveStyle({ '--thumbnail-card-min-width': '170px' });

    fireEvent.click(screen.getByRole('button', { name: '확대' }));

    expect(slider).toHaveValue('110');
    expect(grid).toHaveStyle({ '--thumbnail-card-min-width': '187px' });

    fireEvent.click(screen.getByRole('button', { name: '축소' }));

    expect(slider).toHaveValue('100');
    expect(grid).toHaveStyle({ '--thumbnail-card-min-width': '170px' });

    fireEvent.change(slider, { target: { value: '140' } });

    expect(slider).toHaveValue('140');
    expect(grid).toHaveStyle({ '--thumbnail-card-min-width': '238px' });
  });

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
