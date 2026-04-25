import type { JobType } from '../../worker/protocol';
import { useAppStore } from '../state/store';
import { getDownloadableArtifacts } from '../utils/exportArtifacts';

const JOB_ITEMS: Array<{ label: string; value: JobType; description: string }> = [
  { label: '합치기', value: 'merge', description: '여러 PDF를 하나의 파일로 병합합니다.' },
  { label: '분할', value: 'split', description: '페이지 범위를 지정해 여러 파일로 분할합니다.' },
  { label: '이미지 추출', value: 'extract-images', description: 'PDF 내부 원본 이미지를 추출합니다.' },
  { label: '페이지→이미지', value: 'pages-to-images', description: '페이지를 렌더링해 이미지로 변환합니다.' },
];

type JobTypeSelectorProps = {
  uploadedFileCount: number;
};

const RESET_RESULT_CONFIRM_MESSAGE =
  '이전 작업 결과가 초기화됩니다. 다운로드하지 않은 파일은 다시 받을 수 없습니다. 계속 이동할까요?';

function isExportReady(status: string): boolean {
  return status === 'completed' || status === 'partial_failed';
}

export default function JobTypeSelector({ uploadedFileCount }: JobTypeSelectorProps) {
  const activeJobType = useAppStore((state) => state.activeJobType);
  const setJobType = useAppStore((state) => state.setJobType);
  const resetJobResult = useAppStore((state) => state.resetJobResult);
  const status = useAppStore((state) => state.status);
  const artifacts = useAppStore((state) => state.artifacts);
  const isRunning = status === 'running';

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

    setJobType(jobType);
  };

  if (uploadedFileCount === 0) {
    return null;
  }

  return (
    <section className="job-type-selector" aria-label="작업 선택">
      <div role="tablist" aria-label="PDF 작업 유형" className="job-type-selector__tabs">
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
            <span aria-hidden="true" className="job-type-tab__dot" />
            <strong>{item.label}</strong>
            <span className="sr-only">{item.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
