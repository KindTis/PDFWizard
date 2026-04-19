import { describe, expect, it } from 'vitest';
import { buildZip } from './zip';

describe('buildZip', () => {
  it('creates zip blob with application/zip type', async () => {
    const blob = await buildZip('result.zip', [
      {
        name: 'a.txt',
        mime: 'text/plain',
        bytes: new Uint8Array([65]),
      },
    ]);

    expect(blob.type).toBe('application/zip');
    expect(blob.size).toBeGreaterThan(0);
  });
});