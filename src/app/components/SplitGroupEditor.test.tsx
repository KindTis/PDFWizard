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
        groupCount: 0,
        latestRange: '1-5',
        mergedRange: '1-5',
      }),
    );
  });

  it('시작/끝 범위를 시각적으로 설정해 그룹을 추가한다', () => {
    const onStatusChange = vi.fn();
    render(<SplitGroupEditor uploadedFileCount={1} totalPages={13} onStatusChange={onStatusChange} />);

    expect(screen.getByText('전체 페이지: 13')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('시작 페이지'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('끝 페이지'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: '범위 추가' }));

    expect(screen.getByText('그룹 1: 2-6')).toBeInTheDocument();
    expect(onStatusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        groupCount: 1,
        latestRange: '2-6',
        mergedRange: '2-6',
      }),
    );
  });
});
