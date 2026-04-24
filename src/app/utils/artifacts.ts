import type { Artifact, FailedItem, JobReport } from '../../worker/protocol';
import { buildReportJson } from './report';

type ReportArtifactPayload = Partial<JobReport> & {
  failedItems?: FailedItem[];
};

export type BatchFailure = {
  fileId: string;
  fileName: string;
  reasonCode: string;
};

function stripPdfExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex > 0 && fileName.slice(dotIndex).toLowerCase() === '.pdf') {
    return fileName.slice(0, dotIndex);
  }
  return fileName;
}

export function sanitizePathSegment(value: string): string {
  const sanitized = value.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  return sanitized.length > 0 ? sanitized : 'document';
}

export function getArtifactSourcePrefix(fileName: string): string {
  return sanitizePathSegment(stripPdfExtension(fileName));
}

export function scopeArtifactNamesToSource(
  artifacts: Artifact[],
  fileName: string,
  shouldScope: boolean,
): Artifact[] {
  if (!shouldScope) {
    return artifacts;
  }

  const prefix = getArtifactSourcePrefix(fileName);
  return artifacts.map((artifact) =>
    artifact.name === 'report.json'
      ? artifact
      : {
          ...artifact,
          name: `${prefix}/${artifact.name}`,
        },
  );
}

export function splitReportArtifact(artifacts: Artifact[]): { artifacts: Artifact[]; report: JobReport | null } {
  const reportArtifact = artifacts.find((artifact) => artifact.name === 'report.json');
  const remainingArtifacts = artifacts.filter((artifact) => artifact.name !== 'report.json');
  if (!reportArtifact) {
    return { artifacts: remainingArtifacts, report: null };
  }

  try {
    const parsed = JSON.parse(new TextDecoder().decode(reportArtifact.bytes)) as ReportArtifactPayload;
    return {
      artifacts: remainingArtifacts,
      report: {
        successCount: parsed.successCount ?? 0,
        convertedCount: parsed.convertedCount ?? 0,
        failedCount: parsed.failedCount ?? 0,
        failedItems: parsed.failedItems ?? [],
      },
    };
  } catch {
    return { artifacts: remainingArtifacts, report: null };
  }
}

export function inferReportFromArtifacts(artifacts: Artifact[]): JobReport {
  const convertedCount = artifacts.filter((artifact) => artifact.metadata?.converted).length;
  return {
    successCount: Math.max(0, artifacts.length - convertedCount),
    convertedCount,
    failedCount: 0,
    failedItems: [],
  };
}

export function createCombinedReportArtifact(
  jobId: string,
  reports: JobReport[],
  failures: BatchFailure[],
): Artifact {
  const failedItemsFromReports = reports.flatMap((report) => report.failedItems);
  const failureItems: FailedItem[] = failures.map((failure) => ({
    fileId: failure.fileId,
    fileName: failure.fileName,
    reasonCode: failure.reasonCode,
  }));

  const report: JobReport = {
    successCount: reports.reduce((sum, reportItem) => sum + reportItem.successCount, 0),
    convertedCount: reports.reduce((sum, reportItem) => sum + reportItem.convertedCount, 0),
    failedCount: reports.reduce((sum, reportItem) => sum + reportItem.failedCount, 0) + failures.length,
    failedItems: [...failedItemsFromReports, ...failureItems],
  };

  return {
    name: 'report.json',
    mime: 'application/json',
    bytes: buildReportJson({
      jobId,
      ...report,
    }),
  };
}
