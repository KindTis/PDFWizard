import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore, type JobStatus } from '../state/store';
import { createArtifactDownloadKey, downloadArtifacts, getDownloadableArtifacts } from '../utils/exportArtifacts';

type BottomActionBarProps = {
  uploadedFileCount: number;
  uploadedFileName: string | null;
  onRunCurrentJob: () => void | Promise<void>;
  onCancelCurrentJob: () => void;
};

function isExportReady(status: string): boolean {
  return status === 'completed' || status === 'partial_failed';
}

function toProgressPercent(done: number, total: number, status: string): number {
  if (status === 'completed' || status === 'partial_failed') {
    return 100;
  }
  if (status === 'failed' || status === 'cancelled') {
    return 0;
  }
  if (total <= 0) {
    return 0;
  }
  return Math.round((Math.max(0, Math.min(done, total)) / total) * 100);
}

function toStatusTitle(status: JobStatus): string {
  switch (status) {
    case 'validating':
      return '파일 확인 중';
    case 'running':
      return '작업 진행 중...';
    case 'paused':
      return '작업 일시 중지';
    case 'completed':
      return '작업 완료';
    case 'partial_failed':
      return '일부 작업 완료';
    case 'failed':
      return '작업 실패';
    case 'cancelled':
      return '작업 취소됨';
    case 'idle':
    default:
      return '실행 대기 중';
  }
}

function formatReadyMessage(uploadedFileCount: number, activeJobType: string | null, hasRunnableInput: boolean): string {
  if (uploadedFileCount <= 0) {
    return 'PDF를 추가해 주세요.';
  }

  if (activeJobType === 'merge' && !hasRunnableInput) {
    return `PDF ${uploadedFileCount}개가 준비되었습니다. 합치려면 PDF를 1개 더 추가하세요.`;
  }

  return `PDF ${uploadedFileCount}개가 준비되었습니다. 실행을 누르면 작업을 시작합니다.`;
}

function translateProgressMessage(message: string): string | null {
  const normalizedMessage = message.trim();
  if (normalizedMessage.length === 0) {
    return null;
  }

  if (normalizedMessage === 'queued') {
    return '작업을 준비하고 있습니다.';
  }

  if (normalizedMessage === 'done' || normalizedMessage === 'merge:done' || normalizedMessage === 'split:done') {
    return '결과 파일이 준비되었습니다.';
  }

  return normalizedMessage;
}

function toProgressMessage({
  activeJobType,
  hasRunnableInput,
  progressMessage,
  status,
  uploadedFileCount,
  uploadedFileName,
}: {
  activeJobType: string | null;
  hasRunnableInput: boolean;
  progressMessage: string;
  status: JobStatus;
  uploadedFileCount: number;
  uploadedFileName: string | null;
}): string {
  if (status === 'idle') {
    return formatReadyMessage(uploadedFileCount, activeJobType, hasRunnableInput);
  }

  if (status === 'validating') {
    return 'PDF 파일을 확인하고 있습니다.';
  }

  if (status === 'completed') {
    return translateProgressMessage(progressMessage) ?? '결과 파일이 준비되었습니다.';
  }

  if (status === 'partial_failed') {
    return '일부 파일은 실패했지만 다운로드 가능한 결과가 준비되었습니다.';
  }

  if (status === 'failed') {
    return '작업을 완료하지 못했습니다. 오류 내용을 확인해 주세요.';
  }

  if (status === 'cancelled') {
    return '작업이 취소되었습니다.';
  }

  if (status === 'paused') {
    return '작업이 일시 중지되었습니다.';
  }

  return translateProgressMessage(progressMessage) ?? `${uploadedFileName ?? '선택한 문서'} 처리 중`;
}

export default function BottomActionBar({
  uploadedFileCount,
  uploadedFileName,
  onRunCurrentJob,
  onCancelCurrentJob,
}: BottomActionBarProps) {
  const activeJobType = useAppStore((state) => state.activeJobType);
  const status = useAppStore((state) => state.status);
  const progress = useAppStore((state) => state.progress);
  const artifacts = useAppStore((state) => state.artifacts);

  const [isExporting, setIsExporting] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const autoDownloadKeyRef = useRef<string | null>(null);

  const downloadableArtifacts = useMemo(() => getDownloadableArtifacts(artifacts), [artifacts]);

  const isRunning = status === 'running';
  const hasRunnableInput = activeJobType === 'merge' ? uploadedFileCount >= 2 : uploadedFileCount > 0;
  const canRun = hasRunnableInput && Boolean(activeJobType) && !isRunning;
  const canCancel = isRunning;
  const canDownload = isExportReady(status) && downloadableArtifacts.length > 0 && !isExporting;
  const downloadKey = useMemo(
    () => (downloadableArtifacts.length > 0 ? createArtifactDownloadKey(activeJobType, downloadableArtifacts) : null),
    [activeJobType, downloadableArtifacts],
  );
  const progressPercent = toProgressPercent(progress.done, progress.total, status);
  const statusTitle = toStatusTitle(status);
  const progressMessage = toProgressMessage({
    activeJobType,
    hasRunnableInput,
    progressMessage: progress.message,
    status,
    uploadedFileCount,
    uploadedFileName,
  });

  const startDownload = useCallback(
    async (mode: 'auto' | 'manual'): Promise<void> => {
      if (!isExportReady(status) || downloadableArtifacts.length === 0 || isExporting) {
        return;
      }

      setIsExporting(true);
      setDownloadMessage(null);

      try {
        await downloadArtifacts(activeJobType, downloadableArtifacts);
      } catch {
        setDownloadMessage(
          mode === 'auto'
            ? '자동 다운로드를 준비하지 못했습니다. 다시 다운로드를 눌러주세요.'
            : '다운로드 준비 중 오류가 발생했습니다.',
        );
      } finally {
        setIsExporting(false);
      }
    },
    [activeJobType, downloadableArtifacts, isExporting, status],
  );

  useEffect(() => {
    if (!isExportReady(status)) {
      autoDownloadKeyRef.current = null;
      return;
    }

    if (!canDownload || !downloadKey || autoDownloadKeyRef.current === downloadKey) {
      return;
    }

    autoDownloadKeyRef.current = downloadKey;
    void startDownload('auto');
  }, [canDownload, downloadKey, startDownload, status]);

  return (
    <footer className="bottom-action-bar" aria-label="하단 작업 바">
      <div className="bottom-action-bar__progress">
        <p className="bottom-action-bar__title">{statusTitle}</p>
        <p className="bottom-action-bar__message">{progressMessage}</p>
        <div className="bottom-action-bar__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
          <span className="bottom-action-bar__track-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="bottom-action-bar__status">
        <strong>{progressPercent}%</strong>
        {downloadMessage ? <p>{downloadMessage}</p> : null}
      </div>

      <div className="bottom-action-bar__actions">
        <button type="button" className="action-btn is-ghost" onClick={onCancelCurrentJob} disabled={!canCancel}>
          취소
        </button>
        <button type="button" className="action-btn is-outline" onClick={() => void startDownload('manual')} disabled={!canDownload}>
          {isExporting ? '내보내는 중...' : isExportReady(status) ? '다시 다운로드' : '다운로드'}
        </button>
        <button type="button" className="action-btn is-primary" onClick={() => void onRunCurrentJob()} disabled={!canRun}>
          실행
        </button>
      </div>
    </footer>
  );
}
