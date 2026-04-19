# PDFWizard PDFium+PDF.js 실연동 서브스펙

- 작성일: 2026-04-19
- 범위: MuPDF 스텁 제거 및 PDFium+PDF.js 실연동 설계
- 대상: GitHub Pages 배포형 로컬 처리 웹앱

## 1. 결정 사항 (확정)

1. 엔진 전략
- MuPDF 미사용
- 엔진 조합: PDFium(WASM) + PDF.js
- 역할 분리:
  - PDFium: 합치기, 분할, 원본 이미지 추출
  - PDF.js: 페이지 렌더(썸네일, 페이지->이미지)

2. 기능 정책
- 원본 이미지 추출 기능 유지
- 결과 포맷 정책: 원본 유지 우선 + 강제 PNG/JPG 변환 옵션 지원
- 지원 대상 인코딩 목표: JPEG, PNG, JPX, JBIG2, CCITT

3. 운영 정책
- 완전 로컬 처리(파일 외부 전송 금지)
- 성능 목표 유지: 100MB 기준 주요 작업 20초 내
- 대용량 기준 유지: 총 300MB, 2,000페이지

## 2. 아키텍처

1. UI Layer (React)
- 기존 작업흐름형 UI 유지
- 엔진 상세는 UI에서 직접 다루지 않고 Facade 경유

2. Job Orchestrator
- 작업 큐, 취소, 재시도, 청크 처리
- 작업 타입 기반 엔진 라우팅

3. PDFium Worker Adapter
- WASM 로드/초기화
- merge/split/extract-images API 제공
- 원본 유지/강제 변환 정책 집행

4. PDF.js Render Adapter
- getDocument/getPage/render 기반 렌더
- 썸네일/페이지->이미지 처리
- DPI/품질 옵션 반영

5. Artifact Pipeline
- 단일 Blob 다운로드
- 다중 산출물 ZIP 패키징
- report.json 생성(성공/변환/실패 통계)

## 3. 컴포넌트/인터페이스

1. EngineFacade
- 앱 공통 진입점
- 인터페이스:
  - merge(files, rangesByFile)
  - split(file, ranges)
  - extractImages(file, options)
  - renderPages(file, pages, options)

2. PdfiumEngine
- merge/split/extract-images 담당
- 추출 옵션:
  - preserveOriginal: boolean
  - forceOutputFormat?: 'png' | 'jpg'
  - quality?: number
- 메타:
  - sourceEncoding
  - outputEncoding
  - converted

3. PdfJsRenderEngine
- pages-to-images/thumbnail 담당
- 옵션:
  - dpi
  - quality
  - format
  - background
- 취소 토큰 지원

4. ImageExtractionPolicy
- 기본: 원본 유지
- 강제 변환 옵션 on 시 PNG/JPG 변환
- 변환 불가 항목은 실패 리포트 기록

## 4. 데이터 흐름

1. 업로드/등록
- FileRegistry에 파일 메타/바이너리 등록

2. 라우팅
- merge/split/extract-images -> PDFium Worker
- pages-to-images/thumbnail -> PDF.js 경로

3. PDFium 추출 흐름
- 이미지 객체 스캔 -> 디코드 메타 분석 -> 정책 적용 -> 결과/실패 기록

4. PDFium 병합/분할 흐름
- 범위 파싱 -> 페이지 재조합 -> 청크 단위 완료 이벤트 발행

5. PDF.js 렌더 흐름
- PDFDocumentProxy/PDFPageProxy 기반 렌더
- 썸네일 저해상도 우선, 요청 시 고해상도 재렌더

6. 내보내기
- 산출물 ZIP + report.json 다운로드

7. 취소/복구
- 청크 경계 중단
- partial_failed 또는 cancelled 상태 보존

## 5. 에러 처리 정책

1. 표준 에러 코드
- PDF_PARSE_FAILED
- UNSUPPORTED_IMAGE_ENCODING
- IMAGE_DECODE_FAILED
- IMAGE_CONVERT_FAILED
- RENDER_FAILED
- OOM_GUARD_TRIGGERED
- WORKER_CRASHED
- JOB_CANCELLED

2. 원본 추출 정책
- 이미지 단위 success/converted/failed 분류
- 일부 실패 시 전체 중단 금지(부분 성공 허용)
- 실패 항목별 page/objectId/sourceEncoding/reasonCode 기록

3. 강제 변환 정책
- JPG 변환 시 알파 손실 경고
- 변환 불가 시 자동 fallback 금지

4. 복구 정책
- Worker crash 시 1회 자동 재시작
- 마지막 완료 청크 이후부터 재개

## 6. 테스트 전략

1. 단위
- EngineFacade 라우팅
- ImageExtractionPolicy
- 에러 코드 매핑

2. 통합
- PDFium: merge/split/extract-images
- PDF.js: pages-to-images/thumbnail
- 취소/복구/부분 실패 경로

3. E2E
- 업로드 -> 작업 실행 -> 다운로드
- 원본 유지/강제 변환 비교
- report.json 검증

4. 성능/안정성
- 100MB/20초 목표 검증
- 300MB/2000페이지 스트레스 검증

5. 라이선스/컴플라이언스
- OSS 고지 화면
- LICENSE/NOTICE 포함
- 소스 접근 경로 고지 검증

## 7. 비목표 (이번 단계 제외)

1. 서버 측 PDF 처리
2. OCR/텍스트 추출 확장
3. AI 후처리 기능

## 8. 리스크 및 대응

1. 포맷별 디코더 차이
- 대응: 포맷별 실패 코드 고정 + report.json 노출

2. 브라우저 메모리 압박
- 대응: 청크 축소, 썸네일 해상도 하향, 동시 처리 제한

3. 다중 엔진 파이프라인 복잡도
- 대응: EngineFacade 단일 진입점 및 표준 이벤트 포맷 유지
