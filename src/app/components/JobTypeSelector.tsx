import type { JobType } from '../../worker/protocol';
import { useAppStore } from '../state/store';

const JOB_ITEMS: Array<{ label: string; value: JobType; description: string }> = [
  { label: '합치기', value: 'merge', description: '여러 PDF를 하나의 파일로 병합합니다.' },
  { label: '분할', value: 'split', description: '페이지 범위를 지정해 여러 파일로 분할합니다.' },
  { label: '이미지 추출', value: 'extract-images', description: 'PDF 내부 원본 이미지를 추출합니다.' },
  { label: '페이지→이미지', value: 'pages-to-images', description: '페이지를 렌더링해 이미지로 변환합니다.' },
];

type JobTypeSelectorProps = {
  uploadedFileCount: number;
};

export default function JobTypeSelector({ uploadedFileCount }: JobTypeSelectorProps) {
  const activeJobType = useAppStore((state) => state.activeJobType);
  const setJobType = useAppStore((state) => state.setJobType);
  const status = useAppStore((state) => state.status);
  const isRunning = status === 'running';

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
            onClick={() => setJobType(item.value)}
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
