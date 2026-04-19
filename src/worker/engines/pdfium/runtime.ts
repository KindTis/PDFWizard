import { createPdfiumRuntimeLoader } from './runtimeLoader';

export type PdfiumRawImage = {
  bytes: Uint8Array;
  encoding: 'jpeg' | 'png' | 'jpx' | 'jbig2' | 'ccitt';
  page?: number;
  objectId?: string;
};

export type PdfiumModule = {
  merge: (files: Array<{ name: string; bytes: Uint8Array }>, rangesByFile: Record<string, string>) => Promise<Uint8Array>;
  split: (file: { name: string; bytes: Uint8Array }, ranges: string) => Promise<Uint8Array[]>;
  extractImages: (file: { name: string; bytes: Uint8Array }) => Promise<PdfiumRawImage[]>;
  convertImage: (bytes: Uint8Array, output: 'png' | 'jpg', quality: number) => Promise<Uint8Array>;
};

export type PdfiumRuntime<TModule = unknown> = {
  load: () => Promise<TModule>;
};

export function createPdfiumRuntime<TModule>(loader: () => Promise<TModule>): PdfiumRuntime<TModule> {
  let loaded: TModule | null = null;
  let loading: Promise<TModule> | null = null;

  return {
    async load(): Promise<TModule> {
      if (loaded) {
        return loaded;
      }
      if (!loading) {
        loading = loader().then((module) => {
          loaded = module;
          return module;
        });
      }
      return loading;
    },
  };
}

export const defaultPdfiumRuntime = createPdfiumRuntimeLoader();
