import UploadZone from './UploadZone';
import SplitGroupEditor, { type SplitGroupStatus } from './SplitGroupEditor';
import { useAppStore } from '../state/store';

type ThumbnailWorkspaceProps = {
  uploadedFileCount: number;
  primaryPdfPageCount: number | null;
  uploadedFileNames: string[];
  onFilesSelected: (files: FileList | null) => void | Promise<void>;
  onSplitGroupStatusChange?: (status: SplitGroupStatus) => void;
};

export default function ThumbnailWorkspace({
  uploadedFileCount,
  primaryPdfPageCount,
  uploadedFileNames,
  onFilesSelected,
  onSplitGroupStatusChange,
}: ThumbnailWorkspaceProps) {
  const activeJobType = useAppStore((state) => state.activeJobType);

  return (
    <section aria-label="썸네일 작업 영역">
      <h2>페이지 썸네일</h2>
      <UploadZone uploadedFileCount={uploadedFileCount} uploadedFileNames={uploadedFileNames} onFilesSelected={onFilesSelected} />
      <div aria-label="썸네일 목록">
        {uploadedFileCount === 0 ? <p>업로드 후 페이지 썸네일이 표시됩니다.</p> : <p>업로드된 PDF 미리보기를 준비 중입니다.</p>}
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
