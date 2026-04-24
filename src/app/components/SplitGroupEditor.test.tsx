import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SplitGroupEditor from './SplitGroupEditor';

const singleFile = [{ id: 'single', name: 'single.pdf', bytes: new ArrayBuffer(8), pageCount: 13 }];

describe('SplitGroupEditor', () => {
  it('그룹 추가 없이도 현재 선택 범위를 상태에 반영한다', () => {
    const onStatusChange = vi.fn();
    render(<SplitGroupEditor uploadedFiles={singleFile} onStatusChange={onStatusChange} />);

    fireEvent.change(screen.getByLabelText('전체 시작 페이지'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('전체 끝 페이지'), { target: { value: '5' } });

    expect(onStatusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        groupCount: 1,
        latestRange: '1-5',
        mergedRange: '1-5',
        groups: [
          {
            id: 'split-group-1',
            label: 'split-part-1',
            globalRange: '1-5',
            segments: [{ fileId: 'single', startPage: 1, endPage: 5 }],
          },
        ],
      }),
    );
  });

  it('시작/끝 범위를 시각적으로 설정해 단일 범위를 갱신한다', () => {
    const onStatusChange = vi.fn();
    render(<SplitGroupEditor uploadedFiles={singleFile} onStatusChange={onStatusChange} />);

    expect(screen.getByLabelText('전체 시작 페이지')).toHaveAttribute('max', '13');
    expect(screen.getByLabelText('전체 끝 페이지')).toHaveAttribute('max', '13');
    const startSlider = screen.getByRole('slider', { name: '전체 시작 슬라이더' });
    const endSlider = screen.getByRole('slider', { name: '전체 끝 슬라이더' });
    expect(startSlider).toHaveClass('split-range-handle', 'is-start');
    expect(endSlider).toHaveClass('split-range-handle', 'is-end');
    expect(startSlider.tagName).toBe('DIV');
    expect(endSlider.tagName).toBe('DIV');
    expect(screen.getByText('시작')).toHaveClass('split-range-handle__label');
    expect(screen.getByText('끝')).toHaveClass('split-range-handle__label');
    expect(startSlider.closest('.split-range-handles')).toBe(endSlider.closest('.split-range-handles'));
    fireEvent.change(screen.getByLabelText('전체 시작 페이지'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('전체 끝 페이지'), { target: { value: '6' } });
    fireEvent.keyDown(startSlider, { key: 'ArrowRight' });

    expect(screen.getByText('전체 3-6 (총 4페이지)')).toBeInTheDocument();
    expect(onStatusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        groupCount: 1,
        latestRange: '3-6',
        mergedRange: '3-6',
        previewGroups: [
          {
            id: 'split-group-1',
            label: 'split-part-1',
            globalRange: '3-6',
            segments: [{ fileId: 'single', startPage: 3, endPage: 6 }],
          },
        ],
      }),
    );
  });

  it('여러 PDF를 전체 페이지 범위로 그룹화하되 요약은 PDF별 페이지 번호로 표시한다', () => {
    const onStatusChange = vi.fn();
    render(
      <SplitGroupEditor
        uploadedFiles={[
          { id: 'a', name: 'A.pdf', bytes: new ArrayBuffer(8), pageCount: 3 },
          { id: 'b', name: 'B.pdf', bytes: new ArrayBuffer(8), pageCount: 5 },
        ]}
        onStatusChange={onStatusChange}
      />,
    );

    expect(screen.getByLabelText('전체 시작 페이지')).toHaveAttribute('max', '8');
    fireEvent.change(screen.getByLabelText('전체 시작 페이지'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('전체 끝 페이지'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: '분할 그룹 추가' }));

    expect(screen.getByText(/A.pdf 3페이지 → B.pdf 1-5페이지/)).toBeInTheDocument();
    expect(onStatusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        groupCount: 1,
        latestRange: '3-8',
        mergedRange: '3-8',
        groups: [
          {
            id: 'split-group-1',
            label: 'split-part-1',
            globalRange: '3-8',
            segments: [
              { fileId: 'a', startPage: 3, endPage: 3 },
              { fileId: 'b', startPage: 1, endPage: 5 },
            ],
          },
        ],
      }),
    );
  });

  it('확정 그룹이 있어도 현재 조절 중인 다음 그룹을 previewGroups에 포함한다', () => {
    const onStatusChange = vi.fn();
    render(
      <SplitGroupEditor
        uploadedFiles={[
          { id: 'a', name: 'A.pdf', bytes: new ArrayBuffer(8), pageCount: 3 },
          { id: 'b', name: 'B.pdf', bytes: new ArrayBuffer(8), pageCount: 5 },
        ]}
        onStatusChange={onStatusChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('전체 시작 페이지'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('전체 끝 페이지'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: '분할 그룹 추가' }));
    fireEvent.change(screen.getByLabelText('전체 시작 페이지'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('전체 끝 페이지'), { target: { value: '8' } });

    expect(onStatusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        groupCount: 1,
        mergedRange: '1-2',
        groups: [
          {
            id: 'split-group-1',
            label: 'split-part-1',
            globalRange: '1-2',
            segments: [{ fileId: 'a', startPage: 1, endPage: 2 }],
          },
        ],
        previewGroups: [
          {
            id: 'split-group-1',
            label: 'split-part-1',
            globalRange: '1-2',
            segments: [{ fileId: 'a', startPage: 1, endPage: 2 }],
          },
          {
            id: 'split-group-2',
            label: 'split-part-2',
            globalRange: '3-8',
            segments: [
              { fileId: 'a', startPage: 3, endPage: 3 },
              { fileId: 'b', startPage: 1, endPage: 5 },
            ],
          },
        ],
      }),
    );
  });
});
