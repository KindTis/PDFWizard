import { describe, expect, it } from 'vitest';
import { decideExtractionOutput } from './imageExtractionPolicy';

describe('decideExtractionOutput', () => {
  it('preserveOriginal=true and no forceOutputFormat keeps jpeg as original', () => {
    const decision = decideExtractionOutput('jpeg', {
      preserveOriginal: true,
    });

    expect(decision).toEqual({
      mode: 'preserve',
      outputFormat: 'jpeg',
      mime: 'image/jpeg',
      extension: 'jpg',
    });
  });

  it('preserveOriginal=true but forceOutputFormat is set converts to forced format', () => {
    const decision = decideExtractionOutput('jbig2', {
      preserveOriginal: true,
      forceOutputFormat: 'png',
    });

    expect(decision).toEqual({
      mode: 'convert',
      outputFormat: 'png',
      mime: 'image/png',
      extension: 'png',
      quality: 90,
    });
  });

  it('preserveOriginal=false converts and normalizes quality for jpg', () => {
    const decision = decideExtractionOutput('ccitt', {
      preserveOriginal: false,
      forceOutputFormat: 'jpg',
      quality: 150,
    });

    expect(decision).toEqual({
      mode: 'convert',
      outputFormat: 'jpg',
      mime: 'image/jpeg',
      extension: 'jpg',
      quality: 100,
    });
  });

  it('preserveOriginal=false without forceOutputFormat defaults to png conversion', () => {
    const decision = decideExtractionOutput('jpx', {
      preserveOriginal: false,
    });

    expect(decision).toEqual({
      mode: 'convert',
      outputFormat: 'png',
      mime: 'image/png',
      extension: 'png',
      quality: 90,
    });
  });

  it('supports all specified encodings for preserve mode', () => {
    const encodings = ['jpeg', 'png', 'jpx', 'jbig2', 'ccitt'] as const;

    for (const encoding of encodings) {
      const decision = decideExtractionOutput(encoding, {
        preserveOriginal: true,
      });
      expect(decision.mode).toBe('preserve');
      expect(decision.outputFormat).toBe(encoding);
    }
  });
});
