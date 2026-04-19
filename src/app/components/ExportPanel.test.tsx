import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../state/store';
import { triggerDownload } from '../utils/download';
import { buildZip } from '../utils/zip';
import ExportPanel from './ExportPanel';

vi.mock('../utils/download', () => ({
  triggerDownload: vi.fn(),
}));

vi.mock('../utils/zip', () => ({
  buildZip: vi.fn(async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'application/zip' })),
}));

function resetAppState() {
  const store = useAppStore.getState();
  store.reset();
  store.setJobType('extract-images');
  useAppStore.setState({
    status: 'idle',
    artifacts: [],
    errorMessage: null,
  });
}

describe('ExportPanel', () => {
  beforeEach(() => {
    resetAppState();
    vi.clearAllMocks();
  });

  it('disables download before job completion', () => {
    render(<ExportPanel />);

    expect(screen.getByRole('button', { name: '결과 다운로드' })).toBeDisabled();
    expect(screen.getByText('작업 완료 후 다운로드할 수 있습니다.')).toBeInTheDocument();
  });

  it('downloads a single artifact directly', async () => {
    useAppStore.setState({
      status: 'completed',
      artifacts: [{ name: 'image-1.png', mime: 'image/png', bytes: new Uint8Array([1, 2, 3]) }],
    });

    render(<ExportPanel />);
    fireEvent.click(screen.getByRole('button', { name: '결과 다운로드' }));

    await waitFor(() => {
      expect(triggerDownload).toHaveBeenCalledTimes(1);
    });
    expect(buildZip).not.toHaveBeenCalled();
    const [blob, filename] = vi.mocked(triggerDownload).mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect((blob as Blob).type).toBe('image/png');
    expect(filename).toBe('image-1.png');
  });

  it('downloads multiple artifacts as zip and excludes report.json', async () => {
    useAppStore.setState({
      status: 'completed',
      artifacts: [
        { name: 'image-1.png', mime: 'image/png', bytes: new Uint8Array([1]) },
        { name: 'image-2.jpg', mime: 'image/jpeg', bytes: new Uint8Array([2]) },
        { name: 'report.json', mime: 'application/json', bytes: new Uint8Array([3]) },
      ],
    });

    render(<ExportPanel />);
    fireEvent.click(screen.getByRole('button', { name: '결과 다운로드' }));

    await waitFor(() => {
      expect(buildZip).toHaveBeenCalledTimes(1);
      expect(triggerDownload).toHaveBeenCalledTimes(1);
    });

    const [zipName, zipArtifacts] = vi.mocked(buildZip).mock.calls[0];
    expect(zipName).toMatch(/^pdfwizard-extract-images-.*\.zip$/);
    expect((zipArtifacts as Array<{ name: string }>).map((item) => item.name)).toEqual(['image-1.png', 'image-2.jpg']);

    const [, filename] = vi.mocked(triggerDownload).mock.calls[0];
    expect(filename).toMatch(/^pdfwizard-extract-images-.*\.zip$/);
  });
});
