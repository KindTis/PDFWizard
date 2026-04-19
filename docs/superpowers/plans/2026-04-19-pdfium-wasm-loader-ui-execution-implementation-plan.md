# PDFWizard PDFium WASM Loader + UI Runtime Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 PDFium WASM 로더를 연결하고, 업로드부터 작업 실행/다운로드까지 완전한 UI 플로우를 구현한다.

**Architecture:** Worker는 PDFium(merge/split/extract)과 PDF.js(render/thumbnail)를 EngineFacade로 라우팅한다. App은 FileRegistry + JobDispatcher + ResultExporter로 분리해 UI와 엔진 결합도를 낮춘다.

**Tech Stack:** React, TypeScript, Vite, Vitest, Playwright, `@embedpdf/pdfium`, `pdfjs-dist`, JSZip.

---

## 병렬 실행 설계 (요청 반영)

- 병렬 에이전트는 **Task 3A / Task 3B / Task 3C**에서만 사용한다.
- 선행 조건: Task 1, Task 2 완료 후 시작.
- 파일 소유권 분리:
  - Lane A: PDFium merge/split 엔진
  - Lane B: PDFium 이미지 추출 엔진
  - Lane C: 썸네일 기반 분할 GUI + 실행 UX
- 병렬 에이전트 모델 고정: `gpt-5.3-codex`
- 통합 책임: 메인 에이전트가 Task 4~6 단독 수행

## 파일 구조 맵

- Create: `src/worker/engines/pdfium/runtimeLoader.ts`
- Modify: `src/worker/engines/pdfium/runtime.ts`
- Create: `src/worker/engines/pdfium/runtimeLoader.test.ts`
- Create: `src/worker/engines/pdfium/nativeMemory.ts`
- Modify: `src/worker/engines/pdfium/mergeSplit.ts`
- Modify: `src/worker/engines/pdfium/mergeSplit.test.ts`
- Modify: `src/worker/jobs/mergeSplitJob.ts`
- Modify: `src/worker/jobs/mergeSplitJob.test.ts`
- Modify: `src/worker/engines/pdfium/extractImages.ts`
- Modify: `src/worker/engines/pdfium/extractImages.test.ts`
- Modify: `src/worker/policies/imageExtractionPolicy.ts`
- Modify: `src/worker/jobs/extractImagesJob.ts`
- Modify: `src/worker/jobs/extractImagesJob.test.ts`
- Create: `src/app/state/fileRegistry.ts`
- Create: `src/app/hooks/usePdfWorkflow.ts`
- Modify: `src/app/components/UploadZone.tsx`
- Modify: `src/app/components/ThumbnailWorkspace.tsx`
- Create: `src/app/components/SplitGroupEditor.tsx`
- Modify: `src/app/components/ActionPanel.tsx`
- Modify: `src/app/components/ProgressPanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/app/state/store.ts`
- Modify: `src/app/hooks/useWorkerClient.ts`
- Modify: `src/worker/index.ts`
- Modify: `src/worker/index.test.ts`
- Modify: `src/worker/protocol.ts`
- Modify: `src/app/utils/zip.ts`
- Modify: `src/app/utils/report.ts`
- Modify: `src/app/components/AppFlow.test.tsx`
- Modify: `src/app/components/accessibility.test.tsx`
- Create: `tests/e2e/runtime-workflow.spec.ts`
- Modify: `tests/e2e/workflow.spec.ts`
- Modify: `tests/e2e/app-shell.spec.ts`
- Modify: `.github/workflows/pages.yml`
- Modify: `docs/licenses/THIRD_PARTY_NOTICES.md`
- Modify: `package.json`

---

### Task 1: 실제 PDFium WASM Runtime 로더 확정 (Sequential)

**Files:**
- Create: `src/worker/engines/pdfium/runtimeLoader.ts`
- Modify: `src/worker/engines/pdfium/runtime.ts`
- Test: `src/worker/engines/pdfium/runtimeLoader.test.ts`
- Modify: `package.json`

- [ ] **Step 1: 실패 테스트 작성 (singleton + init 호출 검증)**

```ts
// src/worker/engines/pdfium/runtimeLoader.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createPdfiumRuntimeLoader } from './runtimeLoader';

describe('createPdfiumRuntimeLoader', () => {
  it('initializes @embedpdf/pdfium once and reuses module', async () => {
    const init = vi.fn().mockResolvedValue({ PDFiumExt_Init: vi.fn() });
    const fetchWasm = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);

    const loader = createPdfiumRuntimeLoader({ init, fetchWasm });
    const a = await loader.load();
    const b = await loader.load();

    expect(init).toHaveBeenCalledOnce();
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/worker/engines/pdfium/runtimeLoader.test.ts`
Expected: FAIL (`Cannot find module './runtimeLoader'`).

- [ ] **Step 3: 최소 구현 작성**

```ts
// src/worker/engines/pdfium/runtimeLoader.ts
import { init } from '@embedpdf/pdfium';
import pdfiumWasmUrl from '@embedpdf/pdfium/dist/pdfium.wasm?url';

export function createPdfiumRuntimeLoader(deps?: {
  init?: typeof init;
  fetchWasm?: () => Promise<ArrayBuffer>;
}) {
  let loading: Promise<any> | null = null;
  let loaded: any | null = null;

  const loadInit = deps?.init ?? init;
  const fetchWasm = deps?.fetchWasm ?? (async () => {
    const res = await fetch(pdfiumWasmUrl);
    if (!res.ok) throw new Error('WASM_LOAD_FAILED');
    return res.arrayBuffer();
  });

  return {
    async load() {
      if (loaded) return loaded;
      if (!loading) {
        loading = (async () => {
          const wasmBinary = await fetchWasm();
          const module = await loadInit({ wasmBinary } as any);
          module.PDFiumExt_Init?.();
          loaded = module;
          return module;
        })();
      }
      return loading;
    },
  };
}
```

- [ ] **Step 4: runtime.ts를 loader 기반으로 정리**

```ts
// src/worker/engines/pdfium/runtime.ts (핵심)
import { createPdfiumRuntimeLoader } from './runtimeLoader';

export const defaultPdfiumRuntime = createPdfiumRuntimeLoader();
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm run test -- src/worker/engines/pdfium/runtimeLoader.test.ts src/worker/engines/pdfium/runtime.test.ts`
Expected: PASS.

- [ ] **Step 6: 의존성 추가**

Run: `npm install @embedpdf/pdfium`
Expected: lockfile 업데이트.

- [ ] **Step 7: 커밋**

```bash
git add package.json package-lock.json src/worker/engines/pdfium/runtimeLoader.ts src/worker/engines/pdfium/runtime.ts src/worker/engines/pdfium/runtimeLoader.test.ts
git commit -m "feat: add real pdfium wasm runtime loader"
```

---

### Task 2: UI-Worker 실행 기반(파일 레지스트리 + 디스패치) 구축 (Sequential)

**Files:**
- Create: `src/app/state/fileRegistry.ts`
- Create: `src/app/hooks/usePdfWorkflow.ts`
- Modify: `src/app/components/UploadZone.tsx`
- Modify: `src/app/components/ActionPanel.tsx`
- Modify: `src/app/hooks/useWorkerClient.ts`
- Modify: `src/app/state/store.ts`
- Test: `src/app/components/AppFlow.test.tsx`, `src/app/hooks/useWorkerClient.test.ts`

- [ ] **Step 1: 실패 테스트 작성 (업로드 후 파일 개수 반영 + 실행 버튼 활성화)**

```tsx
// src/app/components/AppFlow.test.tsx (추가)
expect(screen.getByText('업로드된 파일: 1')).toBeInTheDocument();
expect(screen.getByRole('button', { name: '작업 실행' })).toBeEnabled();
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/app/components/AppFlow.test.tsx`
Expected: FAIL (요소 없음).

- [ ] **Step 3: 파일 레지스트리와 실행 훅 구현**

```ts
// src/app/state/fileRegistry.ts
export type RegisteredPdf = { id: string; name: string; bytes: ArrayBuffer; pageCount?: number };

export function createFileRegistry() {
  const files = new Map<string, RegisteredPdf>();
  return {
    upsert(file: RegisteredPdf) { files.set(file.id, file); },
    list() { return [...files.values()]; },
    clear() { files.clear(); },
  };
}
```

```ts
// src/app/hooks/usePdfWorkflow.ts (핵심)
// - 파일 업로드 등록
// - job payload 생성
// - workerClient.request 호출
// - done/error/progress를 store에 반영
```

- [ ] **Step 4: UploadZone/ActionPanel 연결**

```tsx
// UploadZone.tsx (핵심)
<input type="file" accept="application/pdf" multiple onChange={handleFiles} />

// ActionPanel.tsx (핵심)
<button type="button" onClick={runCurrentJob} disabled={uploadedFileCount === 0}>작업 실행</button>
<button type="button" onClick={cancelCurrentJob}>취소</button>
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm run test -- src/app/components/AppFlow.test.tsx src/app/hooks/useWorkerClient.test.ts`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/app/state/fileRegistry.ts src/app/hooks/usePdfWorkflow.ts src/app/components/UploadZone.tsx src/app/components/ActionPanel.tsx src/app/hooks/useWorkerClient.ts src/app/state/store.ts src/app/components/AppFlow.test.tsx src/app/hooks/useWorkerClient.test.ts
git commit -m "feat: wire upload registry and job dispatch flow"
```

---

### Task 3A: PDFium Merge/Split 실연산 구현 (Parallel Lane A)

**Owner:** Subagent A (`gpt-5.3-codex`)

**Files:**
- Create: `src/worker/engines/pdfium/nativeMemory.ts`
- Modify: `src/worker/engines/pdfium/mergeSplit.ts`
- Modify: `src/worker/jobs/mergeSplitJob.ts`
- Test: `src/worker/engines/pdfium/mergeSplit.test.ts`, `src/worker/jobs/mergeSplitJob.test.ts`

- [ ] **Step 1: 실패 테스트 작성 (FPDF 함수 호출 시퀀스 검증)**

```ts
// mergeSplit.test.ts (추가)
expect(module.FPDF_ImportPagesByIndex).toHaveBeenCalled();
expect(module.FPDF_SaveAsCopy).toHaveBeenCalled();
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/worker/engines/pdfium/mergeSplit.test.ts`
Expected: FAIL.

- [ ] **Step 3: merge 실연산 구현**

```ts
// mergeSplit.ts (핵심 흐름)
// 1) 입력 문서 로드(FPDF_LoadMemDocument)
// 2) 대상 문서 생성(FPDF_CreateNewDocument)
// 3) range -> index 배열 변환 후 FPDF_ImportPagesByIndex
// 4) FPDF_SaveAsCopy 콜백 writer로 Uint8Array 수집
// 5) 문서 핸들 해제(FPDF_CloseDocument)
```

- [ ] **Step 4: split 실연산 구현**

```ts
// split (핵심)
// 각 range별 새 문서 생성 -> 페이지 import -> saveAsCopy -> artifact push
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm run test -- src/worker/engines/pdfium/mergeSplit.test.ts src/worker/jobs/mergeSplitJob.test.ts`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/worker/engines/pdfium/nativeMemory.ts src/worker/engines/pdfium/mergeSplit.ts src/worker/jobs/mergeSplitJob.ts src/worker/engines/pdfium/mergeSplit.test.ts src/worker/jobs/mergeSplitJob.test.ts
git commit -m "feat: implement real pdfium merge and split"
```

---

### Task 3B: PDFium 원본 이미지 추출 실연산 구현 (Parallel Lane B)

**Owner:** Subagent B (`gpt-5.3-codex`)

**Files:**
- Modify: `src/worker/engines/pdfium/extractImages.ts`
- Modify: `src/worker/policies/imageExtractionPolicy.ts`
- Modify: `src/worker/jobs/extractImagesJob.ts`
- Test: `src/worker/engines/pdfium/extractImages.test.ts`, `src/worker/jobs/extractImagesJob.test.ts`

- [ ] **Step 1: 실패 테스트 작성 (객체 순회 + 정책 분기 검증)**

```ts
// extractImages.test.ts (추가)
expect(module.FPDFPage_CountObjects).toHaveBeenCalled();
expect(module.FPDFImageObj_GetImageDataRaw).toHaveBeenCalled();
expect(result[0].metadata?.sourceEncoding).toBe('jpeg');
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/worker/engines/pdfium/extractImages.test.ts`
Expected: FAIL.

- [ ] **Step 3: 이미지 객체 추출 구현**

```ts
// extractImages.ts (핵심 흐름)
// 1) 문서/페이지 순회
// 2) FPDFPage_GetObject + FPDFPageObj_GetType(image)
// 3) FPDFImageObj_GetImageFilter / GetImageDataRaw 수집
// 4) policy(decideExtractionOutput) 적용
// 5) metadata(converted/source/output) 포함 artifact 반환
```

- [ ] **Step 4: 강제 변환 경로 구현**

```ts
// convert branch
// - outputFormat jpg/png만 허용
// - 실패 시 IMAGE_CONVERT_FAILED reasonCode 누적
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm run test -- src/worker/engines/pdfium/extractImages.test.ts src/worker/jobs/extractImagesJob.test.ts src/worker/policies/imageExtractionPolicy.test.ts`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/worker/engines/pdfium/extractImages.ts src/worker/policies/imageExtractionPolicy.ts src/worker/jobs/extractImagesJob.ts src/worker/engines/pdfium/extractImages.test.ts src/worker/jobs/extractImagesJob.test.ts src/worker/policies/imageExtractionPolicy.test.ts
git commit -m "feat: implement real pdfium image extraction path"
```

---

### Task 3C: 썸네일 기반 분할 GUI + 실행 UX 구현 (Parallel Lane C)

**Owner:** Subagent C (`gpt-5.3-codex`)

**Files:**
- Create: `src/app/components/SplitGroupEditor.tsx`
- Modify: `src/app/components/ThumbnailWorkspace.tsx`
- Modify: `src/app/components/UploadZone.tsx`
- Modify: `src/app/components/ActionPanel.tsx`
- Modify: `src/app/components/ProgressPanel.tsx`
- Modify: `src/App.tsx`
- Test: `src/app/components/AppFlow.test.tsx`, `src/app/components/accessibility.test.tsx`

- [ ] **Step 1: 실패 테스트 작성 (썸네일 기반 분할 UI 요소 검증)**

```tsx
// AppFlow.test.tsx (추가)
expect(screen.getByText('분할 그룹 편집')).toBeInTheDocument();
expect(screen.getByRole('button', { name: '그룹 추가' })).toBeInTheDocument();
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/app/components/AppFlow.test.tsx`
Expected: FAIL.

- [ ] **Step 3: SplitGroupEditor 구현**

```tsx
// SplitGroupEditor.tsx (핵심)
// - 썸네일 카드 선택
// - 선택 페이지를 그룹으로 묶기/해제
// - 그룹 -> "1-3,5" 범위 문자열 생성
```

- [ ] **Step 4: 실행 UX 연결**

```tsx
// ActionPanel.tsx (핵심)
// - 현재 jobType 기준 payload 생성
// - 실행 중 버튼 비활성 + 진행 상태 메시지 반영
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm run test -- src/app/components/AppFlow.test.tsx src/app/components/accessibility.test.tsx`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/app/components/SplitGroupEditor.tsx src/app/components/ThumbnailWorkspace.tsx src/app/components/UploadZone.tsx src/app/components/ActionPanel.tsx src/app/components/ProgressPanel.tsx src/App.tsx src/app/components/AppFlow.test.tsx src/app/components/accessibility.test.tsx
git commit -m "feat: add thumbnail-based split gui and run controls"
```

---

### Task 4: Worker 통합(실제 엔진 라우팅 + report.json) (Sequential Integration)

**Files:**
- Modify: `src/worker/index.ts`
- Modify: `src/worker/index.test.ts`
- Modify: `src/worker/protocol.ts`
- Modify: `src/app/utils/report.ts`
- Modify: `src/app/utils/zip.ts`

- [ ] **Step 1: 실패 테스트 작성 (extract 완료 시 report.json 강제 포함)**

```ts
// src/worker/index.test.ts (추가)
expect(done.artifacts.some((a) => a.name === 'report.json')).toBe(true);
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- src/worker/index.test.ts`
Expected: FAIL.

- [ ] **Step 3: index.ts 통합 구현**

```ts
// 핵심
// - createDefaultPdfiumModule 제거
// - runtimeLoader.load() 기반 실제 module 사용
// - extract-images는 report 요약 생성 후 report.json 첨부
```

- [ ] **Step 4: 에러 코드 표준화 추가**

```ts
// protocol.ts
export type WorkerErrorCode =
  | 'WASM_LOAD_FAILED'
  | 'PDFIUM_INIT_FAILED'
  | 'MERGE_FAILED'
  | 'SPLIT_FAILED'
  | 'IMAGE_CONVERT_FAILED'
  | 'JOB_CANCELLED'
  | 'JOB_FAILED';
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm run test -- src/worker/index.test.ts src/app/utils/zip.test.ts src/app/hooks/useWorkerClient.test.ts`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/worker/index.ts src/worker/index.test.ts src/worker/protocol.ts src/app/utils/report.ts src/app/utils/zip.ts
git commit -m "feat: integrate real runtime routing and report artifacts"
```

---

### Task 5: E2E 실행 경로 + GitHub Pages WASM 경로 검증 (Sequential)

**Files:**
- Create: `tests/e2e/runtime-workflow.spec.ts`
- Modify: `tests/e2e/workflow.spec.ts`
- Modify: `tests/e2e/app-shell.spec.ts`
- Modify: `.github/workflows/pages.yml`
- Modify: `docs/licenses/THIRD_PARTY_NOTICES.md`

- [ ] **Step 1: 실패 E2E 테스트 작성 (실업로드/실행 버튼/결과 패널 확인)**

```ts
// tests/e2e/runtime-workflow.spec.ts
import { test, expect } from '@playwright/test';

test('upload and run flow is available', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '작업 실행' })).toBeVisible();
  await expect(page.getByLabel('원본 유지')).toBeVisible();
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run e2e -- tests/e2e/runtime-workflow.spec.ts`
Expected: FAIL before UI wiring completion.

- [ ] **Step 3: Pages 워크플로에 E2E 스모크 포함**

```yaml
# .github/workflows/pages.yml (핵심)
- name: Run E2E smoke
  run: npm run e2e -- tests/e2e/app-shell.spec.ts tests/e2e/workflow.spec.ts tests/e2e/runtime-workflow.spec.ts
```

- [ ] **Step 4: 라이선스 문서 업데이트**

```md
- @embedpdf/pdfium: MIT (bundled PDFium Apache-2.0)
- pdfjs-dist: Apache-2.0
- JSZip: MIT
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm run e2e -- tests/e2e/app-shell.spec.ts tests/e2e/workflow.spec.ts tests/e2e/runtime-workflow.spec.ts`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add tests/e2e/runtime-workflow.spec.ts tests/e2e/workflow.spec.ts tests/e2e/app-shell.spec.ts .github/workflows/pages.yml docs/licenses/THIRD_PARTY_NOTICES.md
git commit -m "test: add runtime e2e coverage and pages workflow checks"
```

---

### Task 6: 최종 검증 및 릴리즈 체크 (Sequential)

**Files:**
- Modify: `src/app/state/store.ts` (필요 시 오류 메시지/상태 정리)
- Modify: `src/app/components/ProgressPanel.tsx` (최종 요약 표시)

- [ ] **Step 1: 전체 단위/통합 테스트 실행**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 2: 프로덕션 빌드 실행**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: E2E 전체 실행**

Run: `npm run e2e`
Expected: PASS.

- [ ] **Step 4: 커밋**

```bash
git add src/app/state/store.ts src/app/components/ProgressPanel.tsx
git commit -m "chore: finalize runtime execution readiness"
```

---

## 실행 순서 요약

1. Task 1 (Sequential)
2. Task 2 (Sequential)
3. Task 3A / 3B / 3C (Parallel)
4. Task 4 (Sequential Integration)
5. Task 5 (Sequential)
6. Task 6 (Sequential)

## 완료 기준 체크리스트

- [ ] PDFium WASM 실로더가 단일 초기화로 동작
- [ ] merge/split 결과가 실제 PDF 바이너리로 생성
- [ ] extract-images가 원본 유지/강제 변환 정책을 반영
- [ ] 썸네일 기반 분할 GUI에서 범위 지정 가능
- [ ] 업로드 -> 실행 -> 다운로드 플로우 완결
- [ ] report.json 포함 ZIP 다운로드
- [ ] `npm run test` / `npm run build` / `npm run e2e` 통과
- [ ] GitHub Pages에서 WASM 경로 정상 동작

## 리스크 체크

1. PDFium 포인터 메모리 관리 오류
- 대응: `nativeMemory.ts`로 malloc/free 호출을 단일화

2. 브라우저별 캔버스 인코딩 차이
- 대응: 렌더 어댑터의 encode 함수 주입형 유지

3. 대용량 PDF 처리 시 메모리 급증
- 대응: 페이지/이미지 청크 단위 처리와 진행 이벤트 발행

## 스펙 커버리지 점검

- 실제 로더/초기화: Task 1
- UI 실행 플로우: Task 2, Task 3C
- merge/split 실연산: Task 3A
- 이미지 추출 실연산: Task 3B
- 통합 report/error 처리: Task 4
- 배포/검증/컴플라이언스: Task 5, Task 6

## Placeholder 스캔 결과

- 금지 placeholder 문자열 없음
