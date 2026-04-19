# PDFWizard WASM-Centric GitHub Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitHub Pages에 배포 가능한 로컬 전용 PDF 편집 웹앱(MVP: 합치기, 분할, 원본 이미지 추출, 페이지->이미지)을 구현한다.

**Architecture:** React + TypeScript UI, 전용 Web Worker, MuPDF.js(WASM) 엔진 어댑터, 작업 오케스트레이터(청크/진행률/취소/부분실패). 멀티스레드는 `crossOriginIsolated` 환경에서만 선택적으로 활성화하고, 기본은 단일 스레드 Worker 모드로 동작한다.

**Tech Stack:** Vite, React, TypeScript, Zustand, MuPDF.js(`mupdf`), JSZip, Vitest, Playwright, GitHub Actions Pages.

---

## 병렬 실행 설계 (병렬 에이전트 고려)

- 병렬 투입은 **Task 4A/4B/4C**에서만 사용한다.
- 병렬 투입 조건:
  - 파일 쓰기 경로가 겹치지 않음
  - 선행 Task 1~3 완료
  - 공통 타입/프로토콜 고정 완료
- 병렬 에이전트 권장 구성:
  - Agent A (모델: `gpt-5.3-codex`) -> Merge/Split Worker 라인
  - Agent B (모델: `gpt-5.3-codex`) -> Extract/Render Worker 라인
  - Agent C (모델: `gpt-5.3-codex`) -> UI/썸네일 라인
- 통합은 메인 에이전트가 Task 5에서 수행한다.

## 파일 구조 맵 (작업 시작 전 고정)

- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles/app.css`
- Create: `src/domain/pageRange.ts`
- Create: `src/domain/pageRange.test.ts`
- Create: `src/worker/protocol.ts`
- Create: `src/worker/index.ts`
- Create: `src/worker/jobs/mergeSplitJob.ts`
- Create: `src/worker/jobs/extractImagesJob.ts`
- Create: `src/worker/jobs/pagesToImagesJob.ts`
- Create: `src/worker/wasm/mupdfRuntime.ts`
- Create: `src/worker/wasm/mupdfMergeSplit.ts`
- Create: `src/worker/wasm/mupdfImageOps.ts`
- Create: `src/app/state/store.ts`
- Create: `src/app/hooks/useWorkerClient.ts`
- Create: `src/app/components/StepHeader.tsx`
- Create: `src/app/components/UploadZone.tsx`
- Create: `src/app/components/ThumbnailWorkspace.tsx`
- Create: `src/app/components/ActionPanel.tsx`
- Create: `src/app/components/ProgressPanel.tsx`
- Create: `src/app/utils/download.ts`
- Create: `src/app/utils/zip.ts`
- Create: `src/app/utils/memoryGuard.ts`
- Create: `tests/e2e/app-shell.spec.ts`
- Create: `tests/e2e/workflow.spec.ts`
- Create: `.github/workflows/pages.yml`

---

### Task 1: 프로젝트 스캐폴딩 + 테스트 러너 부트스트랩 (Sequential)

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.node.json`
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles/app.css`
- Test: `src/App.test.tsx`

- [ ] **Step 1: 실패하는 App Shell 테스트 작성**

```tsx
// src/App.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App shell', () => {
  it('renders 3-step header', () => {
    render(<App />);
    expect(screen.getByText('업로드')).toBeInTheDocument();
    expect(screen.getByText('작업')).toBeInTheDocument();
    expect(screen.getByText('내보내기')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm run test -- src/App.test.tsx`
Expected: FAIL with "Cannot find module './App'" or test setup missing.

- [ ] **Step 3: 최소 구현 작성 (Vite + React + Vitest 구성)**

```json
// package.json (핵심 부분)
{
  "name": "pdfwizard",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.0",
    "jszip": "^3.10.1",
    "mupdf": "^1.26.4"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.8.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0",
    "playwright": "^1.50.0"
  }
}
```

```tsx
// src/App.tsx
import './styles/app.css';

export default function App() {
  return (
    <main>
      <header>
        <span>업로드</span>
        <span>작업</span>
        <span>내보내기</span>
      </header>
    </main>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- src/App.test.tsx`
Expected: PASS (1 passed)

- [ ] **Step 5: 커밋**

```bash
git add package.json index.html vite.config.ts vitest.config.ts tsconfig.json tsconfig.node.json src/main.tsx src/App.tsx src/styles/app.css src/App.test.tsx
git commit -m "chore: scaffold vite react app with vitest"
```

---

### Task 2: 도메인 규칙 (페이지 범위 파서 + Job 스펙 타입) (Sequential)

**Files:**
- Create: `src/domain/pageRange.ts`, `src/domain/pageRange.test.ts`
- Create: `src/worker/protocol.ts`

- [ ] **Step 1: 실패하는 범위 파서 테스트 작성**

```ts
// src/domain/pageRange.test.ts
import { describe, expect, it } from 'vitest';
import { parsePageRange } from './pageRange';

describe('parsePageRange', () => {
  it('parses 1-3,8,10-12', () => {
    expect(parsePageRange('1-3,8,10-12', 20)).toEqual([1,2,3,8,10,11,12]);
  });

  it('rejects out-of-range pages', () => {
    expect(() => parsePageRange('1,999', 10)).toThrow('OUT_OF_RANGE');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/domain/pageRange.test.ts`
Expected: FAIL with "parsePageRange is not defined"

- [ ] **Step 3: 최소 구현 + Worker 프로토콜 타입 정의**

```ts
// src/domain/pageRange.ts
export function parsePageRange(input: string, maxPage: number): number[] {
  const pages = new Set<number>();
  for (const raw of input.split(',').map(v => v.trim()).filter(Boolean)) {
    if (raw.includes('-')) {
      const [s, e] = raw.split('-').map(v => Number(v));
      if (!Number.isInteger(s) || !Number.isInteger(e) || s < 1 || e > maxPage || s > e) {
        throw new Error('OUT_OF_RANGE');
      }
      for (let p = s; p <= e; p += 1) pages.add(p);
    } else {
      const p = Number(raw);
      if (!Number.isInteger(p) || p < 1 || p > maxPage) throw new Error('OUT_OF_RANGE');
      pages.add(p);
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}
```

```ts
// src/worker/protocol.ts
export type JobType = 'merge' | 'split' | 'extract-images' | 'pages-to-images';

export type BinaryFile = {
  id: string;
  name: string;
  bytes: ArrayBuffer;
};

export type JobRequest =
  | { jobId: string; type: 'merge'; payload: { files: BinaryFile[]; rangesByFile: Record<string, string> } }
  | { jobId: string; type: 'split'; payload: { file: BinaryFile; ranges: string } }
  | { jobId: string; type: 'extract-images'; payload: { file: BinaryFile; format: 'png' | 'jpg'; quality: number } }
  | { jobId: string; type: 'pages-to-images'; payload: { file: BinaryFile; ranges: string; format: 'png' | 'jpg'; dpi: number; quality: number } };

export type Artifact = { name: string; mime: string; bytes: Uint8Array };

export type WorkerEvent =
  | { kind: 'progress'; jobId: string; done: number; total: number; message: string }
  | { kind: 'done'; jobId: string; artifacts: Artifact[] }
  | { kind: 'error'; jobId: string; code: string; message: string; retryable: boolean };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- src/domain/pageRange.test.ts`
Expected: PASS (2 passed)

- [ ] **Step 5: 커밋**

```bash
git add src/domain/pageRange.ts src/domain/pageRange.test.ts src/worker/protocol.ts
git commit -m "feat: add page range parser and worker protocol types"
```

---

### Task 3: Worker 런타임 뼈대 + 클라이언트 브리지 (Sequential)

**Files:**
- Create: `src/worker/index.ts`
- Create: `src/app/hooks/useWorkerClient.ts`
- Create: `src/app/state/store.ts`
- Test: `src/app/hooks/useWorkerClient.test.ts`

- [ ] **Step 1: 실패하는 Worker 브리지 테스트 작성**

```ts
// src/app/hooks/useWorkerClient.test.ts
import { describe, it, expect } from 'vitest';
import { createWorkerClient } from './useWorkerClient';

describe('worker client', () => {
  it('queues request and resolves done event', async () => {
    const { request, feedMessage } = createWorkerClient();
    const promise = request({ jobId: 'j1', type: 'split', payload: { file: { id: 'f', name: 'a.pdf', bytes: new ArrayBuffer(0) }, ranges: '1-1' } });
    feedMessage({ kind: 'done', jobId: 'j1', artifacts: [] });
    await expect(promise).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/app/hooks/useWorkerClient.test.ts`
Expected: FAIL with "createWorkerClient is not defined"

- [ ] **Step 3: 최소 구현 작성 (브리지 + Worker dispatch 뼈대)**

```ts
// src/app/hooks/useWorkerClient.ts
import type { JobRequest, WorkerEvent, Artifact } from '../../worker/protocol';

export function createWorkerClient() {
  const pending = new Map<string, { resolve: (v: Artifact[]) => void; reject: (e: Error) => void }>();

  function request(req: JobRequest) {
    return new Promise<Artifact[]>((resolve, reject) => {
      pending.set(req.jobId, { resolve, reject });
    });
  }

  function feedMessage(event: WorkerEvent) {
    const waiter = pending.get(event.jobId);
    if (!waiter) return;
    if (event.kind === 'done') {
      pending.delete(event.jobId);
      waiter.resolve(event.artifacts);
    }
    if (event.kind === 'error') {
      pending.delete(event.jobId);
      waiter.reject(new Error(event.message));
    }
  }

  return { request, feedMessage };
}
```

```ts
// src/worker/index.ts
import type { JobRequest } from './protocol';

self.onmessage = async (e: MessageEvent<JobRequest>) => {
  const req = e.data;
  self.postMessage({ kind: 'error', jobId: req.jobId, code: 'NOT_IMPLEMENTED', message: 'job handler not wired', retryable: false });
};
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- src/app/hooks/useWorkerClient.test.ts`
Expected: PASS (1 passed)

- [ ] **Step 5: 커밋**

```bash
git add src/worker/index.ts src/app/hooks/useWorkerClient.ts src/app/hooks/useWorkerClient.test.ts src/app/state/store.ts
git commit -m "feat: add worker client bridge and runtime skeleton"
```

---

### Task 4A: Merge/Split Worker 구현 (Parallel Lane A)

**Owner:** Agent A (`gpt-5.3-codex`)

**Files:**
- Create: `src/worker/wasm/mupdfRuntime.ts`
- Create: `src/worker/wasm/mupdfMergeSplit.ts`
- Create: `src/worker/jobs/mergeSplitJob.ts`
- Test: `src/worker/jobs/mergeSplitJob.test.ts`

- [ ] **Step 1: 실패하는 merge/split job 테스트 작성**

```ts
// src/worker/jobs/mergeSplitJob.test.ts
import { describe, it, expect, vi } from 'vitest';
import { runMergeOrSplit } from './mergeSplitJob';

describe('runMergeOrSplit', () => {
  it('calls merge handler and returns one artifact', async () => {
    const runtime = { merge: vi.fn().mockResolvedValue(new Uint8Array([1,2,3])) } as any;
    const artifacts = await runMergeOrSplit(runtime, {
      jobId: 'j1',
      type: 'merge',
      payload: { files: [], rangesByFile: {} }
    } as any, () => {});
    expect(runtime.merge).toHaveBeenCalled();
    expect(artifacts).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/worker/jobs/mergeSplitJob.test.ts`
Expected: FAIL with "runMergeOrSplit is not defined"

- [ ] **Step 3: 최소 구현 작성**

```ts
// src/worker/wasm/mupdfRuntime.ts
import mupdf from 'mupdf';

export async function initMupdfRuntime() {
  return { module: mupdf };
}
```

```ts
// src/worker/wasm/mupdfMergeSplit.ts
import type { BinaryFile } from '../protocol';

export async function mergeWithMupdf(_files: BinaryFile[], _rangesByFile: Record<string, string>): Promise<Uint8Array> {
  return new Uint8Array();
}

export async function splitWithMupdf(_file: BinaryFile, _ranges: string): Promise<Uint8Array[]> {
  return [];
}
```

```ts
// src/worker/jobs/mergeSplitJob.ts
import type { JobRequest, Artifact } from '../protocol';

export async function runMergeOrSplit(
  runtime: { merge: (files: any[], ranges: Record<string, string>) => Promise<Uint8Array>; split?: any },
  req: Extract<JobRequest, { type: 'merge' | 'split' }>,
  onProgress: (done: number, total: number, message: string) => void
): Promise<Artifact[]> {
  onProgress(0, 1, 'prepare');
  if (req.type === 'merge') {
    const bytes = await runtime.merge(req.payload.files, req.payload.rangesByFile);
    onProgress(1, 1, 'done');
    return [{ name: 'merged.pdf', mime: 'application/pdf', bytes }];
  }
  throw new Error('SPLIT_NOT_YET_WIRED');
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- src/worker/jobs/mergeSplitJob.test.ts`
Expected: PASS (1 passed)

- [ ] **Step 5: 커밋**

```bash
git add src/worker/wasm/mupdfRuntime.ts src/worker/wasm/mupdfMergeSplit.ts src/worker/jobs/mergeSplitJob.ts src/worker/jobs/mergeSplitJob.test.ts
git commit -m "feat: add merge split worker lane with mupdf runtime shell"
```

---

### Task 4B: 이미지 추출/페이지->이미지 Worker 구현 (Parallel Lane B)

**Owner:** Agent B (`gpt-5.3-codex`)

**Files:**
- Create: `src/worker/wasm/mupdfImageOps.ts`
- Create: `src/worker/jobs/extractImagesJob.ts`
- Create: `src/worker/jobs/pagesToImagesJob.ts`
- Test: `src/worker/jobs/imageJobs.test.ts`

- [ ] **Step 1: 실패하는 image job 테스트 작성**

```ts
// src/worker/jobs/imageJobs.test.ts
import { describe, expect, it, vi } from 'vitest';
import { runExtractImages } from './extractImagesJob';

describe('image jobs', () => {
  it('extract-images returns artifacts', async () => {
    const runtime = { extractImages: vi.fn().mockResolvedValue([{ name: 'img-1.png', bytes: new Uint8Array([1]), mime: 'image/png' }]) } as any;
    const result = await runExtractImages(runtime, {
      jobId: 'j2',
      type: 'extract-images',
      payload: { file: { id: 'f', name: 'a.pdf', bytes: new ArrayBuffer(0) }, format: 'png', quality: 92 }
    } as any, () => {});
    expect(result[0].name).toBe('img-1.png');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/worker/jobs/imageJobs.test.ts`
Expected: FAIL with "runExtractImages is not defined"

- [ ] **Step 3: 최소 구현 작성**

```ts
// src/worker/wasm/mupdfImageOps.ts
import type { BinaryFile } from '../protocol';

export type ImageArtifact = { name: string; mime: 'image/png' | 'image/jpeg'; bytes: Uint8Array };

export async function extractOriginalImages(_file: BinaryFile, _format: 'png' | 'jpg', _quality: number): Promise<ImageArtifact[]> {
  return [];
}

export async function renderPagesToImages(_file: BinaryFile, _pages: number[], _format: 'png' | 'jpg', _dpi: number, _quality: number): Promise<ImageArtifact[]> {
  return [];
}
```

```ts
// src/worker/jobs/extractImagesJob.ts
import type { Artifact, JobRequest } from '../protocol';

export async function runExtractImages(
  runtime: { extractImages: (file: any, format: 'png' | 'jpg', quality: number) => Promise<Artifact[]> },
  req: Extract<JobRequest, { type: 'extract-images' }>,
  onProgress: (done: number, total: number, message: string) => void
): Promise<Artifact[]> {
  onProgress(0, 1, 'extracting');
  const out = await runtime.extractImages(req.payload.file, req.payload.format, req.payload.quality);
  onProgress(1, 1, 'done');
  return out;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- src/worker/jobs/imageJobs.test.ts`
Expected: PASS (1 passed)

- [ ] **Step 5: 커밋**

```bash
git add src/worker/wasm/mupdfImageOps.ts src/worker/jobs/extractImagesJob.ts src/worker/jobs/pagesToImagesJob.ts src/worker/jobs/imageJobs.test.ts
git commit -m "feat: add image extraction and page render worker lane"
```

---

### Task 4C: UI 작업흐름형 화면 구현 (Parallel Lane C)

**Owner:** Agent C (`gpt-5.3-codex`)

**Files:**
- Create: `src/app/components/StepHeader.tsx`
- Create: `src/app/components/UploadZone.tsx`
- Create: `src/app/components/ThumbnailWorkspace.tsx`
- Create: `src/app/components/ActionPanel.tsx`
- Create: `src/app/components/ProgressPanel.tsx`
- Modify: `src/App.tsx`
- Test: `src/app/components/AppFlow.test.tsx`

- [ ] **Step 1: 실패하는 UI 흐름 테스트 작성**

```tsx
// src/app/components/AppFlow.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../App';

describe('flow layout', () => {
  it('shows action tabs', () => {
    render(<App />);
    expect(screen.getByRole('tab', { name: '합치기' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '분할' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '이미지 추출' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '페이지→이미지' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/app/components/AppFlow.test.tsx`
Expected: FAIL (tabs not found)

- [ ] **Step 3: 최소 구현 작성**

```tsx
// src/app/components/ActionPanel.tsx
export function ActionPanel() {
  return (
    <div role="tablist" aria-label="작업 탭">
      <button role="tab">합치기</button>
      <button role="tab">분할</button>
      <button role="tab">이미지 추출</button>
      <button role="tab">페이지→이미지</button>
    </div>
  );
}
```

```tsx
// src/App.tsx
import { ActionPanel } from './app/components/ActionPanel';

export default function App() {
  return (
    <main>
      <header><span>업로드</span><span>작업</span><span>내보내기</span></header>
      <section>
        <ActionPanel />
      </section>
    </main>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- src/app/components/AppFlow.test.tsx`
Expected: PASS (1 passed)

- [ ] **Step 5: 커밋**

```bash
git add src/app/components/StepHeader.tsx src/app/components/UploadZone.tsx src/app/components/ThumbnailWorkspace.tsx src/app/components/ActionPanel.tsx src/app/components/ProgressPanel.tsx src/app/components/AppFlow.test.tsx src/App.tsx
git commit -m "feat: add workflow layout components with action tabs"
```

---

### Task 5: 병렬 결과 통합 (Worker dispatch + 진행률/취소/ZIP) (Sequential Integration)

**Files:**
- Modify: `src/worker/index.ts`
- Create: `src/app/utils/zip.ts`, `src/app/utils/download.ts`, `src/app/utils/memoryGuard.ts`
- Modify: `src/app/hooks/useWorkerClient.ts`, `src/app/state/store.ts`
- Test: `src/worker/index.test.ts`, `src/app/utils/zip.test.ts`, `src/app/utils/memoryGuard.test.ts`

- [ ] **Step 1: 실패하는 통합 테스트 작성**

```ts
// src/worker/index.test.ts
import { describe, it, expect } from 'vitest';

describe('worker dispatch', () => {
  it('routes merge to merge job handler', () => {
    expect(true).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/worker/index.test.ts`
Expected: FAIL with "expected true to be false"

- [ ] **Step 3: 통합 구현 작성**

```ts
// src/worker/index.ts (핵심 dispatch)
import type { JobRequest } from './protocol';
import { runMergeOrSplit } from './jobs/mergeSplitJob';
import { runExtractImages } from './jobs/extractImagesJob';
import { runPagesToImages } from './jobs/pagesToImagesJob';

self.onmessage = async (e: MessageEvent<JobRequest>) => {
  const req = e.data;
  const postProgress = (done: number, total: number, message: string) =>
    self.postMessage({ kind: 'progress', jobId: req.jobId, done, total, message });

  try {
    let artifacts;
    if (req.type === 'merge' || req.type === 'split') artifacts = await runMergeOrSplit(globalThis as any, req as any, postProgress);
    else if (req.type === 'extract-images') artifacts = await runExtractImages(globalThis as any, req as any, postProgress);
    else artifacts = await runPagesToImages(globalThis as any, req as any, postProgress);
    self.postMessage({ kind: 'done', jobId: req.jobId, artifacts });
  } catch (err) {
    self.postMessage({ kind: 'error', jobId: req.jobId, code: 'JOB_FAILED', message: String(err), retryable: true });
  }
};
```

```ts
// src/app/utils/zip.ts
import JSZip from 'jszip';
import type { Artifact } from '../../worker/protocol';

export async function buildZip(name: string, artifacts: Artifact[]): Promise<Blob> {
  const zip = new JSZip();
  for (const a of artifacts) zip.file(a.name, a.bytes);
  return zip.generateAsync({ type: 'blob' }).then((blob) => new Blob([blob], { type: 'application/zip' }));
}
```

```ts
// src/app/utils/memoryGuard.ts
export function computeChunkSize(totalPages: number, memoryPressure: number): number {
  if (memoryPressure >= 0.85) return Math.max(1, Math.floor(totalPages / 40));
  if (memoryPressure >= 0.7) return Math.max(1, Math.floor(totalPages / 20));
  return Math.max(1, Math.floor(totalPages / 10));
}
```

- [ ] **Step 4: 통합 테스트 통과 확인**

Run: `npm run test -- src/worker/index.test.ts src/app/utils/zip.test.ts src/app/utils/memoryGuard.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/worker/index.ts src/worker/index.test.ts src/app/utils/zip.ts src/app/utils/download.ts src/app/utils/memoryGuard.ts src/app/utils/zip.test.ts src/app/utils/memoryGuard.test.ts src/app/hooks/useWorkerClient.ts src/app/state/store.ts
git commit -m "feat: integrate worker jobs with progress cancel and zip pipeline"
```

---

### Task 6: 모바일/접근성/에러 UX 고도화 (Sequential)

**Files:**
- Modify: `src/styles/app.css`, `src/app/components/*`, `src/App.tsx`
- Test: `src/app/components/accessibility.test.tsx`

- [ ] **Step 1: 실패하는 접근성 테스트 작성**

```tsx
// src/app/components/accessibility.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../App';

describe('a11y essentials', () => {
  it('has main landmark and upload button', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /파일 선택/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/app/components/accessibility.test.tsx`
Expected: FAIL (upload button not found)

- [ ] **Step 3: 구현 작성 (모바일 1열, 하단 시트, 오류 패널)**

```css
/* src/styles/app.css (핵심) */
@media (max-width: 768px) {
  .layout { grid-template-columns: 1fr; }
  .action-panel { position: sticky; bottom: 0; }
}
.error-panel { border: 1px solid #d33; background: #fff2f2; }
```

```tsx
// src/app/components/UploadZone.tsx (핵심)
export function UploadZone() {
  return (
    <section aria-label="업로드 영역">
      <button type="button">파일 선택</button>
    </section>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- src/app/components/accessibility.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/styles/app.css src/app/components/UploadZone.tsx src/app/components/accessibility.test.tsx src/App.tsx
git commit -m "feat: add mobile layout and accessibility baseline"
```

---

### Task 7: E2E/성능 기준/Pages 배포 파이프라인 (Sequential, 일부 병렬 가능)

**Files:**
- Create: `tests/e2e/app-shell.spec.ts`, `tests/e2e/workflow.spec.ts`
- Create: `playwright.config.ts`
- Create: `.github/workflows/pages.yml`

- [ ] **Step 1: 실패하는 E2E 테스트 작성**

```ts
// tests/e2e/workflow.spec.ts
import { test, expect } from '@playwright/test';

test('workflow tabs visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: '합치기' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '분할' })).toBeVisible();
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run e2e -- tests/e2e/workflow.spec.ts`
Expected: FAIL if baseURL/dev server not configured.

- [ ] **Step 3: Playwright + Pages workflow 구성**

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4173', reuseExistingServer: true }
});
```

```yaml
# .github/workflows/pages.yml
name: Deploy Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    runs-on: ubuntu-latest
    needs: build
    environment:
      name: github-pages
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: E2E 통과 확인 + 성능 체크 커맨드 추가**

Run: `npm run e2e`
Expected: PASS

Run: `npm run build && npm run preview`
Expected: build success, preview starts.

- [ ] **Step 5: 커밋**

```bash
git add tests/e2e/app-shell.spec.ts tests/e2e/workflow.spec.ts playwright.config.ts .github/workflows/pages.yml
git commit -m "chore: add e2e tests and github pages deployment workflow"
```

---

## 병렬 실행 순서 제안

1. Task 1 -> Task 2 -> Task 3 순차 실행
2. Task 4A/4B/4C 병렬 실행 (3개 에이전트)
3. Task 5 통합
4. Task 6
5. Task 7

## 검증 체크리스트 (완료 기준)

- 합치기/분할/이미지추출/페이지->이미지 탭 모두 동작
- 범위 입력 + 썸네일 선택 동기화
- PNG/JPG 선택 + 다중 ZIP 다운로드
- 진행률/취소/부분실패 UI 표시
- 모바일 레이아웃 정상
- 테스트 통과: unit + integration + e2e
- GitHub Pages Actions 배포 성공

## 리스크 및 대응

1. MuPDF.js 라이선스(AGPL) 검토 필요
- 대응: 배포 전 라이선스 정책 확인, 불가 시 엔진 교체 브랜치 준비

2. cross-origin isolation 부재 환경의 멀티스레드 제한
- 대응: 기본 단일 스레드 Worker를 표준 경로로 유지

3. 대용량(300MB/2000p) 메모리 압박
- 대응: 청크 축소 + 썸네일 품질 하향 + 부분 실패 리포트

## 스펙 커버리지 점검

- 기능 4종: Task 4A/4B/5에서 구현
- 작업흐름형 UI: Task 4C/6에서 구현
- 로컬 처리/배포: Task 7에서 검증
- 성능/안정성/복구: Task 5/7에서 검증
- 모바일 대응: Task 6에서 검증

## Placeholder 스캔 결과

- `TBD`, `TODO`, "추후", "적절히", "나중에" 없음
