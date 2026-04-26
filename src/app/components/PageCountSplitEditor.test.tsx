import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PageCountSplitEditor from './PageCountSplitEditor';

const files = [{ id: 'a', name: 'A.pdf', bytes: new ArrayBuffer(8), pageCount: 10 }];

describe('PageCountSplitEditor', () => {
  it('emits automatic split groups from the page count input', () => {
    const onStatusChange = vi.fn();
    render(<PageCountSplitEditor uploadedFiles={files} onStatusChange={onStatusChange} />);

    fireEvent.change(screen.getByLabelText('분할 단위'), { target: { value: '4' } });

    expect(screen.getByText('전체 1-4 · A.pdf 1-4페이지 · 총 4페이지')).toBeInTheDocument();
    expect(screen.getByText('전체 9-10 · A.pdf 9-10페이지 · 총 2페이지')).toBeInTheDocument();
    expect(onStatusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        groupCount: 3,
        latestRange: '1-4',
        mergedRange: '1-4,5-8,9-10',
      }),
    );
  });

  it('shows a validation message and clears groups for invalid input', () => {
    const onStatusChange = vi.fn();
    render(<PageCountSplitEditor uploadedFiles={files} onStatusChange={onStatusChange} />);

    fireEvent.change(screen.getByLabelText('분할 단위'), { target: { value: '0' } });

    expect(screen.getByText('분할 단위는 1 이상의 정수여야 합니다.')).toBeInTheDocument();
    expect(onStatusChange).toHaveBeenLastCalledWith({
      groupCount: 0,
      latestRange: null,
      mergedRange: null,
      groups: [],
      previewGroups: [],
    });
  });
});
