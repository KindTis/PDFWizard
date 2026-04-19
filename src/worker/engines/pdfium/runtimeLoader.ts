import { DEFAULT_PDFIUM_WASM_URL, init, type WrappedPdfiumModule } from '@embedpdf/pdfium';

export type PdfiumRuntimeLoader = {
  load: () => Promise<WrappedPdfiumModule>;
};

type CreatePdfiumRuntimeLoaderDeps = {
  init?: typeof init;
  fetchWasm?: () => Promise<ArrayBuffer>;
};

export function createPdfiumRuntimeLoader(deps: CreatePdfiumRuntimeLoaderDeps = {}): PdfiumRuntimeLoader {
  let loaded: WrappedPdfiumModule | null = null;
  let loading: Promise<WrappedPdfiumModule> | null = null;

  const initPdfium = deps.init ?? init;
  const fetchWasm =
    deps.fetchWasm ??
    (async (): Promise<ArrayBuffer> => {
      const response = await fetch(DEFAULT_PDFIUM_WASM_URL);
      if (!response.ok) {
        throw new Error('WASM_LOAD_FAILED');
      }
      return response.arrayBuffer();
    });

  return {
    async load(): Promise<WrappedPdfiumModule> {
      if (loaded) {
        return loaded;
      }
      if (!loading) {
        loading = (async () => {
          let wasmBinary: ArrayBuffer;
          try {
            wasmBinary = await fetchWasm();
          } catch (error) {
            if (error instanceof Error && error.message === 'WASM_LOAD_FAILED') {
              throw error;
            }
            throw new Error('WASM_LOAD_FAILED');
          }

          try {
            const module = await initPdfium({ wasmBinary } as Parameters<typeof init>[0]);
            module.PDFiumExt_Init?.();
            loaded = module;
            return module;
          } catch {
            throw new Error('PDFIUM_INIT_FAILED');
          }
        })();
      }
      return loading;
    },
  };
}
