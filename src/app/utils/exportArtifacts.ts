import type { Artifact, JobType } from '../../worker/protocol';
import { triggerDownload } from './download';
import { buildZip } from './zip';

export type ExportArtifactsResult = {
  count: number;
  filename: string;
};

export function getDownloadableArtifacts(artifacts: Artifact[]): Artifact[] {
  return artifacts.filter((artifact) => artifact.name !== 'report.json');
}

export function createZipName(jobType: JobType | null): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `pdfwizard-${jobType ?? 'workflow'}-${timestamp}.zip`;
}

export function createArtifactDownloadKey(jobType: JobType | null, artifacts: Artifact[]): string {
  return [
    jobType ?? 'workflow',
    ...artifacts.map((artifact) => `${artifact.name}:${artifact.mime}:${artifact.bytes.byteLength}`),
  ].join('|');
}

function createSingleArtifactBlob(artifact: Artifact): Blob {
  const safeBytes = new Uint8Array(artifact.bytes.byteLength);
  safeBytes.set(artifact.bytes);
  return new Blob([safeBytes], { type: artifact.mime });
}

export async function downloadArtifacts(jobType: JobType | null, artifacts: Artifact[]): Promise<ExportArtifactsResult> {
  const downloadableArtifacts = getDownloadableArtifacts(artifacts);
  if (downloadableArtifacts.length === 0) {
    throw new Error('NO_DOWNLOADABLE_ARTIFACTS');
  }

  if (downloadableArtifacts.length === 1) {
    const artifact = downloadableArtifacts[0];
    triggerDownload(createSingleArtifactBlob(artifact), artifact.name);
    return {
      count: 1,
      filename: artifact.name,
    };
  }

  const zipName = createZipName(jobType);
  const zipBlob = await buildZip(zipName, downloadableArtifacts);
  triggerDownload(zipBlob, zipName);
  return {
    count: downloadableArtifacts.length,
    filename: zipName,
  };
}
