import type { SplitGroup, SplitSegment } from '../worker/protocol';

export type SplitSource = {
  id: string;
  name: string;
  pageCount?: number | null;
};

export type SplitGroupBadge = {
  id: string;
  label: string;
  title: string;
};

function isKnownPageCount(pageCount: number | null | undefined): pageCount is number {
  return Number.isInteger(pageCount) && (pageCount as number) > 0;
}

export function getTotalPageCount(files: SplitSource[]): number {
  return files.reduce((sum, file) => sum + (isKnownPageCount(file.pageCount) ? file.pageCount : 0), 0);
}

export function getGlobalPageNumber(files: SplitSource[], fileId: string, pageNumber: number): number | null {
  let offset = 0;
  for (const file of files) {
    if (!isKnownPageCount(file.pageCount)) {
      continue;
    }
    if (file.id === fileId) {
      if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > file.pageCount) {
        return null;
      }
      return offset + pageNumber;
    }
    offset += file.pageCount;
  }
  return null;
}

export function resolveVirtualRange(files: SplitSource[], startGlobalPage: number, endGlobalPage: number): SplitSegment[] {
  const totalPages = getTotalPageCount(files);
  if (
    totalPages < 1 ||
    !Number.isInteger(startGlobalPage) ||
    !Number.isInteger(endGlobalPage) ||
    startGlobalPage < 1 ||
    endGlobalPage > totalPages ||
    startGlobalPage > endGlobalPage
  ) {
    throw new Error('OUT_OF_RANGE');
  }

  const segments: SplitSegment[] = [];
  let offset = 0;

  for (const file of files) {
    if (!isKnownPageCount(file.pageCount)) {
      continue;
    }

    const fileStartGlobal = offset + 1;
    const fileEndGlobal = offset + file.pageCount;
    const overlapStart = Math.max(startGlobalPage, fileStartGlobal);
    const overlapEnd = Math.min(endGlobalPage, fileEndGlobal);

    if (overlapStart <= overlapEnd) {
      segments.push({
        fileId: file.id,
        startPage: overlapStart - offset,
        endPage: overlapEnd - offset,
      });
    }

    offset += file.pageCount;
  }

  if (segments.length === 0) {
    throw new Error('OUT_OF_RANGE');
  }

  return segments;
}

export function toGlobalRangeToken(startGlobalPage: number, endGlobalPage: number): string {
  return startGlobalPage === endGlobalPage ? String(startGlobalPage) : `${startGlobalPage}-${endGlobalPage}`;
}

export function createSplitGroupFromGlobalRange(
  files: SplitSource[],
  startGlobalPage: number,
  endGlobalPage: number,
  index: number,
): SplitGroup {
  const globalRange = toGlobalRangeToken(startGlobalPage, endGlobalPage);
  return {
    id: `split-group-${index}`,
    label: `split-part-${index}`,
    globalRange,
    segments: resolveVirtualRange(files, startGlobalPage, endGlobalPage),
  };
}

function formatSegmentRange(segment: SplitSegment): string {
  return segment.startPage === segment.endPage ? `${segment.startPage}페이지` : `${segment.startPage}-${segment.endPage}페이지`;
}

export function formatSplitGroupSummary(group: SplitGroup, files: SplitSource[]): string {
  const fileById = new Map(files.map((file) => [file.id, file]));
  return group.segments
    .map((segment) => {
      const file = fileById.get(segment.fileId);
      return `${file?.name ?? '알 수 없는 PDF'} ${formatSegmentRange(segment)}`;
    })
    .join(' → ');
}

export function isPageInSplitGroups(fileId: string, pageNumber: number, groups: SplitGroup[]): boolean {
  return groups.some((group) =>
    group.segments.some(
      (segment) => segment.fileId === fileId && pageNumber >= segment.startPage && pageNumber <= segment.endPage,
    ),
  );
}

export function getPageSplitGroupBadges(fileId: string, pageNumber: number, groups: SplitGroup[]): SplitGroupBadge[] {
  return groups.reduce<SplitGroupBadge[]>((badges, group, index) => {
    const containsPage = group.segments.some(
      (segment) => segment.fileId === fileId && pageNumber >= segment.startPage && pageNumber <= segment.endPage,
    );
    if (!containsPage) {
      return badges;
    }
    badges.push({
      id: group.id,
      label: `G${index + 1}`,
      title: group.label,
    });
    return badges;
  }, []);
}
