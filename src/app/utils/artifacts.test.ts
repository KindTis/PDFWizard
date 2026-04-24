import { describe, expect, it } from 'vitest';
import type { Artifact, JobReport } from '../../worker/protocol';
import {
  createCombinedReportArtifact,
  getArtifactSourcePrefix,
  inferReportFromArtifacts,
  scopeArtifactNamesToSource,
  splitReportArtifact,
} from './artifacts';
import { buildReportJson } from './report';

function artifact(name: string, metadata: Artifact['metadata'] = undefined): Artifact {
  return {
    name,
    mime: 'application/octet-stream',
    bytes: new Uint8Array([1]),
    metadata,
  };
}

describe('artifact helpers', () => {
  it('creates safe source prefixes from PDF file names', () => {
    expect(getArtifactSourcePrefix('A.pdf')).toBe('A');
    expect(getArtifactSourcePrefix('bad/name:sample.pdf')).toBe('bad_name_sample');
    expect(getArtifactSourcePrefix('   .pdf')).toBe('document');
  });

  it('scopes downloadable artifacts to the source PDF folder and leaves report.json unscoped', () => {
    const scoped = scopeArtifactNamesToSource([artifact('image-1.png'), artifact('report.json')], 'A.pdf', true);

    expect(scoped.map((item) => item.name)).toEqual(['A/image-1.png', 'report.json']);
  });

  it('keeps artifact names unchanged when scoping is disabled', () => {
    const scoped = scopeArtifactNamesToSource([artifact('image-1.png')], 'A.pdf', false);

    expect(scoped.map((item) => item.name)).toEqual(['image-1.png']);
  });

  it('splits report.json from downloadable artifacts and parses its report payload', () => {
    const report: JobReport = {
      successCount: 2,
      convertedCount: 1,
      failedCount: 1,
      failedItems: [{ reasonCode: 'IMAGE_CONVERT_FAILED', page: 3 }],
    };
    const result = splitReportArtifact([
      artifact('image-1.png'),
      {
        name: 'report.json',
        mime: 'application/json',
        bytes: buildReportJson({ jobId: 'job-1', ...report }),
      },
    ]);

    expect(result.artifacts.map((item) => item.name)).toEqual(['image-1.png']);
    expect(result.report).toEqual(report);
  });

  it('infers a report from artifact metadata when no report artifact exists', () => {
    const report = inferReportFromArtifacts([
      artifact('image-1.jpg', { converted: true, sourceEncoding: 'ccitt', outputEncoding: 'jpg' }),
      artifact('image-2.png', { converted: false, sourceEncoding: 'png', outputEncoding: 'png' }),
    ]);

    expect(report).toEqual({
      successCount: 1,
      convertedCount: 1,
      failedCount: 0,
      failedItems: [],
    });
  });

  it('combines per-file reports and failed files into one report artifact', () => {
    const combined = createCombinedReportArtifact(
      'batch-1',
      [
        { successCount: 2, convertedCount: 1, failedCount: 0, failedItems: [] },
        { successCount: 1, convertedCount: 0, failedCount: 1, failedItems: [{ reasonCode: 'RAW_IMAGE_UNSUPPORTED' }] },
      ],
      [{ fileId: 'b', fileName: 'B.pdf', reasonCode: 'PDF_PARSE_FAILED' }],
    );

    const decoded = JSON.parse(new TextDecoder().decode(combined.bytes));

    expect(decoded).toMatchObject({
      jobId: 'batch-1',
      successCount: 3,
      convertedCount: 1,
      failedCount: 2,
    });
    expect(decoded.failedItems).toEqual([
      { reasonCode: 'RAW_IMAGE_UNSUPPORTED' },
      { fileId: 'b', fileName: 'B.pdf', reasonCode: 'PDF_PARSE_FAILED' },
    ]);
  });
});
