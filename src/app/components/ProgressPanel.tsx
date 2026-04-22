import { useAppStore } from '../state/store';
import type { RegisteredPdf } from '../state/fileRegistry';

type ProgressPanelProps = {
  uploadedFiles: RegisteredPdf[];
  selectedRange: string | null;
};

function countSelectedPages(range: string | null): number {
  if (!range) {
    return 0;
  }

  return range
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .reduce((total, token) => {
      const [startToken, endToken] = token.split('-').map((value) => Number(value));
      if (Number.isInteger(startToken) && Number.isInteger(endToken)) {
        return total + Math.abs(endToken - startToken) + 1;
      }
      if (Number.isInteger(startToken)) {
        return total + 1;
      }
      return total;
    }, 0);
}

function formatEstimatedSize(bytes: number): string {
  if (bytes <= 0) {
    return '-';
  }
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? `약 ${mb.toFixed(1)} MB` : `약 ${mb.toFixed(2)} MB`;
}

function formatSourceSummary(uploadedFiles: RegisteredPdf[], isMergeJob: boolean): string {
  if (uploadedFiles.length === 0) {
    return '-';
  }
  if (!isMergeJob) {
    return uploadedFiles[0].name;
  }

  const names = uploadedFiles.map((file) => file.name);
  const shownNames = names.slice(0, 3);
  const hiddenCount = Math.max(0, names.length - shownNames.length);
  const tail = hiddenCount > 0 ? ` 외 ${hiddenCount}개` : '';
  return `${uploadedFiles.length}개 (${shownNames.join(', ')}${tail})`;
}

function formatPageSummary(uploadedFiles: RegisteredPdf[], isMergeJob: boolean): string {
  if (uploadedFiles.length === 0) {
    return '-';
  }

  if (!isMergeJob) {
    const firstFilePageCount = uploadedFiles[0].pageCount;
    return typeof firstFilePageCount === 'number' && firstFilePageCount > 0 ? String(firstFilePageCount) : '-';
  }

  const knownPageCounts = uploadedFiles
    .map((file) => file.pageCount)
    .filter((pageCount): pageCount is number => typeof pageCount === 'number' && Number.isInteger(pageCount) && pageCount > 0);
  const knownTotalPages = knownPageCounts.reduce((sum, pageCount) => sum + pageCount, 0);
  const unknownCount = uploadedFiles.length - knownPageCounts.length;

  if (unknownCount === 0) {
    return String(knownTotalPages);
  }
  if (knownTotalPages > 0) {
    return `최소 ${knownTotalPages} (미확인 ${unknownCount}개)`;
  }
  return `미확인 (${unknownCount}개)`;
}

export default function ProgressPanel({ uploadedFiles, selectedRange }: ProgressPanelProps) {
  const status = useAppStore((state) => state.status);
  const progress = useAppStore((state) => state.progress);
  const artifacts = useAppStore((state) => state.artifacts);
  const errorMessage = useAppStore((state) => state.errorMessage);
  const activeJobType = useAppStore((state) => state.activeJobType);
  const isMergeJob = activeJobType === 'merge';
  const selectedPageCount = countSelectedPages(selectedRange);
  const totalArtifactBytes = artifacts
    .filter((artifact) => artifact.name !== 'report.json')
    .reduce((sum, artifact) => sum + artifact.bytes.byteLength, 0);
  const sourceSummary = formatSourceSummary(uploadedFiles, isMergeJob);
  const pageSummary = formatPageSummary(uploadedFiles, isMergeJob);
  const sourceLabel = isMergeJob ? '원본 파일들' : '원본 파일';
  const pageLabel = isMergeJob ? '예상 총 페이지' : '전체 페이지';
  const generatedFileCount =
    artifacts.length > 0
      ? artifacts.filter((artifact) => artifact.name !== 'report.json').length
      : isMergeJob && uploadedFiles.length > 0
        ? 1
      : activeJobType === 'split' && selectedRange
        ? 1
        : 0;

  return (
    <aside aria-label="진행 상태 패널" className="progress-panel">
      <h2>작업 요약</h2>
      <dl>
        <div>
          <dt>{sourceLabel}</dt>
          <dd>{sourceSummary}</dd>
        </div>
        <div>
          <dt>{pageLabel}</dt>
          <dd>{pageSummary}</dd>
        </div>
        <div>
          <dt>선택 범위</dt>
          <dd>{selectedRange ?? '-'}</dd>
        </div>
        <div>
          <dt>생성 파일</dt>
          <dd>{generatedFileCount}개</dd>
        </div>
        <div>
          <dt>예상 용량</dt>
          <dd>{formatEstimatedSize(totalArtifactBytes)}</dd>
        </div>
      </dl>
      <p className="progress-panel__status">
        상태: {status} | 진행: {progress.done}/{progress.total} | 선택 페이지: {selectedPageCount}
      </p>
      {errorMessage ? <p className="progress-error">오류: {errorMessage}</p> : null}
    </aside>
  );
}
