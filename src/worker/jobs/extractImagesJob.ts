import type { ExtractionOptions } from '../engines/types';
import type { Artifact, BinaryFile } from '../protocol';

type ProgressReporter = (done: number, total: number, message: string) => void;
type ModernExtractImagesRuntime = {
  extractImages: (file: BinaryFile, options: ExtractionOptions) => Promise<Artifact[]>;
};
type LegacyExtractImagesRuntime = {
  extractImages: (file: BinaryFile, format: 'png' | 'jpg', quality: number) => Promise<Artifact[]>;
};
type ExtractImagesRuntime = ModernExtractImagesRuntime | LegacyExtractImagesRuntime;

type LegacyPayload = {
  file: BinaryFile;
  format: 'png' | 'jpg';
  quality: number;
};

type ModernPayload = {
  file: BinaryFile;
  preserveOriginal: boolean;
  forceOutputFormat?: 'png' | 'jpg';
  quality?: number;
};

type ExtractImagesJobRequest = {
  jobId?: string;
  type?: 'extract-images';
  payload: LegacyPayload | ModernPayload;
};

function isModernPayload(payload: LegacyPayload | ModernPayload): payload is ModernPayload {
  return 'preserveOriginal' in payload;
}

function normalizeExtractionOptions(payload: ModernPayload): ExtractionOptions {
  return {
    preserveOriginal: payload.preserveOriginal,
    forceOutputFormat: payload.forceOutputFormat,
    quality: payload.quality,
  };
}

function usesLegacySignature(runtime: ExtractImagesRuntime): runtime is LegacyExtractImagesRuntime {
  return runtime.extractImages.length >= 3;
}

export async function runExtractImages(
  runtime: ExtractImagesRuntime,
  req: ExtractImagesJobRequest,
  onProgress: ProgressReporter,
): Promise<Artifact[]> {
  onProgress(0, 1, 'extracting');
  let artifacts: Artifact[];

  if (isModernPayload(req.payload)) {
    if (usesLegacySignature(runtime)) {
      artifacts = await runtime.extractImages(
        req.payload.file,
        req.payload.forceOutputFormat ?? 'png',
        req.payload.quality ?? 90,
      );
    } else {
      artifacts = await runtime.extractImages(req.payload.file, normalizeExtractionOptions(req.payload));
    }
  } else {
    artifacts = await (runtime as LegacyExtractImagesRuntime).extractImages(
      req.payload.file,
      req.payload.format,
      req.payload.quality,
    );
  }
  onProgress(1, 1, 'done');
  return artifacts;
}
