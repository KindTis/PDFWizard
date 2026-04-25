import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegisteredPdf } from '../state/fileRegistry';
import { useAppStore } from '../state/store';
import ActionPanel from './ActionPanel';

function createUploadedFile(id: string, name: string): RegisteredPdf {
  return {
    id,
    name,
    bytes: new ArrayBuffer(8),
    pageCount: 2,
  };
}

describe('ActionPanel merge order', () => {
  beforeEach(() => {
    useAppStore.getState().reset();
    useAppStore.getState().setJobType('merge');
  });

  it('shows a drag order box for multiple uploaded files in merge mode', () => {
    render(
      <ActionPanel
        uploadedFileCount={2}
        uploadedFileName="a.pdf"
        uploadedFiles={[createUploadedFile('a', 'a.pdf'), createUploadedFile('b', 'b.pdf')]}
        primaryPdfPageCount={2}
        splitGroupStatus={{ groupCount: 0, latestRange: null, mergedRange: null, groups: [], previewGroups: [] }}
        onSplitGroupStatusChange={() => {}}
        onAddUploadedFiles={vi.fn()}
        onRemoveUploadedFile={vi.fn()}
        onReorderUploadedFiles={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('병합 파일 순서')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PDF 추가' })).toBeInTheDocument();
    expect(screen.getByText('a.pdf')).toBeInTheDocument();
    expect(screen.getByText('b.pdf')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /순서 이동/ })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'a.pdf 제거' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'b.pdf 제거' })).toBeInTheDocument();
  });

  it('requests removal for the selected merge file', () => {
    const onRemoveUploadedFile = vi.fn();

    render(
      <ActionPanel
        uploadedFileCount={2}
        uploadedFileName="a.pdf"
        uploadedFiles={[createUploadedFile('a', 'a.pdf'), createUploadedFile('b', 'b.pdf')]}
        primaryPdfPageCount={2}
        splitGroupStatus={{ groupCount: 0, latestRange: null, mergedRange: null, groups: [], previewGroups: [] }}
        onSplitGroupStatusChange={() => {}}
        onAddUploadedFiles={vi.fn()}
        onRemoveUploadedFile={onRemoveUploadedFile}
        onReorderUploadedFiles={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'b.pdf 제거' }));

    expect(onRemoveUploadedFile).toHaveBeenCalledWith('b');
  });

  it('shows a hint instead of drag list when only one file is uploaded', () => {
    render(
      <ActionPanel
        uploadedFileCount={1}
        uploadedFileName="single.pdf"
        uploadedFiles={[createUploadedFile('single', 'single.pdf')]}
        primaryPdfPageCount={2}
        splitGroupStatus={{ groupCount: 0, latestRange: null, mergedRange: null, groups: [], previewGroups: [] }}
        onSplitGroupStatusChange={() => {}}
        onAddUploadedFiles={vi.fn()}
        onRemoveUploadedFile={vi.fn()}
        onReorderUploadedFiles={vi.fn()}
      />,
    );

    expect(screen.getByText('PDF를 2개 이상 업로드하면 순서를 조정하고 병합을 실행할 수 있습니다.')).toBeInTheDocument();
  });
});
