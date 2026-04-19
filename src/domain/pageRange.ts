function assertInteger(value: number): void {
  if (!Number.isInteger(value)) {
    throw new Error('OUT_OF_RANGE');
  }
}

function addRange(target: Set<number>, start: number, end: number): void {
  for (let page = start; page <= end; page += 1) {
    target.add(page);
  }
}

export function parsePageRange(input: string, maxPage: number): number[] {
  assertInteger(maxPage);
  if (maxPage < 1) {
    throw new Error('OUT_OF_RANGE');
  }

  const tokens = input
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    throw new Error('OUT_OF_RANGE');
  }

  const pages = new Set<number>();

  for (const token of tokens) {
    const rangeMatch = token.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      assertInteger(start);
      assertInteger(end);
      if (start < 1 || end > maxPage || start > end) {
        throw new Error('OUT_OF_RANGE');
      }
      addRange(pages, start, end);
      continue;
    }

    const page = Number(token);
    assertInteger(page);
    if (page < 1 || page > maxPage) {
      throw new Error('OUT_OF_RANGE');
    }
    pages.add(page);
  }

  return [...pages].sort((a, b) => a - b);
}