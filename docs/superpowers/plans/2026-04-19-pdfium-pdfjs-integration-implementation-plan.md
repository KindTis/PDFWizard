# PDFWizard PDFium+PDF.js Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MuPDF 스텁을 제거하고 PDFium(WASM)+PDF.js 실연동으로 합치기/분할/원본 이미지 추출/페이지 렌더를 동작시킨다.

**Architecture:** EngineFacade를 기준으로 PDFium(문서 편집/원본 이미지 추출)과 PDF.js(페이지 렌더)를 분리한다. Worker 라우팅은 JobType 기준으로 유지하고, 결과는 공통 Artifact + report.json으로 수렴한다.

**Tech Stack:** React, TypeScript, Vite, Vitest, Playwright, pdfjs-dist, PDFium WASM binding(프로젝트 채택판), JSZip.

---

## 병렬 실행 설계 (요청 반영)

- 병렬 에이전트는 **Task 3A / 3B / 3C**에서만 사용한다.
- 선행 조건: Task 1, Task 2 완료 후 시작.
- 파일 소유권 분리:
  - Lane A: merge/split 라인
  - Lane B: extract-images + policy 라인
  - Lane C: PDF.js render 라인
- 병렬 에이전트 모델 고정: `gpt-5.3-codex`
- 통합 책임: 메인 에이전트가 Task 4에서 단일 통합

## 파일 구조 맵

- Create: `src/worker/engines/types.ts`
- Create: `src/worker/engines/engineFacade.ts`
- Create: `src/worker/engines/engineFacade.test.ts`
- Create: `src/worker/engines/pdfium/runtime.ts`
- Create: `src/worker/engines/pdfium/runtime.test.ts`
- Create: `src/worker/engines/pdfium/mergeSplit.ts`
- Create: `src/worker/engines/pdfium/mergeSplit.test.ts`
- Create: `src/worker/engines/pdfium/extractImages.ts`
- Create: `src/worker/engines/pdfium/extractImages.test.ts`
- Create: `src/worker/engines/pdfjs/render.ts`
- Create: `src/worker/engines/pdfjs/render.test.ts`
- Create: `src/worker/policies/imageExtractionPolicy.ts`
- Create: `src/worker/policies/imageExtractionPolicy.test.ts`
- Modify: `src/worker/protocol.ts`
- Modify: `src/worker/jobs/mergeSplitJob.ts`
- Modify: `src/worker/jobs/extractImagesJob.ts`
- Modify: `src/worker/jobs/pagesToImagesJob.ts`
- Modify: `src/worker/index.ts`
- Modify: `src/worker/index.test.ts`
- Create: `src/app/utils/report.ts`
- Modify: `src/app/utils/zip.ts`
- Modify: `src/app/state/store.ts`
- Modify: `src/app/components/ActionPanel.tsx`
- Modify: `src/app/components/ProgressPanel.tsx`
- Modify: `src/app/components/AppFlow.test.tsx`
- Modify: `tests/e2e/workflow.spec.ts`
- Modify: `tests/e2e/app-shell.spec.ts`
- Create: `tests/e2e/extract-images.spec.ts`
- Create: `docs/licenses/THIRD_PARTY_NOTICES.md`

---

### Task 1: 엔진 추상화 계층 도입 (Sequential)

**Files:**
- Create: `src/worker/engines/types.ts`, `src/worker/engines/engineFacade.ts`
- Modify: `src/worker/protocol.ts`
- Test: `src/worker/engines/engineFacade.test.ts`

- [ ] **Step 1: 실패하는 EngineFacade 테스트 작성**

```ts
// src/worker/engines/engineFacade.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createEngineFacade } from './engineFacade';

describe('EngineFacade', () => {
  it('routes merge to pdfium adapter', async () => {
    const facade = createEngineFacade({
      pdfium: { merge: vi.fn().mockResolvedValue([]), split: vi.fn(), extractImages: vi.fn() } as any,
      pdfjs: { renderPages: vi.fn() } as any,
    });

    await facade.merge([], {});
    expect(facade.adapters.pdfium.merge).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/worker/engines/engineFacade.test.ts`
Expected: FAIL with "Cannot find module './engineFacade'".

- [ ] **Step 3: 최소 구현 작성**

```ts
// src/worker/engines/types.ts
import type { Artifact, BinaryFile } from '../protocol';

export type PdfiumAdapter = {
  merge: (files: BinaryFile[], rangesByFile: Record<string, string>) => Promise<Artifact[]>;
  split: (file: BinaryFile, ranges: string) => Promise<Artifact[]>;
  extractImages: (file: BinaryFile, options: { preserveOriginal: boolean; forceOutputFormat?: 'png' | 'jpg'; quality?: number }) => Promise<Artifact[]>;
};

export type PdfJsAdapter = {
  renderPages: (file: BinaryFile, pages: number[], options: { format: 'png' | 'jpg'; dpi: number; quality: number }) => Promise<Artifact[]>;
};
```

```ts
// src/worker/engines/engineFacade.ts
import type { BinaryFile } from '../protocol';
import type { PdfiumAdapter, PdfJsAdapter } from './types';

export function createEngineFacade(adapters: { pdfium: PdfiumAdapter; pdfjs: PdfJsAdapter }) {
  return {
    adapters,
    merge: (files: BinaryFile[], rangesByFile: Record<string, string>) => adapters.pdfium.merge(files, rangesByFile),
    split: (file: BinaryFile, ranges: string) => adapters.pdfium.split(file, ranges),
    extractImages: (file: BinaryFile, options: { preserveOriginal: boolean; forceOutputFormat?: 'png' | 'jpg'; quality?: number }) =>
      adapters.pdfium.extractImages(file, options),
    renderPages: (file: BinaryFile, pages: number[], options: { format: 'png' | 'jpg'; dpi: number; quality: number }) =>
      adapters.pdfjs.renderPages(file, pages, options),
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- src/worker/engines/engineFacade.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/worker/engines/types.ts src/worker/engines/engineFacade.ts src/worker/engines/engineFacade.test.ts src/worker/protocol.ts
git commit -m "feat: add engine facade for pdfium and pdfjs routing"
```

---

### Task 2: PDFium Runtime 로더 기반 구축 (Sequential)

**Files:**
- Create: `src/worker/engines/pdfium/runtime.ts`
- Test: `src/worker/engines/pdfium/runtime.test.ts`

- [ ] **Step 1: 실패하는 runtime 로더 테스트 작성**

```ts
// src/worker/engines/pdfium/runtime.test.ts
import { describe, expect, it } from 'vitest';
import { createPdfiumRuntime } from './runtime';

describe('createPdfiumRuntime', () => {
  it('loads runtime once and returns stable instance', async () => {
    const runtime = createPdfiumRuntime(async () => ({ tag: 'pdfium-mock' }));
    const a = await runtime.load();
    const b = await runtime.load();
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/worker/engines/pdfium/runtime.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: 최소 구현 작성**

```ts
// src/worker/engines/pdfium/runtime.ts
export type PdfiumModule = { tag: string };

export function createPdfiumRuntime(loader: () => Promise<PdfiumModule>) {
  let loaded: PdfiumModule | null = null;
  let loading: Promise<PdfiumModule> | null = null;

  return {
    async load(): Promise<PdfiumModule> {
      if (loaded) return loaded;
      if (!loading) {
        loading = loader().then((m) => {
          loaded = m;
          return m;
        });
      }
      return loading;
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- src/worker/engines/pdfium/runtime.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/worker/engines/pdfium/runtime.ts src/worker/engines/pdfium/runtime.test.ts
git commit -m "feat: add memoized pdfium runtime loader"
```

---

### Task 3A: PDFium Merge/Split 연동 (Parallel Lane A)

**Owner:** Subagent A (`gpt-5.3-codex`)

**Files:**
- Create: `src/worker/engines/pdfium/mergeSplit.ts`
- Modify: `src/worker/jobs/mergeSplitJob.ts`
- Test: `src/worker/engines/pdfium/mergeSplit.test.ts`, `src/worker/jobs/mergeSplitJob.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/worker/engines/pdfium/mergeSplit.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createPdfiumMergeSplitAdapter } from './mergeSplit';

describe('pdfium merge/split adapter', () => {
  it('calls module.merge with given files', async () => {
    const module = { merge: vi.fn().mockResolvedValue(new Uint8Array([1])) } as any;
    const adapter = createPdfiumMergeSplitAdapter(async () => module as any);
    const out = await adapter.merge([], {});
    expect(module.merge).toHaveBeenCalledOnce();
    expect(out[0].name).toBe('merged.pdf');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/worker/engines/pdfium/mergeSplit.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현 작성**

```ts
// src/worker/engines/pdfium/mergeSplit.ts
import type { Artifact, BinaryFile } from '../../protocol';

export function createPdfiumMergeSplitAdapter(loadModule: () => Promise<any>) {
  return {
    async merge(files: BinaryFile[], rangesByFile: Record<string, string>): Promise<Artifact[]> {
      const m = await loadModule();
      const bytes: Uint8Array = await m.merge(files, rangesByFile);
      return [{ name: 'merged.pdf', mime: 'application/pdf', bytes }];
    },
    async split(file: BinaryFile, ranges: string): Promise<Artifact[]> {
      const m = await loadModule();
      const outputs: Uint8Array[] = await m.split(file, ranges);
      return outputs.map((bytes, i) => ({ name: `${file.name}-part-${i + 1}.pdf`, mime: 'application/pdf', bytes }));
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- src/worker/engines/pdfium/mergeSplit.test.ts src/worker/jobs/mergeSplitJob.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/worker/engines/pdfium/mergeSplit.ts src/worker/engines/pdfium/mergeSplit.test.ts src/worker/jobs/mergeSplitJob.ts src/worker/jobs/mergeSplitJob.test.ts
git commit -m "feat: wire pdfium merge split adapter"
```

---

### Task 3B: PDFium 원본 이미지 추출 + 정책 적용 (Parallel Lane B)

**Owner:** Subagent B (`gpt-5.3-codex`)

**Files:**
- Create: `src/worker/engines/pdfium/extractImages.ts`
- Create: `src/worker/policies/imageExtractionPolicy.ts`
- Test: `src/worker/engines/pdfium/extractImages.test.ts`, `src/worker/policies/imageExtractionPolicy.test.ts`
- Modify: `src/worker/jobs/extractImagesJob.ts`, `src/worker/jobs/imageJobs.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/worker/policies/imageExtractionPolicy.test.ts
import { describe, expect, it } from 'vitest';
import { decideExtractionOutput } from './imageExtractionPolicy';

describe('image extraction policy', () => {
  it('keeps original encoding when preserveOriginal is true', () => {
    const d = decideExtractionOutput({ sourceEncoding: 'jpx', preserveOriginal: true });
    expect(d.mode).toBe('preserve');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/worker/policies/imageExtractionPolicy.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현 작성**

```ts
// src/worker/policies/imageExtractionPolicy.ts
export type SourceEncoding = 'jpeg' | 'png' | 'jpx' | 'jbig2' | 'ccitt';

export function decideExtractionOutput(input: { sourceEncoding: SourceEncoding; preserveOriginal: boolean; forceOutputFormat?: 'png' | 'jpg' }) {
  if (!input.preserveOriginal && input.forceOutputFormat) {
    return { mode: 'convert' as const, outputEncoding: input.forceOutputFormat };
  }
  return { mode: 'preserve' as const, outputEncoding: input.sourceEncoding };
}
```

```ts
// src/worker/engines/pdfium/extractImages.ts
import type { Artifact, BinaryFile } from '../../protocol';
import { decideExtractionOutput } from '../../policies/imageExtractionPolicy';

export function createPdfiumExtractImagesAdapter(loadModule: () => Promise<any>) {
  return {
    async extractImages(file: BinaryFile, options: { preserveOriginal: boolean; forceOutputFormat?: 'png' | 'jpg'; quality?: number }): Promise<Artifact[]> {
      const m = await loadModule();
      const raws = await m.extractImages(file);
      return raws.map((raw: any, index: number) => {
        const decision = decideExtractionOutput({ sourceEncoding: raw.encoding, preserveOriginal: options.preserveOriginal, forceOutputFormat: options.forceOutputFormat });
        const converted = decision.mode === 'convert' ? m.convertImage(raw.bytes, decision.outputEncoding, options.quality ?? 90) : raw.bytes;
        const ext = decision.outputEncoding === 'jpeg' ? 'jpg' : decision.outputEncoding;
        return { name: `image-${index + 1}.${ext}`, mime: ext === 'jpg' ? 'image/jpeg' : 'image/png', bytes: converted } as Artifact;
      });
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- src/worker/policies/imageExtractionPolicy.test.ts src/worker/engines/pdfium/extractImages.test.ts src/worker/jobs/imageJobs.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/worker/policies/imageExtractionPolicy.ts src/worker/policies/imageExtractionPolicy.test.ts src/worker/engines/pdfium/extractImages.ts src/worker/engines/pdfium/extractImages.test.ts src/worker/jobs/extractImagesJob.ts src/worker/jobs/imageJobs.test.ts
git commit -m "feat: add pdfium image extraction with preserve and convert policy"
```

---

### Task 3C: PDF.js 페이지 렌더 어댑터 연동 (Parallel Lane C)

**Owner:** Subagent C (`gpt-5.3-codex`)

**Files:**
- Create: `src/worker/engines/pdfjs/render.ts`
- Test: `src/worker/engines/pdfjs/render.test.ts`
- Modify: `src/worker/jobs/pagesToImagesJob.ts`, `src/worker/jobs/imageJobs.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/worker/engines/pdfjs/render.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createPdfJsRenderAdapter } from './render';

describe('pdfjs render adapter', () => {
  it('renders selected pages and returns artifacts', async () => {
    const getDocument = vi.fn().mockResolvedValue({
      getPage: vi.fn().mockResolvedValue({ renderToBytes: vi.fn().mockResolvedValue(new Uint8Array([1])) }),
    });
    const adapter = createPdfJsRenderAdapter(getDocument as any);
    const out = await adapter.renderPages({ id: 'f', name: 'a.pdf', bytes: new ArrayBuffer(0) }, [1], { format: 'png', dpi: 150, quality: 90 });
    expect(out).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/worker/engines/pdfjs/render.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현 작성**

```ts
// src/worker/engines/pdfjs/render.ts
import type { Artifact, BinaryFile } from '../../protocol';

export function createPdfJsRenderAdapter(getDocument: (bytes: ArrayBuffer) => Promise<any>) {
  return {
    async renderPages(file: BinaryFile, pages: number[], options: { format: 'png' | 'jpg'; dpi: number; quality: number }): Promise<Artifact[]> {
      const doc = await getDocument(file.bytes);
      const out: Artifact[] = [];
      for (const pageNo of pages) {
        const page = await doc.getPage(pageNo);
        const bytes: Uint8Array = await page.renderToBytes(options);
        out.push({ name: `page-${pageNo}.${options.format}`, mime: options.format === 'jpg' ? 'image/jpeg' : 'image/png', bytes });
      }
      return out;
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- src/worker/engines/pdfjs/render.test.ts src/worker/jobs/imageJobs.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/worker/engines/pdfjs/render.ts src/worker/engines/pdfjs/render.test.ts src/worker/jobs/pagesToImagesJob.ts src/worker/jobs/imageJobs.test.ts
git commit -m "feat: add pdfjs render adapter for pages to images"
```

---

### Task 4: Worker 통합 및 공통 리포트 파이프라인 (Sequential Integration)

**Files:**
- Modify: `src/worker/index.ts`, `src/worker/index.test.ts`, `src/worker/protocol.ts`
- Create: `src/app/utils/report.ts`
- Modify: `src/app/utils/zip.ts`, `src/app/hooks/useWorkerClient.ts`, `src/app/state/store.ts`

- [ ] **Step 1: 실패 테스트 작성 (통합 라우팅 + report 생성)**

```ts
// src/worker/index.test.ts (추가 케이스)
it('adds report artifact when job ends with partial failures', async () => {
  expect(false).toBe(true);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/worker/index.test.ts`
Expected: FAIL with assertion error.

- [ ] **Step 3: 구현 작성**

```ts
// src/app/utils/report.ts
export function buildReportJson(data: {
  jobId: string;
  successCount: number;
  convertedCount: number;
  failedCount: number;
  failedItems: Array<{ page?: number; objectId?: string; reasonCode: string }>;
}) {
  return new TextEncoder().encode(JSON.stringify(data, null, 2));
}
```

```ts
// src/worker/index.ts (핵심)
// - EngineFacade 생성
// - job type에 따라 facade 메서드 호출
// - done 이벤트 전 report.json 아티팩트 추가
// - cancel 이벤트 처리
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- src/worker/index.test.ts src/app/hooks/useWorkerClient.test.ts src/app/utils/zip.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/worker/index.ts src/worker/index.test.ts src/worker/protocol.ts src/app/utils/report.ts src/app/utils/zip.ts src/app/hooks/useWorkerClient.ts src/app/state/store.ts
git commit -m "feat: integrate pdfium pdfjs facade and report pipeline"
```

---

### Task 5: UI 옵션/진행 상태 확장 (Sequential)

**Files:**
- Modify: `src/app/components/ActionPanel.tsx`
- Modify: `src/app/components/ProgressPanel.tsx`
- Modify: `src/app/components/AppFlow.test.tsx`
- Modify: `src/app/components/accessibility.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// src/app/components/AppFlow.test.tsx (추가)
expect(screen.getByLabelText('원본 유지')).toBeInTheDocument();
expect(screen.getByLabelText('강제 PNG/JPG 변환')).toBeInTheDocument();
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/app/components/AppFlow.test.tsx`
Expected: FAIL with missing controls.

- [ ] **Step 3: 구현 작성**

```tsx
// src/app/components/ActionPanel.tsx (핵심)
<label>
  <input type="checkbox" aria-label="원본 유지" defaultChecked />
  원본 유지
</label>
<label>
  <input type="checkbox" aria-label="강제 PNG/JPG 변환" />
  강제 PNG/JPG 변환
</label>
```

```tsx
// src/app/components/ProgressPanel.tsx (핵심)
<p>원본 유지: 0</p>
<p>변환: 0</p>
<p>실패: 0</p>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- src/app/components/AppFlow.test.tsx src/app/components/accessibility.test.tsx`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/app/components/ActionPanel.tsx src/app/components/ProgressPanel.tsx src/app/components/AppFlow.test.tsx src/app/components/accessibility.test.tsx
git commit -m "feat: add extraction policy controls and progress counters"
```

---

### Task 6: E2E/성능/컴플라이언스 보강 (Sequential)

**Files:**
- Create: `tests/e2e/extract-images.spec.ts`
- Modify: `tests/e2e/workflow.spec.ts`, `tests/e2e/app-shell.spec.ts`
- Create: `docs/licenses/THIRD_PARTY_NOTICES.md`
- Modify: `.github/workflows/pages.yml`

- [ ] **Step 1: 실패 E2E 테스트 작성**

```ts
// tests/e2e/extract-images.spec.ts
import { test, expect } from '@playwright/test';

test('shows extract policy controls', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('원본 유지')).toBeVisible();
  await expect(page.getByLabel('강제 PNG/JPG 변환')).toBeVisible();
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run e2e -- tests/e2e/extract-images.spec.ts`
Expected: FAIL before UI 반영 완료.

- [ ] **Step 3: 컴플라이언스 문서/워크플로 업데이트**

```md
<!-- docs/licenses/THIRD_PARTY_NOTICES.md -->
- pdfjs-dist: Apache-2.0
- PDFium: BSD-3-Clause
- pdf-lib: MIT
- JSZip: MIT
```

```yaml
# .github/workflows/pages.yml (추가)
- name: Run E2E smoke
  run: npm run e2e -- tests/e2e/workflow.spec.ts tests/e2e/app-shell.spec.ts tests/e2e/extract-images.spec.ts
```

- [ ] **Step 4: 최종 검증**

Run: `npm run test`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

Run: `npm run e2e -- tests/e2e/workflow.spec.ts tests/e2e/app-shell.spec.ts tests/e2e/extract-images.spec.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add tests/e2e/extract-images.spec.ts tests/e2e/workflow.spec.ts tests/e2e/app-shell.spec.ts docs/licenses/THIRD_PARTY_NOTICES.md .github/workflows/pages.yml
git commit -m "chore: add e2e coverage and third-party notices"
```

---

## 실행 순서 요약

1. Task 1
2. Task 2
3. Task 3A/3B/3C 병렬
4. Task 4
5. Task 5
6. Task 6

## 완료 기준

- 합치기/분할이 PDFium 경로로 동작
- 원본 이미지 추출 + 강제 변환 옵션 동작
- JPEG/PNG/JPX/JBIG2/CCITT 처리 경로와 실패 리포트 동작
- 페이지->이미지/썸네일이 PDF.js 경로로 동작
- report.json 포함 ZIP 다운로드
- unit/integration/e2e/build 모두 통과

## 리스크 체크

1. PDFium 바인딩 API 차이
- 대응: runtime adapter 단일 파일 격리

2. 특수 인코딩 변환 실패율
- 대응: 실패 항목 상세 리포트 + 부분 성공 허용

3. 브라우저 메모리 한계
- 대응: 기존 memoryGuard 정책과 청크 축소 연계

## 스펙 커버리지 점검

- 엔진 교체(PDFium+PDF.js): Task 1~4
- 원본 추출 + 강제 변환: Task 3B, Task 5
- 에러/리포트/복구: Task 4
- 테스트/배포/컴플라이언스: Task 6

## Placeholder 스캔 결과

- `TBD`, `TODO`, `implement later`, `fill in details` 없음
