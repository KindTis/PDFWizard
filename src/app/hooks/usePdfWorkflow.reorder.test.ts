import { describe, expect, it } from 'vitest';
import { reorderFilesAndThumbnails, type ThumbnailPreview } from './usePdfWorkflow';
import type { RegisteredPdf } from '../state/fileRegistry';

function createFile(id: string, name: string): RegisteredPdf {
  return {
    id,
    name,
    bytes: new ArrayBuffer(8),
    pageCount: 2,
  };
}

function createThumbnail(fileId: string, fileName: string, fileIndex: number, pageNumber: number): ThumbnailPreview {
  return {
    fileId,
    fileName,
    fileIndex,
    pageNumber,
    imageUrl: null,
    status: 'ready',
  };
}

describe('reorderFilesAndThumbnails', () => {
  it('reorders merge files and applies the same order to thumbnail groups', () => {
    const files = [createFile('a', 'a.pdf'), createFile('b', 'b.pdf'), createFile('c', 'c.pdf')];
    const thumbnails = [
      createThumbnail('a', 'a.pdf', 0, 1),
      createThumbnail('a', 'a.pdf', 0, 2),
      createThumbnail('b', 'b.pdf', 1, 1),
      createThumbnail('b', 'b.pdf', 1, 2),
      createThumbnail('c', 'c.pdf', 2, 1),
      createThumbnail('c', 'c.pdf', 2, 2),
    ];

    const result = reorderFilesAndThumbnails(files, thumbnails, ['b', 'c', 'a']);

    expect(result.files.map((file) => file.id)).toEqual(['b', 'c', 'a']);
    expect(result.thumbnails.map((thumbnail) => `${thumbnail.fileId}:${thumbnail.pageNumber}`)).toEqual([
      'b:1',
      'b:2',
      'c:1',
      'c:2',
      'a:1',
      'a:2',
    ]);
    expect(result.thumbnails.map((thumbnail) => thumbnail.fileIndex)).toEqual([0, 0, 1, 1, 2, 2]);
  });
});

