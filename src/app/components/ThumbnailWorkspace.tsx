import UploadZone from './UploadZone';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../state/store';
import type { ThumbnailPreview } from '../hooks/usePdfWorkflow';

type ThumbnailWorkspaceProps = {
  uploadedFileCount: number;
  primaryPdfPageCount: number | null;
  primaryFileSizeBytes: number | null;
  uploadedFileNames: string[];
  thumbnails: ThumbnailPreview[];
  isThumbnailLoading: boolean;
  thumbnailError: string | null;
  onFilesSelected: (files: FileList | null) => void | Promise<void>;
  selectedRange: string | null;
};

function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes < 1) {
    return '-';
  }
  const mb = bytes / (1024 * 1024);
  if (mb >= 10) {
    return `${mb.toFixed(1)} MB`;
  }
  return `${mb.toFixed(2)} MB`;
}

function resolveSelectedPages(range: string | null, totalPages: number): Set<number> {
  if (!range || totalPages < 1) {
    return new Set<number>();
  }
  const selected = new Set<number>();
  const tokens = range
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  tokens.forEach((token) => {
    const [startToken, endToken] = token.split('-').map((value) => Number(value));
    if (Number.isInteger(startToken) && Number.isInteger(endToken)) {
      const start = Math.max(1, Math.min(startToken, endToken));
      const end = Math.min(totalPages, Math.max(startToken, endToken));
      for (let page = start; page <= end; page += 1) {
        selected.add(page);
      }
      return;
    }
    if (Number.isInteger(startToken)) {
      const page = Math.max(1, Math.min(totalPages, startToken));
      selected.add(page);
    }
  });

  return selected;
}

function toThumbnailKey(thumbnail: ThumbnailPreview): string {
  return `${thumbnail.fileId}:${thumbnail.pageNumber}`;
}

export default function ThumbnailWorkspace({
  uploadedFileCount,
  primaryPdfPageCount,
  primaryFileSizeBytes,
  uploadedFileNames,
  thumbnails,
  isThumbnailLoading,
  thumbnailError,
  onFilesSelected,
  selectedRange,
}: ThumbnailWorkspaceProps) {
  const activeJobType = useAppStore((state) => state.activeJobType);
  const hasFiles = uploadedFileCount > 0;
  const [selectedThumbnailKey, setSelectedThumbnailKey] = useState<string | null>(null);
  const primaryTotalPages = primaryPdfPageCount ?? thumbnails.filter((thumbnail) => thumbnail.fileIndex === 0).length;
  const previewTotalPages = thumbnails.length > 0 ? thumbnails.length : primaryTotalPages;
  const selectedRangePages = useMemo(() => resolveSelectedPages(selectedRange, primaryTotalPages), [primaryTotalPages, selectedRange]);
  const shouldShowFileSeparators = uploadedFileCount > 1;
  const fileName =
    uploadedFileCount > 1
      ? `${uploadedFileNames[0] ?? '선택한 PDF'} 외 ${Math.max(0, uploadedFileCount - 1)}개`
      : uploadedFileNames[0] ?? '선택한 PDF';

  useEffect(() => {
    if (thumbnails.length < 1) {
      setSelectedThumbnailKey(null);
      return;
    }
    if (!selectedThumbnailKey || !thumbnails.some((thumbnail) => toThumbnailKey(thumbnail) === selectedThumbnailKey)) {
      setSelectedThumbnailKey(toThumbnailKey(thumbnails[0]));
    }
  }, [selectedThumbnailKey, thumbnails]);

  return (
    <section aria-label="썸네일 작업 영역" className="thumbnail-workspace">
      {!hasFiles ? (
        <UploadZone uploadedFileCount={uploadedFileCount} uploadedFileNames={uploadedFileNames} onFilesSelected={onFilesSelected} />
      ) : (
        <>
          <header className="workspace-header workspace-header--canvas">
            <div className="workspace-file-meta">
              <h2>{fileName}</h2>
              <p>
                총 {previewTotalPages}페이지 <span>|</span> {formatFileSize(primaryFileSizeBytes)}
              </p>
            </div>

            <div className="workspace-canvas-controls" aria-label="캔버스 제어">
              <button type="button" className="canvas-icon-btn" aria-label="실행 취소">
                ↶
              </button>
              <button type="button" className="canvas-icon-btn" aria-label="다시 실행">
                ↷
              </button>
              <div className="zoom-control">
                <button type="button" className="canvas-icon-btn" aria-label="축소">
                  −
                </button>
                <input type="range" min={60} max={180} defaultValue={100} aria-label="줌 비율" />
                <button type="button" className="canvas-icon-btn" aria-label="확대">
                  +
                </button>
              </div>
              <div className="view-toggle">
                <button type="button" className="canvas-icon-btn is-active" aria-label="그리드 보기">
                  ▦
                </button>
                <button type="button" className="canvas-icon-btn" aria-label="목록 보기">
                  ☰
                </button>
              </div>
            </div>
          </header>

          <div aria-label="썸네일 목록" aria-busy={isThumbnailLoading} className="thumbnail-canvas">
            {thumbnailError ? <p className="progress-error">{thumbnailError}</p> : null}
            {thumbnails.length === 0 && !thumbnailError ? <p>업로드된 PDF 미리보기를 준비 중입니다.</p> : null}
            {thumbnails.length > 0 ? (
              <ul className="thumbnail-grid" aria-label="PDF 페이지 썸네일 목록">
                {thumbnails.map((thumbnail, index) => {
                  const thumbnailKey = toThumbnailKey(thumbnail);
                  const isSelected = selectedThumbnailKey === thumbnailKey;
                  const isInSelectedRange = thumbnail.fileIndex === 0 && selectedRangePages.has(thumbnail.pageNumber);
                  const startsAnotherPdf =
                    shouldShowFileSeparators && (index === 0 || thumbnails[index - 1].fileId !== thumbnail.fileId);
                  return (
                    <Fragment key={thumbnailKey}>
                      {startsAnotherPdf ? (
                        <li className="thumbnail-separator" role="separator" aria-label={`${thumbnail.fileName} 시작`}>
                          <span>{thumbnail.fileName} 시작</span>
                        </li>
                      ) : null}
                      <li className={`thumbnail-card${isSelected ? ' is-selected' : ''}${isInSelectedRange ? ' is-in-range' : ''}`}>
                        <button type="button" className="thumbnail-card__button" onClick={() => setSelectedThumbnailKey(thumbnailKey)}>
                          {thumbnail.imageUrl ? (
                            <img
                              src={thumbnail.imageUrl}
                              alt={`${thumbnail.fileName} ${thumbnail.pageNumber}페이지 썸네일`}
                              className="thumbnail-card__image"
                              loading="lazy"
                            />
                          ) : (
                            <div className="thumbnail-card__placeholder">{thumbnail.status === 'failed' ? '생성 실패' : '로딩 중'}</div>
                          )}
                          {isSelected ? <span className="thumbnail-card__check">✓</span> : null}
                          <p className="thumbnail-card__label">{thumbnail.pageNumber}</p>
                        </button>
                      </li>
                    </Fragment>
                  );
                })}
              </ul>
            ) : null}
            {isThumbnailLoading ? <p className="thumbnail-loading-hint">추가 썸네일을 순차적으로 불러오는 중입니다.</p> : null}
          </div>
          {!activeJobType ? <p className="workspace-hint">상단 작업 선택에서 원하는 작업을 먼저 고르세요.</p> : null}
        </>
      )}
    </section>
  );
}
