# PDFWizard 🧙‍♂️📄

브라우저에서 동작하는 로컬 PDF 작업 도구입니다.  
React UI + Web Worker + WASM(PDFium) + PDF.js 조합으로 PDF 편집/변환 작업을 처리합니다.

PDF 파일은 사용자의 브라우저 안에서 처리되며, 앱 서버로 업로드하지 않습니다.

## 주요 기능 ✨

- `PDF 합치기`(merge)
- `PDF 분할`(split, 단일 PDF 범위 분할 + 다중 PDF 그룹 분할)
- `이미지 추출`(업로드된 모든 PDF 대상, 원본 인코딩 우선)
- `페이지 → 이미지` 변환(업로드된 모든 PDF 대상, PNG/JPG)
- 썸네일 미리보기, 분할 범위/그룹 편집, 병합 순서 변경
- 진행 상태 표시와 작업 완료 후 자동/수동 다운로드
- 결과 파일 다운로드(단일 파일 또는 ZIP)

## 동작 방식 🔧

- `PDFium (@embedpdf/pdfium)`: 합치기, 분할, 원본 이미지 추출
- `PDF.js (pdfjs-dist)`: 페이지 렌더링, 페이지→이미지 변환
- `Web Worker`: 메인 스레드 블로킹 최소화
- `JSZip`: 다중 결과 ZIP 패키징

## 빠른 시작 🚀

### 0) 요구 사항

- Node.js `20.19.0` 이상, `22.12.0` 이상, 또는 `24.0.0` 이상
- npm

### 1) 설치

```bash
npm install
```

### 2) 개발 서버 실행

```bash
npm run dev
```

### 3) 빌드/미리보기

```bash
npm run build
npm run preview
```

### 4) 테스트

```bash
npm run test
npm run e2e:install
npm run e2e
```

## 온라인 사용 🌐

로컬 실행 없이도 아래 GitHub Pages에서 바로 사용할 수 있습니다.  
https://kindtis.github.io/PDFWizard

## 사용 방법 🧭

1. 앱을 실행한 뒤 `파일 선택` 버튼으로 PDF를 업로드합니다.
2. 여러 PDF를 처리하려면 한 번에 여러 파일을 선택합니다. `합치기` 작업에서는 설정 화면에서 PDF를 추가하거나 제거할 수 있습니다.
3. 상단 단계(`업로드 → 작업 → 내보내기`)에 따라 진행합니다.
4. 작업 탭에서 원하는 작업을 선택합니다.
   - `합치기`: PDF 2개 이상을 하나로 병합합니다. 드래그로 병합 순서를 바꿀 수 있습니다.
   - `분할`: 페이지 범위를 지정해 PDF를 나눕니다. 여러 PDF가 있으면 전체 페이지 기준으로 그룹을 만들 수 있습니다.
   - `이미지 추출`: 업로드된 모든 PDF에서 내부 이미지를 추출합니다. 현재 UI는 원본 인코딩 우선 정책으로 실행합니다.
   - `페이지→이미지`: 업로드된 모든 PDF 페이지를 PNG 또는 JPG 이미지로 렌더링합니다.
5. 작업별 설정을 확인합니다.
   - `분할`: 시작/끝 페이지와 분할 그룹
   - `페이지→이미지`: 출력 포맷(PNG/JPG), 품질
   - `합치기`: 병합 순서
6. 하단의 `실행` 버튼을 누르고 진행 상태를 확인합니다.
7. 완료 후 다운로드를 확인합니다.
   - 작업 완료 시 자동 다운로드를 시도합니다.
   - 자동 다운로드가 시작되지 않으면 `다시 다운로드` 또는 `결과 다운로드`를 누릅니다.
   - 결과가 1개면 단일 파일로 다운로드합니다.
   - 결과가 여러 개면 ZIP으로 다운로드합니다.

## 작업 타입별 출력 📦

| 작업 타입 | 입력 | 출력 |
| --- | --- | --- |
| `merge` | PDF 여러 개 | 병합된 PDF 1개 |
| `split` | PDF 1개 + 범위, 또는 PDF 여러 개 + 전체 페이지 기준 그룹 | 분할된 PDF 여러 개 |
| `extract-images` | PDF 1개 이상 | 추출 이미지(원본 인코딩 우선, 변환 정책 반영) |
| `pages-to-images` | PDF 1개 이상 | 페이지별 이미지(PNG/JPG) |

## 현재 동작 참고

- `merge`는 PDF 2개 이상이 있어야 실행할 수 있습니다.
- `extract-images`는 현재 화면에서 변환 옵션을 따로 받지 않고, 원본 인코딩 우선 정책으로 실행합니다.
- `pages-to-images`는 현재 모든 페이지를 변환합니다. 페이지 범위 선택 UI는 제공하지 않습니다.
- 내부 작업 결과에는 요약용 `report.json`이 포함될 수 있지만, 일반 다운로드에서는 사용자 산출물만 내려받습니다.
- 화면에는 작업 상태와 진행률을 표시합니다. `success`, `converted`, `failed` 세부 카운트는 현재 별도 UI로 표시하지 않습니다.

## 사용 라이브러리 및 라이선스 📚

아래는 현재 `package.json`의 직접 의존성 기준입니다.

### 런타임 의존성

| 라이브러리 | 용도 | 라이선스 |
| --- | --- | --- |
| `@dnd-kit/core` | 드래그 앤 드롭 상호작용 | `MIT` |
| `@dnd-kit/sortable` | 병합 순서 정렬 UI | `MIT` |
| `@dnd-kit/utilities` | dnd-kit 유틸리티 | `MIT` |
| `@embedpdf/pdfium` | PDFium WASM 기반 PDF 연산 | `MIT` (bundled PDFium: `Apache-2.0`) |
| `pdfjs-dist` | PDF 렌더링/페이지 처리 | `Apache-2.0` |
| `jszip` | ZIP 생성 | `MIT OR GPL-3.0-or-later` |
| `react` | UI 프레임워크 | `MIT` |
| `react-dom` | React DOM 렌더링 | `MIT` |
| `zustand` | 앱 상태 관리 | `MIT` |

### 개발/테스트 의존성

| 라이브러리 | 용도 | 라이선스 |
| --- | --- | --- |
| `vite` | 번들링/개발 서버 | `MIT` |
| `@vitejs/plugin-react` | Vite React 플러그인 | `MIT` |
| `typescript` | 타입스크립트 컴파일 | `Apache-2.0` |
| `vitest` | 단위 테스트 | `MIT` |
| `@testing-library/react` | React 컴포넌트 테스트 | `MIT` |
| `@testing-library/jest-dom` | DOM 매처 확장 | `MIT` |
| `jsdom` | 테스트용 DOM 환경 | `MIT` |
| `@playwright/test` | E2E 테스트 | `Apache-2.0` |
| `@types/node` | Node 타입 정의 | `MIT` |
| `@types/react` | React 타입 정의 | `MIT` |
| `@types/react-dom` | React DOM 타입 정의 | `MIT` |

## 라이선스 고지 📝

- 서드파티 고지 파일: `docs/licenses/THIRD_PARTY_NOTICES.md`
- 프로젝트 내 라이선스 표기는 패키지 메타데이터와 고지 문서를 기준으로 관리합니다.
