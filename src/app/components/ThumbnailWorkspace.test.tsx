import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ThumbnailWorkspace from './ThumbnailWorkspace';
import type { ThumbnailPreview } from '../hooks/usePdfWorkflow';
import { useAppStore } from '../state/store';

function createThumbnail(
  overrides: Partial<ThumbnailPreview> & { pageNumber: number; fileId: string; fileName: string; fileIndex: number },
): ThumbnailPreview {
  return {
    pageNumber: overrides.pageNumber,
    fileId: overrides.fileId,
    fileName: overrides.fileName,
    fileIndex: overrides.fileIndex,
    imageUrl: null,
    globalPageNumber: overrides.globalPageNumber ?? overrides.fileIndex * 2 + overrides.pageNumber,
    status: 'ready',
  } as ThumbnailPreview;
}

describe('ThumbnailWorkspace', () => {
  afterEach(() => {
    act(() => {
      useAppStore.getState().reset();
    });
  });

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
        selectedGroups={[]}
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
        selectedGroups={[]}
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
        selectedGroups={[]}
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
        selectedGroups={[]}
      />,
    );

    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('keeps local page labels and shows global labels for split mode with multiple PDFs', () => {
    act(() => {
      useAppStore.getState().setJobType('split');
    });
    const thumbnails = [
      createThumbnail({ fileId: 'a', fileName: 'first.pdf', fileIndex: 0, pageNumber: 3, globalPageNumber: 3 }),
      createThumbnail({ fileId: 'b', fileName: 'second.pdf', fileIndex: 1, pageNumber: 1, globalPageNumber: 4 }),
    ];

    render(
      <ThumbnailWorkspace
        uploadedFileCount={2}
        primaryPdfPageCount={3}
        primaryFileSizeBytes={1024}
        uploadedFileNames={['first.pdf', 'second.pdf']}
        thumbnails={thumbnails}
        isThumbnailLoading={false}
        thumbnailError={null}
        onFilesSelected={() => {}}
        selectedRange="3-4"
        selectedGroups={[
          {
            id: 'group-1',
            label: 'split-part-1',
            globalRange: '3-4',
            segments: [
              { fileId: 'a', startPage: 3, endPage: 3 },
              { fileId: 'b', startPage: 1, endPage: 1 },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('전체 3')).toBeInTheDocument();
    expect(screen.getByText('전체 4')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').filter((item) => item.className.includes('is-in-range'))).toHaveLength(2);
  });

  it('shows split group badges on highlighted thumbnails', () => {
    act(() => {
      useAppStore.getState().setJobType('split');
    });
    const thumbnails = [
      createThumbnail({ fileId: 'a', fileName: 'first.pdf', fileIndex: 0, pageNumber: 3, globalPageNumber: 3 }),
      createThumbnail({ fileId: 'b', fileName: 'second.pdf', fileIndex: 1, pageNumber: 1, globalPageNumber: 4 }),
    ];

    render(
      <ThumbnailWorkspace
        uploadedFileCount={2}
        primaryPdfPageCount={3}
        primaryFileSizeBytes={1024}
        uploadedFileNames={['first.pdf', 'second.pdf']}
        thumbnails={thumbnails}
        isThumbnailLoading={false}
        thumbnailError={null}
        onFilesSelected={() => {}}
        selectedRange="3-4"
        selectedGroups={[
          {
            id: 'group-1',
            label: 'split-part-1',
            globalRange: '3',
            segments: [{ fileId: 'a', startPage: 3, endPage: 3 }],
          },
          {
            id: 'group-2',
            label: 'split-part-2',
            globalRange: '3-4',
            segments: [
              { fileId: 'a', startPage: 3, endPage: 3 },
              { fileId: 'b', startPage: 1, endPage: 1 },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByLabelText('first.pdf 3페이지 분할 그룹')).toHaveTextContent('G1');
    expect(screen.getByLabelText('first.pdf 3페이지 분할 그룹')).toHaveTextContent('G2');
    expect(screen.getByLabelText('second.pdf 1페이지 분할 그룹')).toHaveTextContent('G2');
  });

  it('hides split group badges when the active job is not split', () => {
    act(() => {
      useAppStore.getState().setJobType('merge');
    });
    const thumbnails = [
      createThumbnail({ fileId: 'a', fileName: 'first.pdf', fileIndex: 0, pageNumber: 3, globalPageNumber: 3 }),
      createThumbnail({ fileId: 'b', fileName: 'second.pdf', fileIndex: 1, pageNumber: 1, globalPageNumber: 4 }),
    ];

    render(
      <ThumbnailWorkspace
        uploadedFileCount={2}
        primaryPdfPageCount={3}
        primaryFileSizeBytes={1024}
        uploadedFileNames={['first.pdf', 'second.pdf']}
        thumbnails={thumbnails}
        isThumbnailLoading={false}
        thumbnailError={null}
        onFilesSelected={() => {}}
        selectedRange="3-4"
        selectedGroups={[
          {
            id: 'group-1',
            label: 'split-part-1',
            globalRange: '3-4',
            segments: [
              { fileId: 'a', startPage: 3, endPage: 3 },
              { fileId: 'b', startPage: 1, endPage: 1 },
            ],
          },
        ]}
      />,
    );

    expect(screen.queryByLabelText('first.pdf 3페이지 분할 그룹')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('second.pdf 1페이지 분할 그룹')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem').filter((item) => item.className.includes('is-in-range'))).toHaveLength(0);
  });
});
