import { closestCenter, DndContext, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { JobType } from '../../worker/protocol';
import type { RegisteredPdf } from '../state/fileRegistry';
import { useAppStore } from '../state/store';
import SplitGroupEditor, { type SplitGroupStatus } from './SplitGroupEditor';

const JOB_LABELS: Record<JobType, string> = {
  merge: '합치기',
  split: '분할',
  'extract-images': '이미지 추출',
  'pages-to-images': '페이지→이미지',
};

type ActionPanelProps = {
  uploadedFileCount: number;
  uploadedFileName: string | null;
  uploadedFiles: RegisteredPdf[];
  primaryPdfPageCount: number | null;
  splitGroupStatus: SplitGroupStatus;
  onSplitGroupStatusChange: (status: SplitGroupStatus) => void;
  onReorderUploadedFiles: (orderedFileIds: string[]) => void;
};

type MergeOrderItemProps = {
  id: string;
  index: number;
  name: string;
};

function MergeOrderItem({ id, index, name }: MergeOrderItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li ref={setNodeRef} style={style} className={`merge-order-item${isDragging ? ' is-dragging' : ''}`}>
      <button type="button" className="merge-order-handle" aria-label={`${name} 순서 이동`} {...attributes} {...listeners}>
        ⋮⋮
      </button>
      <span className="merge-order-index">{index + 1}</span>
      <span className="merge-order-name">{name}</span>
    </li>
  );
}

function createSplitFileName(fileName: string | null): string {
  if (!fileName) {
    return '분할_파일_001.pdf';
  }
  const dotIndex = fileName.lastIndexOf('.');
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  return `${baseName}_001.pdf`;
}

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

export default function ActionPanel({
  uploadedFileCount,
  uploadedFileName,
  uploadedFiles,
  primaryPdfPageCount,
  splitGroupStatus,
  onSplitGroupStatusChange,
  onReorderUploadedFiles,
}: ActionPanelProps) {
  const activeJobType = useAppStore((state) => state.activeJobType);
  const extractionOptions = useAppStore((state) => state.extractionOptions);
  const setExtractionOptions = useAppStore((state) => state.setExtractionOptions);
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 110,
        tolerance: 8,
      },
    }),
  );

  const onMergeOrderDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const fileIds = uploadedFiles.map((file) => file.id);
    const oldIndex = fileIds.indexOf(String(active.id));
    const newIndex = fileIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
      return;
    }
    onReorderUploadedFiles(arrayMove(fileIds, oldIndex, newIndex));
  };

  if (!activeJobType) {
    return null;
  }

  if (activeJobType === 'split') {
    const selectedPages = countSelectedPages(splitGroupStatus.latestRange);
    const generatedFileCount = splitGroupStatus.latestRange ? 1 : 0;

    return (
      <section aria-label="작업 인스펙터 패널" className="action-panel">
        <h2>분할 설정</h2>
        <p className="action-panel__description">선택한 범위를 기준으로 PDF를 분할합니다.</p>

        <section className="inspector-settings" aria-label="분할 방식">
          <h3>분할 방식</h3>
          <div className="split-mode-buttons">
            <button type="button" className="split-mode-btn is-selected" aria-current="true">
              페이지 범위로 분할
            </button>
            <button type="button" className="split-mode-btn" disabled>
              페이지 수로 분할
            </button>
          </div>
        </section>

        <SplitGroupEditor
          uploadedFileCount={uploadedFileCount}
          totalPages={primaryPdfPageCount}
          onStatusChange={onSplitGroupStatusChange}
        />

        <section className="inspector-card" aria-label="생성될 파일">
          <header>
            <h3>생성될 파일</h3>
            <span>{generatedFileCount}개</span>
          </header>
          <p>파일명(접미사)</p>
          <div className="filename-preview">
            <input type="text" readOnly value={createSplitFileName(uploadedFileName)} aria-label="생성 파일 이름" />
            <strong>.pdf</strong>
          </div>
          <p className="inspector-card__range">
            페이지 {splitGroupStatus.latestRange ?? '-'} {selectedPages > 0 ? `(총 ${selectedPages}페이지)` : ''}
          </p>
        </section>
      </section>
    );
  }

  return (
    <section aria-label="작업 인스펙터 패널" className="action-panel">
      <h2>{JOB_LABELS[activeJobType]} 설정</h2>
      <p className="inspector-job-label">현재 작업: {JOB_LABELS[activeJobType]}</p>

      <section aria-label="작업 세부 설정" className="inspector-settings">
        {activeJobType === 'merge' ? <p>업로드된 파일 전체를 하나의 PDF로 병합합니다.</p> : null}
        {activeJobType === 'merge' ? (
          <section className="merge-order-box" aria-label="병합 파일 순서">
            <h3>병합 파일 순서</h3>
            <p>드래그로 순서를 바꾸면 썸네일 프리뷰와 최종 병합 순서에 동시에 반영됩니다.</p>
            {uploadedFiles.length < 2 ? (
              <p className="merge-order-empty">PDF를 2개 이상 업로드하면 순서를 조정할 수 있습니다.</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onMergeOrderDragEnd}>
                <SortableContext items={uploadedFiles.map((file) => file.id)} strategy={verticalListSortingStrategy}>
                  <ul className="merge-order-list">
                    {uploadedFiles.map((file, index) => (
                      <MergeOrderItem key={file.id} id={file.id} index={index} name={file.name} />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </section>
        ) : null}

        {activeJobType === 'extract-images' ? (
          <p>업로드된 모든 PDF에서 이미지를 추출하며 기본 옵션(원본 인코딩 우선, 변환 해제)으로 자동 처리됩니다.</p>
        ) : null}

        {activeJobType === 'pages-to-images' ? (
          <fieldset className="inspector-fieldset">
            <legend>업로드된 모든 PDF의 페이지 이미지 변환 옵션</legend>
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
    </section>
  );
}
