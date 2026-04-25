import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../state/store';
import { triggerDownload } from '../utils/download';
import { buildZip } from '../utils/zip';
import BottomActionBar from './BottomActionBar';

vi.mock('../utils/download', () => ({
  triggerDownload: vi.fn(),
}));

vi.mock('../utils/zip', () => ({
  buildZip: vi.fn(async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'application/zip' })),
}));

function resetAppState() {
  const store = useAppStore.getState();
  store.reset();
  store.setJobType('merge');
  useAppStore.setState({
    status: 'idle',
    artifacts: [],
    errorMessage: null,
  });
}

function renderBar() {
  return render(
    <BottomActionBar
      uploadedFileCount={1}
      uploadedFileName="source.pdf"
      onRunCurrentJob={vi.fn()}
      onCancelCurrentJob={vi.fn()}
    />,
  );
}

describe('BottomActionBar', () => {
  beforeEach(() => {
    resetAppState();
    vi.clearAllMocks();
  });

  it('automatically starts downloading a single artifact when a job completes', async () => {
    useAppStore.setState({
      status: 'completed',
      artifacts: [{ name: 'merged.pdf', mime: 'application/pdf', bytes: new Uint8Array([1, 2, 3]) }],
    });

    renderBar();

    await waitFor(() => {
      expect(triggerDownload).toHaveBeenCalledTimes(1);
    });
    expect(buildZip).not.toHaveBeenCalled();
    expect(vi.mocked(triggerDownload).mock.calls[0][1]).toBe('merged.pdf');
    expect(screen.getByRole('button', { name: '다시 다운로드' })).toBeEnabled();
  });

  it('does not repeat the automatic download for the same completed artifacts on rerender', async () => {
    useAppStore.setState({
      status: 'completed',
      artifacts: [{ name: 'merged.pdf', mime: 'application/pdf', bytes: new Uint8Array([1, 2, 3]) }],
    });

    const view = renderBar();

    await waitFor(() => {
      expect(triggerDownload).toHaveBeenCalledTimes(1);
    });

    view.rerender(
      <BottomActionBar
        uploadedFileCount={1}
        uploadedFileName="source.pdf"
        onRunCurrentJob={vi.fn()}
        onCancelCurrentJob={vi.fn()}
      />,
    );

    expect(triggerDownload).toHaveBeenCalledTimes(1);
  });

  it('automatically downloads the same artifact set again after a new job run starts and completes', async () => {
    useAppStore.setState({
      status: 'completed',
      artifacts: [{ name: 'merged.pdf', mime: 'application/pdf', bytes: new Uint8Array([1, 2, 3]) }],
    });

    renderBar();

    await waitFor(() => {
      expect(triggerDownload).toHaveBeenCalledTimes(1);
    });

    act(() => {
      useAppStore.setState({
        status: 'running',
        artifacts: [],
      });
    });
    act(() => {
      useAppStore.setState({
        status: 'completed',
        artifacts: [{ name: 'merged.pdf', mime: 'application/pdf', bytes: new Uint8Array([1, 2, 3]) }],
      });
    });

    await waitFor(() => {
      expect(triggerDownload).toHaveBeenCalledTimes(2);
    });
  });

  it('packages multiple completed artifacts into a zip during automatic download', async () => {
    useAppStore.setState({
      status: 'completed',
      artifacts: [
        { name: 'a.pdf', mime: 'application/pdf', bytes: new Uint8Array([1]) },
        { name: 'b.pdf', mime: 'application/pdf', bytes: new Uint8Array([2]) },
        { name: 'report.json', mime: 'application/json', bytes: new Uint8Array([3]) },
      ],
    });

    renderBar();

    await waitFor(() => {
      expect(buildZip).toHaveBeenCalledTimes(1);
      expect(triggerDownload).toHaveBeenCalledTimes(1);
    });

    const [, zipArtifacts] = vi.mocked(buildZip).mock.calls[0];
    expect((zipArtifacts as Array<{ name: string }>).map((item) => item.name)).toEqual(['a.pdf', 'b.pdf']);
    expect(vi.mocked(triggerDownload).mock.calls[0][1]).toMatch(/^pdfwizard-merge-.*\.zip$/);
  });

  it('keeps manual fallback available when automatic download preparation fails', async () => {
    vi.mocked(triggerDownload).mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    useAppStore.setState({
      status: 'completed',
      artifacts: [{ name: 'merged.pdf', mime: 'application/pdf', bytes: new Uint8Array([1, 2, 3]) }],
    });

    renderBar();

    await waitFor(() => {
      expect(screen.getByText('자동 다운로드를 준비하지 못했습니다. 다시 다운로드를 눌러주세요.')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: '다시 다운로드' })).toBeEnabled();
  });
});
