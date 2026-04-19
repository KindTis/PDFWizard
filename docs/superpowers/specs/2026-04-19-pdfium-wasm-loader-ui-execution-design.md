# PDFWizard 실제 PDFium WASM 로더 + UI 실행 플로우 설계 스펙

- 작성일: 2026-04-19
- 대상: GitHub Pages 정적 배포 환경에서 동작하는 완전 로컬 PDF 편집 웹앱
- 범위: 실제 PDFium WASM 로더 연결 + 업로드/실행/다운로드 UI 플로우 완전 연결

## 1. 배경과 문제 정의

현재 코드베이스는 엔진 경계(EngineFacade)와 테스트 골격은 갖췄지만, 실제 사용자 관점의 작업 완료 경로가 닫혀 있다.

1. Worker 내부 PDFium 경로는 스텁 모듈 문자열 반환 중심이다.
2. UI 업로드 영역은 정적 버튼 상태이며 파일 선택/등록/검증/작업 실행이 연결되지 않았다.
3. 썸네일 기반 분할 GUI와 작업 실행(merge/split/extract/pages-to-images) 트리거가 없다.
4. GitHub Pages 환경에서 WASM 경로를 안정적으로 로드하는 계약이 아직 확정되지 않았다.

즉, 현재 빌드/테스트 통과 상태는 "아키텍처 골격 확인" 단계이고, 실제 PDF 편집 동작 완료 단계는 아니다.

## 2. 목표와 완료 기준

## 2.1 기능 목표

1. 사용자 업로드 PDF를 기준으로 merge/split/extract-images/pages-to-images 작업을 실제로 수행한다.
2. merge/split/extract-images는 PDFium WASM 실연산으로 처리한다.
3. pages-to-images/썸네일은 PDF.js 렌더 경로로 처리한다.
4. 결과물은 ZIP으로 다운로드하며 `report.json`을 항상 포함한다.

## 2.2 UX 목표

1. 업로드 -> 썸네일 표시 -> 작업 옵션 설정 -> 실행 -> 진행률 -> 다운로드가 한 화면에서 완결된다.
2. 분할 작업은 페이지 썸네일을 보고 그룹(범위)을 편집할 수 있는 GUI를 제공한다.
3. 이미지 추출은 "원본 유지"와 "강제 PNG/JPG 변환" 옵션을 UI에서 명시적으로 제어한다.

## 2.3 완료 기준 (Definition of Done)

1. 스텁 문자열(`pdfium-merge:*`)이 아닌 실제 PDF 바이너리 결과를 생성한다.
2. 로컬 브라우저와 GitHub Pages URL 모두에서 WASM 로딩 성공.
3. 단위/통합/E2E 테스트 통과 + `npm run build` 통과.
4. OSS 고지와 라이선스 문서가 실제 의존성과 일치.

## 3. 접근 방식 비교와 선택

## 3.1 접근안 A (권장): `@embedpdf/pdfium` 저수준 API 래핑

- 방식: `init({ wasmBinary })`로 모듈 초기화 후 `FPDF_ImportPages`, `FPDF_SaveAsCopy`, `FPDFImageObj_*` 등 함수 래핑.
- 장점:
  - 브라우저 WASM 사용이 명확하고 타입 정의가 제공된다.
  - merge/split/extract를 한 엔진에서 일관되게 처리 가능.
  - 기존 EngineFacade 구조와 결합이 쉽다.
- 단점:
  - 저수준 API 래핑 비용이 있다.
  - 메모리 관리(ptr/free) 실수가 기능 오류로 이어질 수 있다.

## 3.2 접근안 B: `@hyzyla/pdfium` 중심 경로

- 장점: wrapper 사용성은 좋다.
- 단점: 렌더 중심 사례가 많아 merge/split/extract 저수준 제어에 추가 검증이 필요하다.

## 3.3 접근안 C: 서버 측 PDF 처리 혼합

- 장점: 브라우저 메모리 부담 완화 가능.
- 단점: 사용자 요구(완전 로컬 처리, GitHub Pages)와 충돌.

## 3.4 선택

- 본 스펙은 **접근안 A**를 채택한다.

## 4. 확정 아키텍처

## 4.1 App Layer (React)

1. `UploadZone`: 다중 PDF 업로드 + 드래그드롭 + 기본 검증(확장자/크기).
2. `ThumbnailWorkspace`: 업로드 파일 페이지 썸네일 렌더 + 분할 그룹 편집 UI.
3. `ActionPanel`: 작업 타입/옵션 설정 + 실행 버튼 + 취소 버튼.
4. `ProgressPanel`: 진행률, 상태, 결과 요약(원본/변환/실패) 표시.

## 4.2 Worker Layer

1. `createWorkerMessageHandler`는 JobType 기준 라우팅 유지.
2. `pdfium` 어댑터는 실제 WASM 모듈을 통해 merge/split/extract 실행.
3. `pdfjs` 어댑터는 페이지 렌더/썸네일 생성 담당.
4. 종료 시 `report.json`을 결과 아티팩트에 추가.

## 4.3 Engine Adapter Layer

1. `PdfiumRuntimeLoader`
  - 책임: wasm binary fetch + `init` + `PDFiumExt_Init` + singleton 캐시.
2. `PdfiumMergeSplitAdapter`
  - 책임: 문서 로드, 페이지 import, 결과 저장.
3. `PdfiumExtractImagesAdapter`
  - 책임: 페이지 객체 순회, 이미지 객체 추출, 정책 적용.
4. `PdfJsRenderAdapter`
  - 책임: 페이지 렌더와 썸네일 비트맵 생성.

## 4.4 Artifact/Report Layer

1. 산출물: PDF/이미지 파일 + `report.json`.
2. 리포트: successCount/convertedCount/failedCount/failedItems.
3. 실패 항목은 `page`, `objectId`, `sourceEncoding`, `reasonCode`를 포함.

## 5. 핵심 인터페이스 계약

## 5.1 PDFium Runtime Loader 계약

- 입력: wasm URL 또는 wasm binary(ArrayBuffer)
- 출력: 초기화 완료된 `WrappedPdfiumModule`
- 보장:
  - 동일 세션에서 1회만 초기화
  - 실패 시 `WASM_LOAD_FAILED` 또는 `PDFIUM_INIT_FAILED` 코드 표준화

## 5.2 Merge/Split 계약

- `merge(files, rangesByFile)`
  - 파일별 선택 범위를 반영해 단일 PDF 생성
- `split(file, ranges)`
  - 범위 토큰별 출력 PDF 생성
- 공통:
  - 결과 MIME: `application/pdf`
  - 빈 결과 금지, 실패 시 명시 오류

## 5.3 Extract Images 계약

- `extractImages(file, { preserveOriginal, forceOutputFormat?, quality? })`
- 정책:
  - `preserveOriginal=true`면 원본 인코딩 우선
  - 강제 변환 시 PNG/JPG만 허용
- 메타:
  - `metadata.converted`, `metadata.sourceEncoding`, `metadata.outputEncoding`

## 5.4 UI Job 계약

- 공통: `jobId`, `type`, `payload`
- `extract-images.payload`
  - `preserveOriginal: boolean`
  - `forceOutputFormat?: 'png' | 'jpg'`
  - `quality?: number`
- `pages-to-images.payload`
  - `ranges`, `format`, `dpi`, `quality`

## 6. 상세 데이터 플로우

1. 사용자가 PDF 업로드
2. `FileRegistry`에 `id/name/bytes/pageCount` 등록
3. 썸네일 프리뷰 생성 (PDF.js)
4. 사용자가 작업 타입/옵션/범위를 설정
5. 메인 스레드가 Worker에 Job 전송
6. Worker가 엔진 라우팅 후 작업 실행
7. 진행 이벤트(`progress`)를 UI 상태로 반영
8. 완료 시 아티팩트 + `report.json` 수신
9. ZIP 생성 후 다운로드

## 7. 에러 처리와 복구 정책

## 7.1 표준 에러 코드

- `WASM_LOAD_FAILED`
- `PDFIUM_INIT_FAILED`
- `PDF_PARSE_FAILED`
- `MERGE_FAILED`
- `SPLIT_FAILED`
- `UNSUPPORTED_IMAGE_ENCODING`
- `IMAGE_DECODE_FAILED`
- `IMAGE_CONVERT_FAILED`
- `RENDER_FAILED`
- `JOB_CANCELLED`

## 7.2 복구 정책

1. WASM 로딩 실패: 1회 재시도 후 실패 리포트.
2. 이미지 추출 일부 실패: 전체 작업 중단 없이 `partial_failed` 처리.
3. 취소 요청 수신 시 다음 청크 경계에서 중단.

## 8. 성능 및 메모리 정책

1. 페이지 렌더는 동시 처리 개수 제한(기본 2).
2. 대용량 파일은 범위별 청크 처리.
3. 썸네일은 저해상도 우선 렌더 후 필요 시 재렌더.

## 9. 테스트 전략

## 9.1 단위

1. runtime loader singleton/에러 매핑
2. merge/split adapter 호출 계약
3. extract policy(원본/강제 변환)
4. UI 상태 머신(업로드/실행/완료/에러)

## 9.2 통합

1. worker 라우팅 -> 엔진 호출 -> report 생성
2. zip 결과에 `report.json` 포함 검증

## 9.3 E2E

1. 업로드 -> 분할 GUI 조작 -> split 실행 -> ZIP 다운로드
2. 이미지 추출(원본 유지) 및 강제 변환 비교
3. pages-to-images 실행과 아티팩트 확인

## 10. 보안/컴플라이언스

1. 파일 외부 전송 금지 (네트워크 업로드 코드 금지)
2. 라이선스 문서에 실제 사용 패키지 반영
  - `@embedpdf/pdfium` (MIT + bundled PDFium Apache-2.0)
  - `pdfjs-dist` (Apache-2.0)
  - `jszip` (MIT)

## 11. 비목표

1. OCR/텍스트 인식
2. 서버 연동 PDF 처리
3. 협업/동시 편집 기능

## 12. 리스크와 대응

1. PDFium 저수준 API 난이도
  - 대응: 어댑터 계층을 세분화하고 포인터 유틸을 별도 파일로 격리
2. 브라우저별 캔버스/이미지 인코딩 차이
  - 대응: encode 경로를 주입 가능하게 유지하고 폴백 분기 테스트 추가
3. GitHub Pages WASM 경로 이슈
  - 대응: `import ...wasm?url` 기반으로 번들러 경로를 단일화

## 13. 승인 후 다음 단계

- 이 스펙 승인 후, 구현 계획은 아래 원칙으로 작성한다.
  1. Task 1~2는 순차
  2. Task 3A/3B/3C는 상호 독립 범위에서만 병렬
  3. 통합/검증(Task 4+)은 메인 에이전트 단일 책임