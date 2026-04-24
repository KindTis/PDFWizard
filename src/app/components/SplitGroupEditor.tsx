import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { SplitGroup } from '../../worker/protocol';
import {
  createSplitGroupFromGlobalRange,
  formatSplitGroupSummary,
  getTotalPageCount,
} from '../../domain/crossPdfSplit';
import type { RegisteredPdf } from '../state/fileRegistry';

export type SplitGroupStatus = {
  groupCount: number;
  latestRange: string | null;
  mergedRange: string | null;
  groups: SplitGroup[];
  previewGroups: SplitGroup[];
};

type SplitGroupEditorProps = {
  uploadedFiles: RegisteredPdf[];
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

function toHandleStyle(pageNumber: number, total: number): { left: string } {
  if (total <= 1) {
    return { left: '0%' };
  }
  return { left: `${((pageNumber - 1) / (total - 1)) * 100}%` };
}

function countGroupPages(group: SplitGroup): number {
  return group.segments.reduce((sum, segment) => sum + segment.endPage - segment.startPage + 1, 0);
}

export default function SplitGroupEditor({ uploadedFiles, onStatusChange }: SplitGroupEditorProps) {
  const [draftRange, setDraftRange] = useState({ start: 1, end: 1 });
  const [groups, setGroups] = useState<SplitGroup[]>([]);
  const [activeDragHandle, setActiveDragHandle] = useState<'start' | 'end' | null>(null);
  const rangeTrackRef = useRef<HTMLDivElement | null>(null);

  const splitSources = useMemo(
    () =>
      uploadedFiles.map((file) => ({
        ...file,
        pageCount: Number.isInteger(file.pageCount) && (file.pageCount as number) > 0 ? file.pageCount : 5,
      })),
    [uploadedFiles],
  );
  const previewPageCount = useMemo(() => getTotalPageCount(splitSources), [splitSources]);
  const selectedRange = useMemo(() => toRangeToken(draftRange.start, draftRange.end), [draftRange.end, draftRange.start]);
  const draftGroup = useMemo(() => {
    if (previewPageCount < 1) {
      return null;
    }
    try {
      return createSplitGroupFromGlobalRange(splitSources, draftRange.start, draftRange.end, groups.length + 1);
    } catch {
      return null;
    }
  }, [draftRange.end, draftRange.start, groups.length, previewPageCount, splitSources]);
  const effectiveGroups = useMemo(() => (groups.length > 0 ? groups : draftGroup ? [draftGroup] : []), [draftGroup, groups]);
  const previewGroups = useMemo(
    () => (groups.length > 0 ? [...groups, ...(draftGroup ? [draftGroup] : [])] : effectiveGroups),
    [draftGroup, effectiveGroups, groups],
  );
  const latestRange = draftGroup?.globalRange ?? null;
  const mergedRange = effectiveGroups.length > 0 ? effectiveGroups.map((group) => group.globalRange).join(',') : null;
  const selectedRangeBarStyle = useMemo(
    () => toRangeBarStyle(draftRange.start, draftRange.end, previewPageCount),
    [draftRange.end, draftRange.start, previewPageCount],
  );
  const startHandleStyle = useMemo(() => toHandleStyle(draftRange.start, previewPageCount), [draftRange.start, previewPageCount]);
  const endHandleStyle = useMemo(() => toHandleStyle(draftRange.end, previewPageCount), [draftRange.end, previewPageCount]);

  useEffect(() => {
    if (uploadedFiles.length > 0) {
      return;
    }
    setDraftRange({ start: 1, end: 1 });
    setGroups([]);
  }, [uploadedFiles.length]);

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
      groupCount: effectiveGroups.length,
      latestRange,
      mergedRange,
      groups: effectiveGroups,
      previewGroups,
    });
  }, [effectiveGroups, latestRange, mergedRange, onStatusChange, previewGroups]);

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

  const updateRangeFromClientX = (handle: 'start' | 'end', clientX: number) => {
    const rect = rangeTrackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || previewPageCount < 1) {
      return;
    }
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const page = clamp(Math.round(ratio * Math.max(0, previewPageCount - 1)) + 1, 1, previewPageCount);
    if (handle === 'start') {
      updateStart(page);
      return;
    }
    updateEnd(page);
  };

  useEffect(() => {
    if (!activeDragHandle) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      updateRangeFromClientX(activeDragHandle, event.clientX);
    };
    const onPointerUp = () => {
      setActiveDragHandle(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  });

  const beginHandleDrag = (handle: 'start' | 'end', event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.focus();
    setActiveDragHandle(handle);
    updateRangeFromClientX(handle, event.clientX);
  };

  const handleSliderKeyDown = (handle: 'start' | 'end', event: KeyboardEvent<HTMLDivElement>) => {
    const currentValue = handle === 'start' ? draftRange.start : draftRange.end;
    let nextValue: number | null = null;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      nextValue = currentValue - 1;
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      nextValue = currentValue + 1;
    } else if (event.key === 'Home') {
      nextValue = 1;
    } else if (event.key === 'End') {
      nextValue = previewPageCount;
    }

    if (nextValue === null) {
      return;
    }
    event.preventDefault();
    if (handle === 'start') {
      updateStart(nextValue);
      return;
    }
    updateEnd(nextValue);
  };

  const addCurrentGroup = () => {
    if (!draftGroup) {
      return;
    }
    setGroups((current) => [
      ...current,
      {
        ...draftGroup,
        id: `split-group-${current.length + 1}`,
        label: `split-part-${current.length + 1}`,
      },
    ]);
  };

  const removeGroup = (groupId: string) => {
    setGroups((current) =>
      current
        .filter((group) => group.id !== groupId)
        .map((group, index) => ({
          ...group,
          id: `split-group-${index + 1}`,
          label: `split-part-${index + 1}`,
        })),
    );
  };

  return (
    <section aria-label="분할 그룹 편집기" className="split-editor">
      <h3>분할 범위</h3>

      {uploadedFiles.length === 0 || previewPageCount === 0 ? (
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
                  aria-label="전체 시작 페이지"
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
                  aria-label="전체 끝 페이지"
                />
              </label>
            </div>
          </div>

          <div className="split-range-scale" aria-hidden="true">
            <span>1</span>
            <span>{previewPageCount}</span>
          </div>

          <div className="split-range-visual" aria-label="현재 선택 범위 시각화">
            <div className="split-range-visual__track" ref={rangeTrackRef}>
              <div className="split-range-track__active" style={selectedRangeBarStyle} />
            </div>
            <div className="split-range-handles">
              <div
                role="slider"
                tabIndex={0}
                className="split-range-handle is-start"
                style={startHandleStyle}
                aria-label="전체 시작 슬라이더"
                aria-valuemin={1}
                aria-valuemax={Math.max(1, previewPageCount)}
                aria-valuenow={draftRange.start}
                onPointerDown={(event) => beginHandleDrag('start', event)}
                onKeyDown={(event) => handleSliderKeyDown('start', event)}
              >
                <span className="split-range-handle__label">시작</span>
                <span className="split-range-handle__thumb" aria-hidden="true" />
              </div>
              <div
                role="slider"
                tabIndex={0}
                className="split-range-handle is-end"
                style={endHandleStyle}
                aria-label="전체 끝 슬라이더"
                aria-valuemin={1}
                aria-valuemax={Math.max(1, previewPageCount)}
                aria-valuenow={draftRange.end}
                onPointerDown={(event) => beginHandleDrag('end', event)}
                onKeyDown={(event) => handleSliderKeyDown('end', event)}
              >
                <span className="split-range-handle__thumb" aria-hidden="true" />
                <span className="split-range-handle__label">끝</span>
              </div>
            </div>
          </div>
          <p className="split-range-current">
            전체 {selectedRange} (총 {Math.max(1, draftRange.end - draftRange.start + 1)}페이지)
          </p>
          <button type="button" className="split-mode-btn" onClick={addCurrentGroup} disabled={!draftGroup}>
            분할 그룹 추가
          </button>
          {groups.length > 0 ? (
            <ul className="split-group-list" aria-label="분할 그룹 목록">
              {groups.map((group) => (
                <li key={group.id}>
                  <strong>{group.label}.pdf</strong>
                  <span>
                    전체 {group.globalRange} · {formatSplitGroupSummary(group, splitSources)} · 총 {countGroupPages(group)}페이지
                  </span>
                  <button type="button" onClick={() => removeGroup(group.id)} aria-label={`${group.label} 삭제`}>
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          ) : draftGroup ? (
            <p className="split-range-current">{formatSplitGroupSummary(draftGroup, splitSources)}</p>
          ) : null}
        </>
      )}
    </section>
  );
}
