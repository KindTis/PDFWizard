import { fireEvent, render, screen } from '@testing-library/react';
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
});
