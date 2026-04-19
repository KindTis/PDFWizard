export type JobType = 'merge' | 'split' | 'extract-images' | 'pages-to-images';

export type BinaryFile = {
  id: string;
  name: string;
  bytes: ArrayBuffer;
};

export type MergeRequest = {
  jobId: string;
  type: 'merge';
  payload: {
    files: BinaryFile[];
    rangesByFile: Record<string, string>;
  };
};

export type SplitRequest = {
  jobId: string;
  type: 'split';
  payload: {
    file: BinaryFile;
    ranges: string;
  };
};

export type ExtractImagesRequest = {
  jobId: string;
  type: 'extract-images';
  payload: {
    file: BinaryFile;
    preserveOriginal: boolean;
    forceOutputFormat?: 'png' | 'jpg';
    quality?: number;
  };
};

export type PagesToImagesRequest = {
  jobId: string;
  type: 'pages-to-images';
  payload: {
    file: BinaryFile;
    ranges: string;
    format: 'png' | 'jpg';
    dpi: number;
    quality: number;
  };
};

export type JobRequest = MergeRequest | SplitRequest | ExtractImagesRequest | PagesToImagesRequest;

export type Artifact = {
  name: string;
  mime: string;
  bytes: Uint8Array;
  metadata?: {
    converted?: boolean;
    sourceEncoding?: 'jpeg' | 'png' | 'jpx' | 'jbig2' | 'ccitt';
    outputEncoding?: 'png' | 'jpg' | 'jpeg' | 'jpx' | 'jbig2' | 'ccitt';
  };
};

export type FailedItem = {
  page?: number;
  objectId?: string;
  sourceEncoding?: 'jpeg' | 'png' | 'jpx' | 'jbig2' | 'ccitt';
  reasonCode: string;
};

export type JobReport = {
  successCount: number;
  convertedCount: number;
  failedCount: number;
  failedItems: FailedItem[];
};

export type JobRunResult = {
  artifacts: Artifact[];
  report?: JobReport;
};

export type WorkerProgressEvent = {
  kind: 'progress';
  jobId: string;
  done: number;
  total: number;
  message: string;
};

export type WorkerDoneEvent = {
  kind: 'done';
  jobId: string;
  artifacts: Artifact[];
};

export type WorkerErrorCode =
  | 'WASM_LOAD_FAILED'
  | 'PDFIUM_INIT_FAILED'
  | 'PDF_PARSE_FAILED'
  | 'MERGE_FAILED'
  | 'SPLIT_FAILED'
  | 'UNSUPPORTED_IMAGE_ENCODING'
  | 'IMAGE_DECODE_FAILED'
  | 'IMAGE_CONVERT_FAILED'
  | 'RENDER_FAILED'
  | 'OOM_GUARD_TRIGGERED'
  | 'WORKER_CRASHED'
  | 'JOB_CANCELLED'
  | 'JOB_FAILED';

export type WorkerErrorEvent = {
  kind: 'error';
  jobId: string;
  code: WorkerErrorCode;
  message: string;
  retryable: boolean;
};

export type WorkerEvent = WorkerProgressEvent | WorkerDoneEvent | WorkerErrorEvent;

export type WorkerControlMessage =
  | JobRequest
  | {
      kind: 'cancel';
      jobId: string;
    };
