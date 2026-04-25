import type { BinaryFile } from '../../worker/protocol';

export type RegisteredPdf = BinaryFile & {
  pageCount?: number;
  sourceKey?: string;
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
    remove(id: string): void {
      files.delete(id);
    },
    replaceAll(nextFiles: RegisteredPdf[]): void {
      files.clear();
      nextFiles.forEach((file) => files.set(file.id, file));
    },
    clear(): void {
      files.clear();
    },
  };
}
