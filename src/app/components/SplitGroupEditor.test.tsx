import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SplitGroupEditor from './SplitGroupEditor';

describe('SplitGroupEditor', () => {
  it('그룹 추가 없이도 현재 선택 범위를 상태에 반영한다', () => {
    const onStatusChange = vi.fn();
    render(<SplitGroupEditor uploadedFileCount={1} totalPages={13} onStatusChange={onStatusChange} />);

    fireEvent.change(screen.getByLabelText('시작 페이지'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('끝 페이지'), { target: { value: '5' } });

    expect(onStatusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        groupCount: 1,
        latestRange: '1-5',
        mergedRange: '1-5',
      }),
    );
  });

  it('시작/끝 범위를 시각적으로 설정해 단일 범위를 갱신한다', () => {
    const onStatusChange = vi.fn();
    render(<SplitGroupEditor uploadedFileCount={1} totalPages={13} onStatusChange={onStatusChange} />);

    expect(screen.getByLabelText('시작 페이지')).toHaveAttribute('max', '13');
    expect(screen.getByLabelText('끝 페이지')).toHaveAttribute('max', '13');
    fireEvent.change(screen.getByLabelText('시작 페이지'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('끝 페이지'), { target: { value: '6' } });

    expect(screen.getByText('2-6 (총 5페이지)')).toBeInTheDocument();
    expect(onStatusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        groupCount: 1,
        latestRange: '2-6',
        mergedRange: '2-6',
      }),
    );
  });
});
