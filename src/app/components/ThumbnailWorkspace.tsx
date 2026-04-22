import UploadZone from './UploadZone';
import SplitGroupEditor, { type SplitGroupStatus } from './SplitGroupEditor';
import { useAppStore } from '../state/store';
import type { ThumbnailPreview } from '../hooks/usePdfWorkflow';

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

  return (
    <section aria-label="썸네일 작업 영역">
      <h2>페이지 썸네일</h2>
      <UploadZone uploadedFileCount={uploadedFileCount} uploadedFileNames={uploadedFileNames} onFilesSelected={onFilesSelected} />
      <div aria-label="썸네일 목록" aria-busy={isThumbnailLoading}>
        {uploadedFileCount === 0 ? <p>업로드 후 페이지 썸네일이 표시됩니다.</p> : null}
        {uploadedFileCount > 0 && thumbnailError ? <p className="progress-error">{thumbnailError}</p> : null}
        {uploadedFileCount > 0 && thumbnails.length === 0 && !thumbnailError ? <p>업로드된 PDF 미리보기를 준비 중입니다.</p> : null}
        {thumbnails.length > 0 ? (
          <ul className="thumbnail-grid" aria-label="PDF 페이지 썸네일 목록">
            {thumbnails.map((thumbnail) => (
              <li key={thumbnail.pageNumber} className="thumbnail-card">
                {thumbnail.imageUrl ? (
                  <img src={thumbnail.imageUrl} alt={`페이지 ${thumbnail.pageNumber} 썸네일`} className="thumbnail-card__image" loading="lazy" />
                ) : (
                  <div className="thumbnail-card__placeholder">
                    {thumbnail.status === 'failed' ? '생성 실패' : '로딩 중'}
                  </div>
                )}
                <p className="thumbnail-card__label">페이지 {thumbnail.pageNumber}</p>
              </li>
            ))}
          </ul>
        ) : null}
        {uploadedFileCount > 0 && isThumbnailLoading ? <p className="thumbnail-loading-hint">추가 썸네일을 순차적으로 불러오는 중입니다.</p> : null}
      </div>
      {activeJobType === 'split' ? (
        <SplitGroupEditor
          uploadedFileCount={uploadedFileCount}
          totalPages={primaryPdfPageCount}
          onStatusChange={onSplitGroupStatusChange}
        />
      ) : null}
    </section>
  );
}
