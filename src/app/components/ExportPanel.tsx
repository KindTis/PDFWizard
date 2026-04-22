import { useMemo, useState } from 'react';
import type { Artifact, JobType } from '../../worker/protocol';
import { useAppStore } from '../state/store';
import { triggerDownload } from '../utils/download';
import { buildZip } from '../utils/zip';

function createZipName(jobType: JobType | null): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `pdfwizard-${jobType ?? 'workflow'}-${timestamp}.zip`;
}

function isExportReady(status: string): boolean {
  return status === 'completed' || status === 'partial_failed';
}

function createSingleArtifactBlob(artifact: Artifact): Blob {
  const safeBytes = new Uint8Array(artifact.bytes.byteLength);
  safeBytes.set(artifact.bytes);
  return new Blob([safeBytes], { type: artifact.mime });
}

export default function ExportPanel() {
  const status = useAppStore((state) => state.status);
  const activeJobType = useAppStore((state) => state.activeJobType);
  const artifacts = useAppStore((state) => state.artifacts);

  const [isExporting, setIsExporting] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);

  const downloadableArtifacts = useMemo(
    () => artifacts.filter((artifact) => artifact.name !== 'report.json'),
    [artifacts],
  );
  const canDownload = isExportReady(status) && downloadableArtifacts.length > 0 && !isExporting;

  const onDownload = async (): Promise<void> => {
    if (!canDownload) {
      return;
    }

    setIsExporting(true);
    setDownloadMessage(null);

    try {
      if (downloadableArtifacts.length === 1) {
        const artifact = downloadableArtifacts[0];
        triggerDownload(createSingleArtifactBlob(artifact), artifact.name);
      } else {
        const zipName = createZipName(activeJobType);
        const zipBlob = await buildZip(zipName, downloadableArtifacts);
        triggerDownload(zipBlob, zipName);
      }
      setDownloadMessage(`${downloadableArtifacts.length}개 파일 다운로드를 시작했습니다.`);
    } catch {
      setDownloadMessage('다운로드 준비 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <aside aria-label="결과 내보내기 패널" className="export-panel">
      <h2>내보내기</h2>
      <p>산출물: {downloadableArtifacts.length}개</p>
      <button type="button" onClick={onDownload} disabled={!canDownload}>
        {isExporting ? '내보내는 중...' : '결과 다운로드'}
      </button>
      {!isExportReady(status) ? <p>작업 완료 후 다운로드할 수 있습니다.</p> : null}
      {isExportReady(status) && downloadableArtifacts.length === 0 ? <p>다운로드 가능한 파일이 없습니다.</p> : null}
      {downloadMessage ? <p>{downloadMessage}</p> : null}
    </aside>
  );
}
