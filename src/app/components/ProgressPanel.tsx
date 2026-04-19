import { useAppStore } from '../state/store';

export default function ProgressPanel() {
  const status = useAppStore((state) => state.status);
  const progress = useAppStore((state) => state.progress);
  const reportSummary = useAppStore((state) => state.reportSummary);
  const errorMessage = useAppStore((state) => state.errorMessage);

  return (
    <aside aria-label="진행 상태 패널">
      <h2>진행 상태</h2>
      <p>상태: {status}</p>
      <p>
        진행: {progress.done}/{progress.total}
      </p>
      <p>메시지: {progress.message || '대기 중'}</p>
      {errorMessage ? <p className="progress-error">오류: {errorMessage}</p> : null}
      <hr />
      <p>원본 유지: {reportSummary.successCount}</p>
      <p>변환: {reportSummary.convertedCount}</p>
      <p>실패: {reportSummary.failedCount}</p>
    </aside>
  );
}
