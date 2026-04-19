import type { FailedItem } from '../../worker/protocol';

export type ReportPayload = {
  jobId: string;
  successCount: number;
  convertedCount: number;
  failedCount: number;
  failedItems: FailedItem[];
};

export function buildReportJson(data: ReportPayload): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(data, null, 2)}\n`);
}
