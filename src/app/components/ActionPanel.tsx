import type { JobType } from '../../worker/protocol';
import { useAppStore } from '../state/store';
import type { SplitGroupStatus } from './SplitGroupEditor';

const JOB_LABELS: Record<JobType, string> = {
  merge: '합치기',
  split: '분할',
  'extract-images': '이미지 추출',
  'pages-to-images': '페이지→이미지',
};

type ActionPanelProps = {
  uploadedFileCount: number;
  splitGroupStatus: SplitGroupStatus;
  onRunCurrentJob: () => void | Promise<void>;
  onCancelCurrentJob: () => void;
};

export default function ActionPanel({
  uploadedFileCount,
  splitGroupStatus,
  onRunCurrentJob,
  onCancelCurrentJob,
}: ActionPanelProps) {
  const activeJobType = useAppStore((state) => state.activeJobType);
  const status = useAppStore((state) => state.status);
  const extractionOptions = useAppStore((state) => state.extractionOptions);
  const setExtractionOptions = useAppStore((state) => state.setExtractionOptions);

  const isRunning = status === 'running';

  if (!activeJobType) {
    return null;
  }

  return (
    <section aria-label="작업 인스펙터 패널" className="action-panel">
      <h2>작업 인스펙터</h2>
      <p className="inspector-job-label">현재 작업: {JOB_LABELS[activeJobType]}</p>

      <section aria-label="작업 세부 설정" className="inspector-settings">
        {activeJobType === 'merge' ? <p>업로드된 파일 전체를 하나의 PDF로 병합합니다.</p> : null}

        {activeJobType === 'split' ? (
          <>
            <p>분할 그룹: {splitGroupStatus.groupCount}개</p>
            <p>최근 범위: {splitGroupStatus.latestRange ?? '없음'}</p>
            <p>병합 범위: {splitGroupStatus.mergedRange ?? '없음'}</p>
          </>
        ) : null}

        {activeJobType === 'extract-images' ? (
          <fieldset className="inspector-fieldset">
            <legend>이미지 추출 옵션</legend>
            <label className="inspector-check">
              <input
                type="checkbox"
                checked={extractionOptions.preserveOriginal}
                onChange={(event) => setExtractionOptions({ preserveOriginal: event.currentTarget.checked })}
              />
              원본 인코딩 우선 유지
            </label>
            <label className="inspector-check">
              <input
                type="checkbox"
                checked={extractionOptions.forceConvert}
                onChange={(event) => setExtractionOptions({ forceConvert: event.currentTarget.checked })}
              />
              강제 포맷 변환 사용
            </label>
            <label>
              출력 포맷
              <select
                value={extractionOptions.forceOutputFormat}
                onChange={(event) => setExtractionOptions({ forceOutputFormat: event.currentTarget.value as 'png' | 'jpg' })}
                disabled={!extractionOptions.forceConvert}
              >
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
              </select>
            </label>
            <label>
              품질 ({extractionOptions.quality})
              <input
                type="range"
                min={50}
                max={100}
                step={1}
                value={extractionOptions.quality}
                onChange={(event) => setExtractionOptions({ quality: Number(event.currentTarget.value) })}
              />
            </label>
          </fieldset>
        ) : null}

        {activeJobType === 'pages-to-images' ? (
          <fieldset className="inspector-fieldset">
            <legend>페이지 이미지 변환 옵션</legend>
            <label>
              출력 포맷
              <select
                value={extractionOptions.forceOutputFormat}
                onChange={(event) => setExtractionOptions({ forceOutputFormat: event.currentTarget.value as 'png' | 'jpg' })}
              >
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
              </select>
            </label>
            <label>
              품질 ({extractionOptions.quality})
              <input
                type="range"
                min={50}
                max={100}
                step={1}
                value={extractionOptions.quality}
                onChange={(event) => setExtractionOptions({ quality: Number(event.currentTarget.value) })}
              />
            </label>
          </fieldset>
        ) : null}
      </section>

      <div className="action-buttons">
        <button type="button" onClick={onRunCurrentJob} disabled={uploadedFileCount === 0 || isRunning || !activeJobType}>
          작업 실행
        </button>
        <button type="button" onClick={onCancelCurrentJob} disabled={!isRunning}>
          취소
        </button>
      </div>
    </section>
  );
}
