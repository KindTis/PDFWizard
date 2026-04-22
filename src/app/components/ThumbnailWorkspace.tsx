import UploadZone from './UploadZone';
import SplitGroupEditor, { type SplitGroupStatus } from './SplitGroupEditor';
import { useAppStore } from '../state/store';
import type { ThumbnailPreview } from '../hooks/usePdfWorkflow';
import type { JobType } from '../../worker/protocol';

type ThumbnailWorkspaceProps = {
  uploadedFileCount: number;
  primaryPdfPageCount: number | null;
  uploadedFileNames: string[];
  thumbnails: ThumbnailPreview[];
  isThumbnailLoading: boolean;
  thumbnailError: string | null;
  onFilesSelected: (files: FileList | null) => void | Promise<void>;
  onSplitGroupStatusChange?: (status: SplitGroupStatus) => void;
};

export default function ThumbnailWorkspace({
  uploadedFileCount,
  primaryPdfPageCount,
  uploadedFileNames,
  thumbnails,
  isThumbnailLoading,
  thumbnailError,
  onFilesSelected,
  onSplitGroupStatusChange,
}: ThumbnailWorkspaceProps) {
  const activeJobType = useAppStore((state) => state.activeJobType);
  const hasFiles = uploadedFileCount > 0;

  const jobDescriptionMap: Record<JobType, string> = {
    merge: '업로드된 PDF 파일 순서대로 하나의 파일로 병합합니다.',
    split: '페이지 범위를 그룹으로 지정해 여러 파일로 분할합니다.',
    'extract-images': 'PDF 내부에 포함된 이미지를 원본 중심으로 추출합니다.',
    'pages-to-images': '각 페이지를 렌더링해 이미지 파일로 변환합니다.',
  };

  return (
    <section aria-label="썸네일 작업 영역" className="thumbnail-workspace">
      {!hasFiles ? (
        <UploadZone uploadedFileCount={uploadedFileCount} uploadedFileNames={uploadedFileNames} onFilesSelected={onFilesSelected} />
      ) : (
        <>
          <header className="workspace-header">
            <h2>미리보기 캔버스</h2>
            {!activeJobType ? <p>작업을 선택하면 해당 작업 도구와 인스펙터가 활성화됩니다.</p> : null}
          </header>
          <UploadZone uploadedFileCount={uploadedFileCount} uploadedFileNames={uploadedFileNames} onFilesSelected={onFilesSelected} />
          <div aria-label="썸네일 목록" aria-busy={isThumbnailLoading}>
            {thumbnailError ? <p className="progress-error">{thumbnailError}</p> : null}
            {thumbnails.length === 0 && !thumbnailError ? <p>업로드된 PDF 미리보기를 준비 중입니다.</p> : null}
            {thumbnails.length > 0 ? (
              <ul className="thumbnail-grid" aria-label="PDF 페이지 썸네일 목록">
                {thumbnails.map((thumbnail) => (
                  <li key={thumbnail.pageNumber} className="thumbnail-card">
                    {thumbnail.imageUrl ? (
                      <img
                        src={thumbnail.imageUrl}
                        alt={`페이지 ${thumbnail.pageNumber} 썸네일`}
                        className="thumbnail-card__image"
                        loading="lazy"
                      />
                    ) : (
                      <div className="thumbnail-card__placeholder">{thumbnail.status === 'failed' ? '생성 실패' : '로딩 중'}</div>
                    )}
                    <p className="thumbnail-card__label">페이지 {thumbnail.pageNumber}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            {isThumbnailLoading ? <p className="thumbnail-loading-hint">추가 썸네일을 순차적으로 불러오는 중입니다.</p> : null}
          </div>
          {!activeJobType ? (
            <section className="selected-tool-panel is-empty" aria-label="선택된 작업 도구">
              <h3>선택된 작업 도구</h3>
              <p>상단 작업 선택에서 원하는 작업을 먼저 고르세요.</p>
            </section>
          ) : (
            <section className="selected-tool-panel" aria-label="선택된 작업 도구">
              <h3>선택된 작업 도구</h3>
              <p>{jobDescriptionMap[activeJobType]}</p>
              {activeJobType === 'split' ? (
                <SplitGroupEditor
                  uploadedFileCount={uploadedFileCount}
                  totalPages={primaryPdfPageCount}
                  onStatusChange={onSplitGroupStatusChange}
                />
              ) : null}
            </section>
          )}
        </>
      )}
    </section>
  );
}
