import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../state/store';
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
  const canRun = uploadedFileCount > 0 && Boolean(activeJobType) && !isRunning;
  const canCancel = isRunning;
  const canDownload = isExportReady(status) && downloadableArtifacts.length > 0 && !isExporting;
  const downloadKey = useMemo(
    () => (downloadableArtifacts.length > 0 ? createArtifactDownloadKey(activeJobType, downloadableArtifacts) : null),
    [activeJobType, downloadableArtifacts],
  );
  const progressPercent = toProgressPercent(progress.done, progress.total, status);
  const progressMessage =
    progress.message.trim().length > 0 ? progress.message : `${uploadedFileName ?? '선택한 문서'} ${isRunning ? '처리 중' : '대기 중'}`;

  const startDownload = useCallback(
    async (mode: 'auto' | 'manual'): Promise<void> => {
      if (!isExportReady(status) || downloadableArtifacts.length === 0 || isExporting) {
        return;
      }

      setIsExporting(true);
      setDownloadMessage(null);

      try {
        const result = await downloadArtifacts(activeJobType, downloadableArtifacts);
        setDownloadMessage(
          mode === 'auto'
            ? `${result.count}개 파일 다운로드를 시작했습니다. 시작되지 않으면 다시 다운로드를 눌러주세요.`
            : `${result.count}개 파일 다운로드를 시작했습니다.`,
        );
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
        <p className="bottom-action-bar__title">작업 진행 중...</p>
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
