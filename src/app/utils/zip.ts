import JSZip from 'jszip';
import type { Artifact } from '../../worker/protocol';

export async function buildZip(_name: string, artifacts: Artifact[]): Promise<Blob> {
  const zip = new JSZip();
  const orderedArtifacts = [...artifacts].sort((a, b) => {
    if (a.name === 'report.json') return 1;
    if (b.name === 'report.json') return -1;
    return a.name.localeCompare(b.name);
  });

  for (const artifact of orderedArtifacts) {
    zip.file(artifact.name, artifact.bytes);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return new Blob([zipBlob], { type: 'application/zip' });
}
