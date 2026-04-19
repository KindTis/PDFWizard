import type { ExtractionOptions } from '../engines/types';

export type SupportedEncoding = 'jpeg' | 'png' | 'jpx' | 'jbig2' | 'ccitt';

type PreserveDecision = {
  mode: 'preserve';
  outputFormat: SupportedEncoding;
  mime: string;
  extension: string;
};

type ConvertDecision = {
  mode: 'convert';
  outputFormat: 'png' | 'jpg';
  mime: 'image/png' | 'image/jpeg';
  extension: 'png' | 'jpg';
  quality: number;
};

export type ExtractionDecision = PreserveDecision | ConvertDecision;

const PRESERVE_OUTPUT: Record<SupportedEncoding, { mime: string; extension: string }> = {
  jpeg: { mime: 'image/jpeg', extension: 'jpg' },
  png: { mime: 'image/png', extension: 'png' },
  jpx: { mime: 'image/jpx', extension: 'jpx' },
  jbig2: { mime: 'image/x-jbig2', extension: 'jb2' },
  ccitt: { mime: 'image/tiff', extension: 'tiff' },
};

function clampQuality(quality: number | undefined): number {
  if (quality === undefined || Number.isNaN(quality)) {
    return 90;
  }
  return Math.min(100, Math.max(1, Math.round(quality)));
}

export function decideExtractionOutput(encoding: SupportedEncoding, options: ExtractionOptions): ExtractionDecision {
  if (options.preserveOriginal && !options.forceOutputFormat) {
    const output = PRESERVE_OUTPUT[encoding];
    return {
      mode: 'preserve',
      outputFormat: encoding,
      mime: output.mime,
      extension: output.extension,
    };
  }

  const outputFormat = options.forceOutputFormat ?? 'png';
  return {
    mode: 'convert',
    outputFormat,
    mime: outputFormat === 'jpg' ? 'image/jpeg' : 'image/png',
    extension: outputFormat,
    quality: clampQuality(options.quality),
  };
}
