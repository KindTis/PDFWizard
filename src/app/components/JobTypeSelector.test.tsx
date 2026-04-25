import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../state/store';
import JobTypeSelector from './JobTypeSelector';

function resetAppState() {
  const store = useAppStore.getState();
  store.reset();
}

describe('JobTypeSelector', () => {
  beforeEach(() => {
    resetAppState();
    vi.restoreAllMocks();
  });

  it('warns and clears completed result state before switching to another job tab', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    useAppStore.setState({
      activeJobType: 'merge',
      status: 'completed',
      progress: { done: 1, total: 1, message: 'done' },
      reportSummary: { successCount: 1, convertedCount: 0, failedCount: 0 },
      artifacts: [{ name: 'merged.pdf', mime: 'application/pdf', bytes: new Uint8Array([1, 2, 3]) }],
      errorMessage: 'previous error',
    });

    render(<JobTypeSelector uploadedFileCount={1} />);
    fireEvent.click(screen.getByRole('tab', { name: /분할/ }));

    expect(confirmSpy).toHaveBeenCalledWith(
      '이전 작업 결과가 초기화됩니다. 다운로드하지 않은 파일은 다시 받을 수 없습니다. 계속 이동할까요?',
    );
    expect(useAppStore.getState().activeJobType).toBe('split');
    expect(useAppStore.getState().status).toBe('idle');
    expect(useAppStore.getState().progress).toEqual({ done: 0, total: 0, message: '' });
    expect(useAppStore.getState().reportSummary).toEqual({ successCount: 0, convertedCount: 0, failedCount: 0 });
    expect(useAppStore.getState().artifacts).toEqual([]);
    expect(useAppStore.getState().errorMessage).toBeNull();
  });

  it('keeps the current completed result when tab switch confirmation is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const artifact = { name: 'merged.pdf', mime: 'application/pdf', bytes: new Uint8Array([1, 2, 3]) };
    useAppStore.setState({
      activeJobType: 'merge',
      status: 'completed',
      artifacts: [artifact],
    });

    render(<JobTypeSelector uploadedFileCount={1} />);
    fireEvent.click(screen.getByRole('tab', { name: /분할/ }));

    expect(useAppStore.getState().activeJobType).toBe('merge');
    expect(useAppStore.getState().status).toBe('completed');
    expect(useAppStore.getState().artifacts).toEqual([artifact]);
  });

  it('switches tabs without confirmation when there are no completed downloadable results', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    useAppStore.setState({
      activeJobType: 'merge',
      status: 'idle',
      artifacts: [],
    });

    render(<JobTypeSelector uploadedFileCount={1} />);
    fireEvent.click(screen.getByRole('tab', { name: /분할/ }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(useAppStore.getState().activeJobType).toBe('split');
  });

  it('renders the liquid command rail layer and semantic glyphs instead of decorative dots', () => {
    useAppStore.setState({ activeJobType: 'merge' });

    const { container } = render(<JobTypeSelector uploadedFileCount={1} />);
    const tabList = screen.getByRole('tablist', { name: 'PDF 작업 유형' });

    expect(tabList).toHaveAttribute('data-active-index', '0');
    expect(tabList).toHaveAttribute('data-tab-count', '4');
    expect(container.querySelector('.job-type-selector__liquid-plate')).toBeInTheDocument();
    expect(container.querySelector('.job-type-tab__dot')).not.toBeInTheDocument();
    expect(within(screen.getByRole('tab', { name: /합치기/ })).getByTestId('job-type-glyph-merge')).toBeInTheDocument();
    expect(within(screen.getByRole('tab', { name: /분할/ })).getByTestId('job-type-glyph-split')).toBeInTheDocument();
    expect(within(screen.getByRole('tab', { name: /이미지 추출/ })).getByTestId('job-type-glyph-extract-images')).toBeInTheDocument();
    expect(within(screen.getByRole('tab', { name: /페이지→이미지/ })).getByTestId('job-type-glyph-pages-to-images')).toBeInTheDocument();
  });

  it('marks the liquid rail direction when switching between job tabs', () => {
    useAppStore.setState({ activeJobType: 'merge' });

    render(<JobTypeSelector uploadedFileCount={1} />);
    const tabList = screen.getByRole('tablist', { name: 'PDF 작업 유형' });

    fireEvent.click(screen.getByRole('tab', { name: /이미지 추출/ }));

    expect(tabList).toHaveAttribute('data-active-index', '2');
    expect(tabList).toHaveAttribute('data-previous-index', '0');
    expect(tabList).toHaveAttribute('data-motion-direction', 'right');
    expect(tabList).toHaveClass('is-switching', 'is-moving-right');
  });
});
