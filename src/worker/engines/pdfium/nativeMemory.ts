export type NativeMemoryModule = {
  pdfium: {
    HEAPU8: Uint8Array;
    wasmExports: {
      malloc: (size: number) => number;
      free: (ptr: number) => void;
    };
  };
};

function assertSize(size: number): void {
  if (!Number.isInteger(size) || size < 0) {
    throw new Error('OOM_GUARD_TRIGGERED');
  }
}

function assertBounds(heap: Uint8Array, ptr: number, size: number): void {
  if (!Number.isInteger(ptr) || ptr < 0 || ptr + size > heap.length) {
    throw new Error('OOM_GUARD_TRIGGERED');
  }
}

export function mallocNativePointer(module: NativeMemoryModule, size: number): number {
  assertSize(size);
  if (size === 0) {
    return 0;
  }

  const ptr = module.pdfium.wasmExports.malloc(size);
  if (!Number.isInteger(ptr) || ptr === 0) {
    throw new Error('OOM_GUARD_TRIGGERED');
  }
  assertBounds(module.pdfium.HEAPU8, ptr, size);
  return ptr;
}

export function freeNativePointer(module: NativeMemoryModule, ptr: number): void {
  if (!Number.isInteger(ptr) || ptr <= 0) {
    return;
  }
  module.pdfium.wasmExports.free(ptr);
}

export function writeNativeBytes(module: NativeMemoryModule, ptr: number, bytes: Uint8Array): void {
  if (bytes.length === 0) {
    return;
  }
  assertBounds(module.pdfium.HEAPU8, ptr, bytes.length);
  module.pdfium.HEAPU8.set(bytes, ptr);
}

export function readNativeBytes(module: NativeMemoryModule, ptr: number, size: number): Uint8Array {
  assertSize(size);
  if (size === 0) {
    return new Uint8Array(0);
  }
  assertBounds(module.pdfium.HEAPU8, ptr, size);
  return module.pdfium.HEAPU8.slice(ptr, ptr + size);
}
