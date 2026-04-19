# PDFWizard 🧙‍♂️📄

브라우저에서 동작하는 로컬 PDF 작업 도구입니다.  
React UI + Web Worker + WASM(PDFium) + PDF.js 조합으로 PDF 편집/변환 작업을 처리합니다.

## 주요 기능 ✨

- `PDF 합치기`(merge)
- `PDF 분할`(split, 범위/그룹 기반)
- `이미지 추출`(원본 유지 + 강제 PNG/JPG 변환 옵션)
- `페이지 → 이미지` 변환(PNG/JPG)
- 진행 상태/요약(`success`, `converted`, `failed`) 표시
- 결과 파일 다운로드(단일 파일 또는 ZIP)

## 동작 방식 🔧

- `PDFium (@embedpdf/pdfium)`: 합치기, 분할, 원본 이미지 추출
- `PDF.js (pdfjs-dist)`: 페이지 렌더링, 페이지→이미지 변환
- `Web Worker`: 메인 스레드 블로킹 최소화
- `JSZip`: 다중 결과 ZIP 패키징

## 빠른 시작 🚀

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

## 사용 방법 🧭

1. 앱을 실행한 뒤 `파일 선택` 버튼으로 PDF를 업로드합니다.
2. 상단 단계(`업로드 → 작업 → 내보내기`)에 따라 진행합니다.
3. 작업 탭에서 원하는 작업을 선택합니다.
   - `합치기`
   - `분할`
   - `이미지 추출`
   - `페이지→이미지`
4. 필요 시 옵션을 설정합니다.
   - `원본 유지`
   - `강제 PNG/JPG 변환`
5. `작업 실행`을 누르고 진행 상태를 확인합니다.
6. 완료 후 `결과 다운로드`로 산출물을 받습니다.
   - 결과가 1개면 단일 파일 다운로드
   - 결과가 여러 개면 ZIP 다운로드

## 작업 타입별 출력 📦

| 작업 타입 | 입력 | 출력 |
| --- | --- | --- |
| `merge` | PDF 여러 개 | 병합된 PDF 1개 |
| `split` | PDF 1개 + 범위 | 분할된 PDF 여러 개 |
| `extract-images` | PDF 1개 | 추출 이미지(원본/변환 정책 반영) + `report.json` |
| `pages-to-images` | PDF 1개 | 페이지별 이미지(PNG/JPG) |

## 사용 라이브러리 및 라이선스 📚

아래는 현재 `package.json`의 직접 의존성 기준입니다.

### 런타임 의존성

| 라이브러리 | 용도 | 라이선스 |
| --- | --- | --- |
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
