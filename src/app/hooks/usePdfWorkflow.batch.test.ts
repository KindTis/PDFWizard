import { describe, expect, it, vi } from 'vitest';
import type { Artifact, BinaryFile, JobReport, PagesToImagesRequest } from '../../worker/protocol';
import { buildReportJson } from '../utils/report';
import { runExtractImagesBatch, runPagesToImagesBatch } from './usePdfWorkflow';

function file(id: string, name: string, pageCount?: number): BinaryFile & { pageCount?: number } {
  return {
    id,
    name,
    bytes: new ArrayBuffer(8),
    pageCount,
  };
}

function artifact(name: string, bytes = 1): Artifact {
  return {
    name,
    mime: 'application/octet-stream',
    bytes: new Uint8Array([bytes]),
  };
}

function reportArtifact(report: JobReport): Artifact {
  return {
    name: 'report.json',
    mime: 'application/json',
    bytes: buildReportJson({ jobId: 'source-job', ...report }),
  };
}

describe('workflow batch jobs', () => {
  it('runs extract-images once per uploaded PDF and combines reports', async () => {
    const files = [file('a', 'A.pdf'), file('b', 'B.pdf')];
    const runFile = vi.fn(async (source: BinaryFile) => [
      artifact('image-1.png'),
      reportArtifact({
        successCount: 1,
        convertedCount: source.id === 'a' ? 1 : 0,
        failedCount: 0,
        failedItems: [],
      }),
    ]);

    const result = await runExtractImagesBatch(files, runFile, vi.fn());
    const report = JSON.parse(new TextDecoder().decode(result.at(-1)?.bytes));

    expect(runFile).toHaveBeenCalledTimes(2);
    expect(result.map((item) => item.name)).toEqual(['A/image-1.png', 'B/image-1.png', 'report.json']);
    expect(report).toMatchObject({
      successCount: 2,
      convertedCount: 1,
      failedCount: 0,
    });
  });

  it('keeps successful extract-images artifacts and reports failed PDFs as partial failures', async () => {
    const files = [file('a', 'A.pdf'), file('b', 'B.pdf')];
    const runFile = vi.fn(async (source: BinaryFile) => {
      if (source.id === 'b') {
        throw new Error('PDF_PARSE_FAILED');
      }
      return [artifact('image-1.png')];
    });

    const result = await runExtractImagesBatch(files, runFile, vi.fn());
    const report = JSON.parse(new TextDecoder().decode(result.at(-1)?.bytes));

    expect(result.map((item) => item.name)).toEqual(['A/image-1.png', 'report.json']);
    expect(report.failedCount).toBe(1);
    expect(report.failedItems).toEqual([{ fileId: 'b', fileName: 'B.pdf', reasonCode: 'PDF_PARSE_FAILED' }]);
  });

  it('runs pages-to-images once per uploaded PDF and scopes page artifacts', async () => {
    const files = [file('a', 'A.pdf', 2), file('b', 'B.pdf', 1)];
    const runFile = vi.fn(
      async (
        request: PagesToImagesRequest,
        _source: BinaryFile,
        _fileIndex: number,
        onFileProgress: (done: number, total: number, message: string) => void,
      ) => {
        onFileProgress(1, request.payload.file.id === 'a' ? 2 : 1, 'rendered');
        return request.payload.file.id === 'a' ? [artifact('A-page-1.png'), artifact('A-page-2.png')] : [artifact('B-page-1.png')];
      },
    );

    const result = await runPagesToImagesBatch(files, { forceOutputFormat: 'png', quality: 90 }, runFile, vi.fn());
    const report = JSON.parse(new TextDecoder().decode(result.at(-1)?.bytes));

    expect(runFile).toHaveBeenCalledTimes(2);
    expect(result.map((item) => item.name)).toEqual(['A/A-page-1.png', 'A/A-page-2.png', 'B/B-page-1.png', 'report.json']);
    expect(report).toMatchObject({
      successCount: 3,
      convertedCount: 0,
      failedCount: 0,
    });
  });
});
