import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { JobType } from '../../worker/protocol';
import { useAppStore } from '../state/store';
import { getDownloadableArtifacts } from '../utils/exportArtifacts';

const JOB_ITEMS: Array<{ label: string; value: JobType; description: string; glyph: string }> = [
  { label: '합치기', value: 'merge', description: '여러 PDF를 하나의 파일로 병합합니다.', glyph: 'merge' },
  { label: '분할', value: 'split', description: '페이지 범위를 지정해 여러 파일로 분할합니다.', glyph: 'split' },
  { label: '이미지 추출', value: 'extract-images', description: 'PDF 내부 원본 이미지를 추출합니다.', glyph: 'extract-images' },
  { label: '페이지→이미지', value: 'pages-to-images', description: '페이지를 렌더링해 이미지로 변환합니다.', glyph: 'pages-to-images' },
];

type JobTypeSelectorProps = {
  uploadedFileCount: number;
};

const RESET_RESULT_CONFIRM_MESSAGE =
  '이전 작업 결과가 초기화됩니다. 다운로드하지 않은 파일은 다시 받을 수 없습니다. 계속 이동할까요?';

function isExportReady(status: string): boolean {
  return status === 'completed' || status === 'partial_failed';
}

function getJobIndex(jobType: JobType | null): number {
  return JOB_ITEMS.findIndex((item) => item.value === jobType);
}

function JobTypeGlyph({ type }: { type: string }) {
  return (
    <span
      aria-hidden="true"
      className={`job-type-tab__glyph job-type-tab__glyph--${type}`}
      data-testid={`job-type-glyph-${type}`}
    >
      <span className="job-type-tab__glyph-mark" />
    </span>
  );
}

export default function JobTypeSelector({ uploadedFileCount }: JobTypeSelectorProps) {
  const activeJobType = useAppStore((state) => state.activeJobType);
  const setJobType = useAppStore((state) => state.setJobType);
  const resetJobResult = useAppStore((state) => state.resetJobResult);
  const status = useAppStore((state) => state.status);
  const artifacts = useAppStore((state) => state.artifacts);
  const isRunning = status === 'running';
  const motionTimerRef = useRef<number | null>(null);
  const [motionState, setMotionState] = useState<{
    previousIndex: number;
    direction: 'left' | 'right' | 'none';
    isSwitching: boolean;
  }>({
    previousIndex: getJobIndex(activeJobType),
    direction: 'none',
    isSwitching: false,
  });
  const activeIndex = getJobIndex(activeJobType);
  const tabStyle = useMemo(
    () =>
      ({
        '--active-index': Math.max(activeIndex, 0),
        '--previous-index': Math.max(motionState.previousIndex, 0),
        '--tab-count': JOB_ITEMS.length,
      } as CSSProperties),
    [activeIndex, motionState.previousIndex],
  );

  useEffect(() => {
    return () => {
      if (motionTimerRef.current !== null) {
        window.clearTimeout(motionTimerRef.current);
      }
    };
  }, []);

  const beginLiquidMotion = (nextJobType: JobType): void => {
    const previousIndex = getJobIndex(activeJobType);
    const nextIndex = getJobIndex(nextJobType);
    const direction = previousIndex < 0 || previousIndex === nextIndex ? 'none' : nextIndex > previousIndex ? 'right' : 'left';

    if (motionTimerRef.current !== null) {
      window.clearTimeout(motionTimerRef.current);
    }

    setMotionState({
      previousIndex: previousIndex < 0 ? nextIndex : previousIndex,
      direction,
      isSwitching: direction !== 'none',
    });

    if (direction !== 'none') {
      motionTimerRef.current = window.setTimeout(() => {
        setMotionState((current) => ({ ...current, isSwitching: false }));
        motionTimerRef.current = null;
      }, 680);
    }
  };

  const onSelectJobType = (jobType: JobType): void => {
    if (activeJobType === jobType) {
      return;
    }

    const hasCompletedResult = isExportReady(status) && getDownloadableArtifacts(artifacts).length > 0;
    if (hasCompletedResult) {
      const shouldSwitch = window.confirm(RESET_RESULT_CONFIRM_MESSAGE);
      if (!shouldSwitch) {
        return;
      }
      resetJobResult();
    }

    beginLiquidMotion(jobType);
    setJobType(jobType);
  };

  if (uploadedFileCount === 0) {
    return null;
  }

  return (
    <section className="job-type-selector" aria-label="작업 선택">
      <div
        role="tablist"
        aria-label="PDF 작업 유형"
        className={[
          'job-type-selector__tabs',
          activeIndex < 0 ? 'has-no-selection' : '',
          motionState.isSwitching ? 'is-switching' : '',
          motionState.isSwitching && motionState.direction === 'right' ? 'is-moving-right' : '',
          motionState.isSwitching && motionState.direction === 'left' ? 'is-moving-left' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-active-index={String(activeIndex)}
        data-previous-index={String(motionState.previousIndex)}
        data-motion-direction={motionState.direction}
        data-tab-count={String(JOB_ITEMS.length)}
        style={tabStyle}
      >
        <span className="job-type-selector__liquid-plate" aria-hidden="true" />
        {JOB_ITEMS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={activeJobType === item.value}
            className={`job-type-tab${activeJobType === item.value ? ' is-selected' : ''}`}
            onClick={() => onSelectJobType(item.value)}
            disabled={isRunning}
          >
            <span className="job-type-tab__hover-sheen" aria-hidden="true" />
            <span className="job-type-tab__content">
              <JobTypeGlyph type={item.glyph} />
              <strong className="job-type-tab__label">{item.label}</strong>
            </span>
            <span className="sr-only">{item.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
