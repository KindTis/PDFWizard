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

describe('ActionPanel split mode', () => {
  beforeEach(() => {
    useAppStore.getState().reset();
    useAppStore.getState().setJobType('split');
  });

  it('enables page-count split mode and emits generated groups', () => {
    const onSplitGroupStatusChange = vi.fn();

    render(
      <ActionPanel
        uploadedFileCount={1}
        uploadedFileName="single.pdf"
        uploadedFiles={[{ id: 'single', name: 'single.pdf', bytes: new ArrayBuffer(8), pageCount: 10 }]}
        primaryPdfPageCount={10}
        splitGroupStatus={{ groupCount: 0, latestRange: null, mergedRange: null, groups: [], previewGroups: [] }}
        onSplitGroupStatusChange={onSplitGroupStatusChange}
        onAddUploadedFiles={vi.fn()}
        onRemoveUploadedFile={vi.fn()}
        onReorderUploadedFiles={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '페이지 수로 분할' }));
    fireEvent.change(screen.getByLabelText('분할 단위'), { target: { value: '4' } });

    expect(screen.getByRole('button', { name: '페이지 수로 분할' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('전체 9-10 · single.pdf 9-10페이지 · 총 2페이지')).toBeInTheDocument();
    expect(onSplitGroupStatusChange).toHaveBeenLastCalledWith(expect.objectContaining({ groupCount: 3, mergedRange: '1-4,5-8,9-10' }));
  });
});
