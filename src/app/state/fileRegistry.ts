import type { BinaryFile } from '../../worker/protocol';

export type RegisteredPdf = BinaryFile & {
  pageCount?: number;
};

export function createFileRegistry() {
  const files = new Map<string, RegisteredPdf>();

  return {
    upsert(file: RegisteredPdf): void {
      files.set(file.id, file);
    },
    list(): RegisteredPdf[] {
      return [...files.values()];
    },
    clear(): void {
      files.clear();
    },
  };
}
