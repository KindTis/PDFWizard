import { useEffect, useMemo, useState } from 'react';

export type SplitGroupStatus = {
  groupCount: number;
  latestRange: string | null;
  mergedRange: string | null;
};

type SplitGroupEditorProps = {
  uploadedFileCount: number;
  totalPages?: number | null;
  onStatusChange?: (status: SplitGroupStatus) => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toRangeToken(start: number, end: number): string {
  if (start === end) {
    return String(start);
  }
  return `${start}-${end}`;
}

function getPreviewPageCount(uploadedFileCount: number, totalPages?: number | null): number {
  if (Number.isInteger(totalPages) && (totalPages as number) > 0) {
    return totalPages as number;
  }
  return Math.min(20, Math.max(0, uploadedFileCount * 5));
}

function toRangeBarStyle(start: number, end: number, total: number): { left: string; width: string } {
  const safeTotal = Math.max(1, total);
  const left = ((start - 1) / safeTotal) * 100;
  const right = (end / safeTotal) * 100;
  const width = Math.max(right - left, 100 / safeTotal);
  return {
    left: `${left}%`,
    width: `${width}%`,
  };
}

export default function SplitGroupEditor({ uploadedFileCount, totalPages, onStatusChange }: SplitGroupEditorProps) {
  const [draftRange, setDraftRange] = useState({ start: 1, end: 1 });

  const previewPageCount = useMemo(() => getPreviewPageCount(uploadedFileCount, totalPages), [totalPages, uploadedFileCount]);
  const selectedRange = useMemo(() => toRangeToken(draftRange.start, draftRange.end), [draftRange.end, draftRange.start]);
  const latestRange = previewPageCount > 0 ? selectedRange : null;
  const mergedRange = previewPageCount > 0 ? selectedRange : null;
  const selectedRangeBarStyle = useMemo(
    () => toRangeBarStyle(draftRange.start, draftRange.end, previewPageCount),
    [draftRange.end, draftRange.start, previewPageCount],
  );

  useEffect(() => {
    if (uploadedFileCount > 0) {
      return;
    }
    setDraftRange({ start: 1, end: 1 });
  }, [uploadedFileCount]);

  useEffect(() => {
    if (previewPageCount < 1) {
      return;
    }
    setDraftRange((current) => {
      const start = clamp(current.start, 1, previewPageCount);
      const end = clamp(current.end, 1, previewPageCount);
      if (start <= end) {
        return { start, end };
      }
      return { start: end, end: start };
    });
  }, [previewPageCount]);

  useEffect(() => {
    onStatusChange?.({
      groupCount: previewPageCount > 0 ? 1 : 0,
      latestRange,
      mergedRange,
    });
  }, [latestRange, mergedRange, onStatusChange, previewPageCount]);

  const updateStart = (value: number) => {
    if (previewPageCount < 1 || !Number.isInteger(value)) {
      return;
    }
    setDraftRange((current) => {
      const start = clamp(value, 1, previewPageCount);
      const end = Math.max(start, current.end);
      return { start, end };
    });
  };

  const updateEnd = (value: number) => {
    if (previewPageCount < 1 || !Number.isInteger(value)) {
      return;
    }
    setDraftRange((current) => {
      const end = clamp(value, 1, previewPageCount);
      const start = Math.min(current.start, end);
      return { start, end };
    });
  };

  return (
    <section aria-label="분할 그룹 편집기" className="split-editor">
      <h3>분할 범위</h3>

      {uploadedFileCount === 0 ? (
        <p>분할 그룹 편집을 위해 PDF를 업로드하세요.</p>
      ) : (
        <>
          <div className="split-range-controls" aria-label="분할 페이지 입력">
            <div className="split-range-track">
              <label>
                <span className="sr-only">시작 페이지</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, previewPageCount)}
                  value={draftRange.start}
                  onChange={(event) => updateStart(Number(event.currentTarget.value))}
                  aria-label="시작 페이지"
                />
              </label>
              <strong>~</strong>
              <label>
                <span className="sr-only">끝 페이지</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, previewPageCount)}
                  value={draftRange.end}
                  onChange={(event) => updateEnd(Number(event.currentTarget.value))}
                  aria-label="끝 페이지"
                />
              </label>
            </div>
          </div>

          <div className="split-range-scale" aria-hidden="true">
            <span>1</span>
            <span>{previewPageCount}</span>
          </div>

          <div className="split-range-visual" aria-label="현재 선택 범위 시각화">
            <div className="split-range-visual__track">
              <div className="split-range-track__active" style={selectedRangeBarStyle} />
            </div>
            <div className="split-range-sliders">
              <label>
                <span className="sr-only">시작 슬라이더</span>
                <input
                  type="range"
                  min={1}
                  max={Math.max(1, previewPageCount)}
                  value={draftRange.start}
                  onChange={(event) => updateStart(Number(event.currentTarget.value))}
                  aria-label="시작 슬라이더"
                />
              </label>
              <label>
                <span className="sr-only">끝 슬라이더</span>
                <input
                  type="range"
                  min={1}
                  max={Math.max(1, previewPageCount)}
                  value={draftRange.end}
                  onChange={(event) => updateEnd(Number(event.currentTarget.value))}
                  aria-label="끝 슬라이더"
                />
              </label>
            </div>
          </div>
          <p className="split-range-current">
            {selectedRange} (총 {Math.max(1, draftRange.end - draftRange.start + 1)}페이지)
          </p>
        </>
      )}
    </section>
  );
}
