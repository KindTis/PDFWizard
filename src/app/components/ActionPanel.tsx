import { useMemo } from 'react';
import type { JobType } from '../../worker/protocol';
import { useAppStore } from '../state/store';
import type { SplitGroupStatus } from './SplitGroupEditor';

const ACTION_TABS: Array<{ label: string; value: JobType }> = [
  { label: '합치기', value: 'merge' },
  { label: '분할', value: 'split' },
  { label: '이미지 추출', value: 'extract-images' },
  { label: '페이지→이미지', value: 'pages-to-images' },
];

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
  const setJobType = useAppStore((state) => state.setJobType);
  const setExtractionOptions = useAppStore((state) => state.setExtractionOptions);

  const activeIndex = useMemo(
    () => ACTION_TABS.findIndex((tab) => tab.value === activeJobType),
    [activeJobType],
  );
  const isRunning = status === 'running';

  return (
    <section aria-label="작업 액션 패널" className="action-panel">
      <h2>작업 도구</h2>
      <div role="tablist" aria-label="PDF 작업 탭">
        {ACTION_TABS.map((tab, index) => (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            aria-controls={`action-panel-${index}`}
            id={`action-tab-${index}`}
            onClick={() => setJobType(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section role="tabpanel" id={`action-panel-${activeIndex}`} aria-labelledby={`action-tab-${activeIndex}`}>
        <p>선택한 탭에 따라 작업 옵션을 설정할 수 있습니다.</p>
        {activeJobType === 'split' ? (
          <>
            <p>분할 그룹: {splitGroupStatus.groupCount}개</p>
            <p>최근 범위: {splitGroupStatus.latestRange ?? '없음'}</p>
          </>
        ) : null}
      </section>

      <fieldset aria-label="이미지 추출 정책">
        <legend>이미지 추출 정책</legend>
        <label>
          <input
            type="checkbox"
            aria-label="원본 유지"
            checked={extractionOptions.preserveOriginal}
            onChange={(event) => setExtractionOptions({ preserveOriginal: event.currentTarget.checked })}
          />
          원본 유지
        </label>
        <label>
          <input
            type="checkbox"
            aria-label="강제 PNG/JPG 변환"
            checked={extractionOptions.forceConvert}
            onChange={(event) => setExtractionOptions({ forceConvert: event.currentTarget.checked })}
          />
          강제 PNG/JPG 변환
        </label>
      </fieldset>

      <div className="action-buttons">
        <button type="button" onClick={onRunCurrentJob} disabled={uploadedFileCount === 0 || isRunning}>
          작업 실행
        </button>
        <button type="button" onClick={onCancelCurrentJob} disabled={!isRunning}>
          취소
        </button>
      </div>
    </section>
  );
}
