import { create } from 'zustand';
import type { Artifact, JobType } from '../../worker/protocol';

export type JobStatus = 'idle' | 'validating' | 'running' | 'paused' | 'completed' | 'partial_failed' | 'failed' | 'cancelled';

type AppState = {
  activeJobType: JobType | null;
  status: JobStatus;
  extractionOptions: {
    preserveOriginal: boolean;
    forceConvert: boolean;
    forceOutputFormat: 'png' | 'jpg';
    quality: number;
  };
  progress: {
    done: number;
    total: number;
    message: string;
  };
  reportSummary: {
    successCount: number;
    convertedCount: number;
    failedCount: number;
  };
  artifacts: Artifact[];
  errorMessage: string | null;
  setJobType: (jobType: JobType | null) => void;
  setStatus: (status: JobStatus) => void;
  setExtractionOptions: (patch: Partial<AppState['extractionOptions']>) => void;
  setProgress: (done: number, total: number, message: string) => void;
  setReportSummary: (summary: AppState['reportSummary']) => void;
  setArtifacts: (artifacts: Artifact[]) => void;
  setError: (message: string | null) => void;
  resetJobResult: () => void;
  reset: () => void;
};

const initialProgress = { done: 0, total: 0, message: '' };
const initialReportSummary = { successCount: 0, convertedCount: 0, failedCount: 0 };
const initialExtractionOptions = {
  preserveOriginal: true,
  forceConvert: false,
  forceOutputFormat: 'png' as const,
  quality: 90,
};

export const useAppStore = create<AppState>((set) => ({
  activeJobType: null,
  status: 'idle',
  extractionOptions: initialExtractionOptions,
  progress: initialProgress,
  reportSummary: initialReportSummary,
  artifacts: [],
  errorMessage: null,
  setJobType: (activeJobType) => set({ activeJobType }),
  setStatus: (status) => set({ status }),
  setExtractionOptions: (patch) =>
    set((state) => ({
      extractionOptions: {
        ...state.extractionOptions,
        ...patch,
      },
    })),
  setProgress: (done, total, message) => set({ progress: { done, total, message } }),
  setReportSummary: (reportSummary) => set({ reportSummary }),
  setArtifacts: (artifacts) => set({ artifacts }),
  setError: (errorMessage) => set({ errorMessage }),
  resetJobResult: () =>
    set({
      status: 'idle',
      progress: initialProgress,
      reportSummary: initialReportSummary,
      artifacts: [],
      errorMessage: null,
    }),
  reset: () =>
    set({
      status: 'idle',
      activeJobType: null,
      extractionOptions: initialExtractionOptions,
      progress: initialProgress,
      reportSummary: initialReportSummary,
      artifacts: [],
      errorMessage: null,
    }),
}));
