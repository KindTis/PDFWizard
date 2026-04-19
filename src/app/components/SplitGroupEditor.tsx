import { useEffect, useMemo, useState } from 'react';

export type SplitGroupStatus = {
  groupCount: number;
  latestRange: string | null;
  mergedRange: string | null;
};

type SplitGroup = {
  id: string;
  start: number;
  end: number;
  range: string;
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
  const width = Math.max((right - left) * 100, 100 / safeTotal);
  return {
    left: `${left}%`,
    width: `${width}%`,
  };
}

export default function SplitGroupEditor({ uploadedFileCount, totalPages, onStatusChange }: SplitGroupEditorProps) {
  const [draftRange, setDraftRange] = useState({ start: 1, end: 1 });
  const [groups, setGroups] = useState<SplitGroup[]>([]);

  const previewPageCount = useMemo(() => getPreviewPageCount(uploadedFileCount, totalPages), [totalPages, uploadedFileCount]);
  const selectedRange = useMemo(() => toRangeToken(draftRange.start, draftRange.end), [draftRange.end, draftRange.start]);
  const mergedRange = useMemo(
    () => (groups.length > 0 ? groups.map((group) => group.range).join(',') : previewPageCount > 0 ? selectedRange : null),
    [groups, previewPageCount, selectedRange],
  );
  const latestRange = useMemo(
    () => (groups.length > 0 ? groups[groups.length - 1].range : previewPageCount > 0 ? selectedRange : null),
    [groups, previewPageCount, selectedRange],
  );
  const selectedRangeBarStyle = useMemo(
    () => toRangeBarStyle(draftRange.start, draftRange.end, previewPageCount),
    [draftRange.end, draftRange.start, previewPageCount],
  );

  useEffect(() => {
    if (uploadedFileCount > 0) {
      return;
    }
    setDraftRange({ start: 1, end: 1 });
    setGroups([]);
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
      groupCount: groups.length,
      latestRange,
      mergedRange,
    });
  }, [groups.length, latestRange, mergedRange, onStatusChange]);

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

  const addGroup = () => {
    if (previewPageCount < 1) {
      return;
    }
    const range = toRangeToken(draftRange.start, draftRange.end);
    setGroups((current) => [
      ...current,
      {
        id: `group-${current.length + 1}`,
        start: draftRange.start,
        end: draftRange.end,
        range,
      },
    ]);
  };

  const removeGroup = (id: string) => {
    setGroups((current) => current.filter((group) => group.id !== id));
  };

  return (
    <section aria-label="분할 그룹 편집기">
      <h3>분할 그룹 편집</h3>

      {uploadedFileCount === 0 ? (
        <p>분할 그룹 편집을 위해 PDF를 업로드하세요.</p>
      ) : (
        <>
          <p>전체 페이지: {previewPageCount}</p>
          <div className="split-range-visual" aria-label="현재 선택 범위 시각화">
            <div className="split-range-track">
              <div className="split-range-track__active" style={selectedRangeBarStyle} />
            </div>
            <p>현재 선택 범위: {selectedRange}</p>
          </div>

          <div className="split-range-controls">
            <label>
              시작 페이지
              <input
                type="number"
                min={1}
                max={Math.max(1, previewPageCount)}
                value={draftRange.start}
                onChange={(event) => updateStart(Number(event.currentTarget.value))}
              />
            </label>
            <label>
              끝 페이지
              <input
                type="number"
                min={1}
                max={Math.max(1, previewPageCount)}
                value={draftRange.end}
                onChange={(event) => updateEnd(Number(event.currentTarget.value))}
              />
            </label>
          </div>

          <div className="split-range-sliders">
            <label>
              시작 슬라이더
              <input
                type="range"
                min={1}
                max={Math.max(1, previewPageCount)}
                value={draftRange.start}
                onChange={(event) => updateStart(Number(event.currentTarget.value))}
              />
            </label>
            <label>
              끝 슬라이더
              <input
                type="range"
                min={1}
                max={Math.max(1, previewPageCount)}
                value={draftRange.end}
                onChange={(event) => updateEnd(Number(event.currentTarget.value))}
              />
            </label>
          </div>

          <button type="button" onClick={addGroup} disabled={previewPageCount < 1}>
            범위 추가
          </button>

          <section aria-label="분할 그룹 목록">
            {groups.length === 0 ? (
              <p>추가된 그룹이 없습니다.</p>
            ) : (
              <ul className="split-group-list">
                {groups.map((group, index) => (
                  <li key={group.id}>
                    <div className="split-group-item__header">
                      <span>
                        그룹 {index + 1}: {group.range}
                      </span>
                      <button type="button" onClick={() => removeGroup(group.id)}>
                        삭제
                      </button>
                    </div>
                    <div className="split-range-track split-range-track--group">
                      <div className="split-range-track__active" style={toRangeBarStyle(group.start, group.end, previewPageCount)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  );
}
