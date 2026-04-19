export function computeChunkSize(totalPages: number, memoryPressure: number): number {
  const safeTotal = Math.max(1, Math.floor(totalPages));
  const pressure = Math.max(0, Math.min(1, memoryPressure));

  if (pressure >= 0.85) {
    return Math.max(1, Math.floor(safeTotal / 40));
  }

  if (pressure >= 0.7) {
    return Math.max(1, Math.floor(safeTotal / 20));
  }

  return Math.max(1, Math.floor(safeTotal / 10));
}