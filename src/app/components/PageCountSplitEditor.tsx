import { useEffect, useMemo, useState } from 'react';
import type { SplitGroup } from '../../worker/protocol';
import {
  createSplitGroupsByPageCount,
  formatSplitGroupSummary,
  getTotalPageCount,
} from '../../domain/crossPdfSplit';
import type { RegisteredPdf } from '../state/fileRegistry';
import type { SplitGroupStatus } from './SplitGroupEditor';

const EMPTY_STATUS: SplitGroupStatus = {
  groupCount: 0,
  latestRange: null,
  mergedRange: null,
  groups: [],
  previewGroups: [],
};

type PageCountSplitEditorProps = {
  uploadedFiles: RegisteredPdf[];
  onStatusChange?: (status: SplitGroupStatus) => void;
};

function countGroupPages(group: SplitGroup): number {
  return group.segments.reduce((sum, segment) => sum + segment.endPage - segment.startPage + 1, 0);
}

export default function PageCountSplitEditor({ uploadedFiles, onStatusChange }: PageCountSplitEditorProps) {
  const [pagesPerGroup, setPagesPerGroup] = useState(1);
  const splitSources = useMemo(
    () =>
      uploadedFiles.map((file) => ({
        ...file,
        pageCount: Number.isInteger(file.pageCount) && (file.pageCount as number) > 0 ? file.pageCount : 5,
      })),
    [uploadedFiles],
  );
  const totalPages = useMemo(() => getTotalPageCount(splitSources), [splitSources]);
  const isInvalid = !Number.isInteger(pagesPerGroup) || pagesPerGroup < 1;
  const groups = useMemo(() => {
    try {
      return createSplitGroupsByPageCount(splitSources, pagesPerGroup);
    } catch {
      return [];
    }
  }, [pagesPerGroup, splitSources]);
  const status = useMemo<SplitGroupStatus>(() => {
    if (isInvalid || totalPages < 1 || groups.length === 0) {
      return EMPTY_STATUS;
    }
    return {
      groupCount: groups.length,
      latestRange: groups[0]?.globalRange ?? null,
      mergedRange: groups.map((group) => group.globalRange).join(','),
      groups,
      previewGroups: groups,
    };
  }, [groups, isInvalid, totalPages]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  if (uploadedFiles.length === 0 || totalPages === 0) {
    return (
      <section aria-label="페이지 수 분할 편집기" className="split-editor">
        <h3>분할 단위</h3>
        <p>분할을 위해 PDF를 업로드하세요.</p>
      </section>
    );
  }

  return (
    <section aria-label="페이지 수 분할 편집기" className="split-editor">
      <h3>분할 단위</h3>
      <label className="split-range-controls">
        <span>분할 단위</span>
        <input
          type="number"
          min={1}
          max={Math.max(1, totalPages)}
          value={pagesPerGroup}
          onChange={(event) => setPagesPerGroup(Number(event.currentTarget.value))}
          aria-label="분할 단위"
        />
      </label>
      {isInvalid ? <p className="split-range-current">분할 단위는 1 이상의 정수여야 합니다.</p> : null}
      {groups.length > 0 ? (
        <ul className="split-group-list" aria-label="자동 분할 그룹 목록">
          {groups.map((group) => (
            <li key={group.id}>
              <strong>{group.label}.pdf</strong>
              <span>
                전체 {group.globalRange} · {formatSplitGroupSummary(group, splitSources)} · 총 {countGroupPages(group)}페이지
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
