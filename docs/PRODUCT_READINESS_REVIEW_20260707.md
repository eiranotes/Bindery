# Bindery 제품화 반영 상태 점검 (2026-07-07)

작성 기준: 워크트리 `/Users/tofu/Bindery` v0.1.0 · Svelte 5 + Tauri v2 · macOS standalone.
최신 반영: 2026-07-10.

이 문서는 최초 냉정 점검에서 지적한 제품화 공백이 현재 구현에 얼마나 반영됐는지 다시
정리한 것이다. 결론부터 말하면 **P0 완결 루프는 닫혔다.** 비용 가시성, 완성물 내보내기,
CLI 실패 인과, 프로젝트 선택 복귀, zip 자료 읽기는 앱 안에서 확인 가능한 수준까지 들어왔다.
다만 **공개 유료 배포** 기준으로는 자동 업데이트, 공증/배포 채널, 장기 프로젝트 품질 검증,
네이티브 watcher/트랜잭션 같은 운영·신뢰성 작업이 남아 있다.

---

## 0. 현재 판정

| 영역 | 상태 | 근거 |
|---|---|---|
| 비용 가시성 | 구현 | `.bindery/usage.json` 원장, 모델 단가표, 월 예산 게이지, 설정 대시보드, provider `/usage` raw 표시 |
| 완성물 내보내기 | 구현 | Markdown/TXT 저장+다운로드, EPUB/DOCX 다운로드, 회차별 순수 텍스트 복사 |
| CLI 온보딩 | 구현 | 설정 연결 배너, 설치/로그인 가이드, 실패 모드 번역, fallback 후보의 "AI 아님" 표시 |
| zip 기획 자료 읽기 | 구현 | `.zip` 내부 텍스트 엔트리 읽기, stored/deflate, WebView fallback, 경로 탈출/메타 파일 차단 |
| 생성 대기 축소 | 구현 | 간단 모드 후보 1개, QA 3종 병렬 실행, 병렬 run/usage 기록 보존 |
| 패키지 스트리밍 | 구현 | Tauri Channel stdout/stderr event, 비동기 command, cancel 가능한 실행 상태 |
| 프로젝트 재선택 흐름 | 구현 | 상단바 [작품 선택]으로 ProjectPicker 복귀, 실행 중 복귀 차단, 상태 초기화 |
| 프로젝트 백업/복원 | 구현 | 진실 텍스트 파일 store-zip 백업, 복원 preview, 덮어쓰기 전 snapshot, 방금 복원 rollback |
| AI 출력 품질 회귀 | 부분 구현 | 플레이스홀더/fallback/반복/필수어 누락을 잡는 결정적 품질 게이트와 테스트. 의미 품질 골든셋은 미구현 |
| 외부 변경 감지 | 부분 구현 | 창 포커스 시 해시 비교 새로고침, 상단 외부 변경 표시, 파일/원고 저장 전 충돌 확인+snapshot. 네이티브 watcher는 미구현 |
| 배포 운영 | 미구현 | 자동 업데이트, Apple 공증, Windows 서명, 릴리스 채널 없음 |
| 대규모 RAG | 미구현 | 로컬 키워드 스코어러는 있음. 벡터 RAG/관계 그래프/100화 검증은 아직 없음 |

현재 제품 위치는 "무료 개발자향 프로토타입"에서 **local-first 작가 도구 alpha/early beta**로
올라왔다. 그러나 공개 판매는 배포 운영과 장기 신뢰성 게이트가 닫힌 뒤가 안전하다.

---

## 1. P0 반영 결과

### 1.1 비용 가시성

구현됨.

- `usage.ts`: 글자 수 기반 토큰 추정, provider/model 단가표, 월 예산, 회차/월/전체 집계.
- `runner.ts`: 실행마다 `.bindery/usage.json`에 토큰 원장 기록. fallback/offline은 비용 0.
- UI: 상단바 월 예산 게이지, 설정 사용량 대시보드, 단가 편집, `/usage` raw 조회.

한계: 실제 provider usage는 CLI가 비대화 `/usage`를 지원할 때만 숫자로 들어온다. 현재 앱은
받은 raw를 그대로 표시하고, 표준 파싱/정산은 하지 않는다.

### 1.2 완성물 내보내기

구현됨.

- `exportManuscript.ts`: 회차 원고 수집, Markdown 합본, TXT, EPUB2, DOCX 생성.
- 텍스트 산출물은 `exports/`에 저장하고 동시에 다운로드한다.
- EPUB/DOCX는 바이너리 zip이므로 브리지에 쓰지 않고 브라우저 Blob 다운로드로 내보낸다.
- 회차별 본문 복사는 마크다운 기호를 제거해 연재 플랫폼 붙여넣기용으로 제공한다.

남은 선택 항목: PDF/HWP, 표지/목차 고급 편집, 플랫폼별 업로드 규격 프리셋.

### 1.3 CLI 온보딩과 실패 인과

구현됨.

- 설정 화면은 미설정/미확인/연결됨/실패 상태를 분리한다.
- 실패 모드(`spawn-error`, `timeout`, exit code 등)를 사용자가 이해할 수 있는 원인으로 바꿔 보여준다.
- 집필 후보가 fallback이면 후보 카드 위에 "AI 아님" 경고와 설정 링크를 표시한다.

한계: 각 CLI의 실제 로그인 상태와 rate-limit는 외부 상태다. 앱은 실패를 숨기지 않고 표시하는
수준까지 책임진다.

### 1.4 프로젝트 선택 복귀

구현됨.

- 프로젝트 진입 후 상단바 [작품 선택]으로 시작 화면에 돌아갈 수 있다.
- 복귀 시 프로젝트별 UI 캐시와 선택 상태를 초기화하고 최근 프로젝트 목록은 보존한다.
- AI/파일 작업 실행 중에는 복귀를 막아 중간 상태 손상을 피한다.

### 1.5 zip 자료 읽기

구현됨.

- 최초 기획 자료 업로드는 일반 텍스트 파일과 `.zip` 내부 텍스트 엔트리를 같이 받는다.
- stored, fixed/dynamic deflate zip을 읽고, `DecompressionStream`이 없는 WebView에서는 순수 JS
  deflate fallback으로 푼다.
- 경로 탈출, `__MACOSX`, `.DS_Store`, 비텍스트 엔트리는 건너뛴다.
- 50MB/500엔트리/엔트리당 2MB/텍스트 합계 20MB 한도, 진행률과 취소를 제공한다.
- canon 설정+world/plot 구조가 있는 패키지는 snapshot 후 역할별 파일로 가져와 바이블/플롯에 연결한다.

### 1.6 생성 대기와 패키지 스트리밍

구현됨.

- 간단 모드 기획/집필 후보를 1개로 줄여 중복 초안 호출을 제거했다.
- 문체/연속성/정사 QA는 병렬 실행하고 run index/usage 저장은 큐로 보호한다.
- dev는 SSE, 패키지 앱은 Tauri Channel로 동일한 LiveRunPanel에 중간 출력을 보낸다.
- 실제 `agy`/gemini-3.5-flash로 후보 1개와 status/stdout/done event를 검증했다.

---

## 2. P1 반영 결과

### 2.1 프로젝트 백업/복원

구현됨.

- `backup.ts::buildProjectBackup`: 원고, 설정, 바이블, 문체 프리셋, 사용량 등 source-of-truth
  텍스트 파일을 store-zip으로 묶는다.
- `.bindery/runs`, `trace`, `candidates`, `snapshots`, `exchange`는 재생성 캐시로 보고 제외한다.
- `previewProjectRestore`: 백업 zip을 적용하기 전에 새 파일, 덮어쓰기, 동일 파일, 건너뛰기 수를 보여준다.
- `restoreProjectBackup`: Bindery 백업 zip의 안전한 텍스트 엔트리만 현재 프로젝트에 덮어쓴다.
- 복원 시 경로 탈출, 절대 경로, macOS 메타 파일, 캐시 폴더, 비텍스트 파일은 건너뛴다.
- 덮어쓰기 전 현재 파일은 `.bindery/snapshots`에 남기고, 새로 생긴 파일은 restore point에 기록한다.
- `rollbackProjectRestore`: 방금 복원한 변경을 되돌린다. 덮어쓴 파일은 snapshot에서 복구하고,
  새 파일은 삭제한다.

남음: 자동 주기 백업, 오래된 restore point 목록 UI, 실패 중간 상태를 완전 트랜잭션처럼 처리하는
네이티브 파일시스템 레벨 원자성.

### 2.2 AI 출력 품질 회귀

부분 구현됨.

- `quality.ts`: 후보 원고의 빈 본문, 너무 짧은 본문, placeholder, fallback 문구, 금지어,
  필수어 누락, 반복 문단을 결정적으로 점검한다.
- 초안/수정/웹-import 후보 메타데이터에 `qualityStatus`와 `qualityIssues`를 저장하고 후보 UI에 표시한다.
- `tests/quality.test.ts`: 통과 샘플, fallback/placeholder 실패, 반복/필수어 누락 warn을 고정한다.

남음: 실제 모델 산출물 골든셋, 장르별 품질 지표, 프롬프트 변경 전후 점수 추적, 장기 샘플 회귀.

### 2.3 외부 변경 감지

부분 구현됨. 2026-07-07 성능 패치로 프로젝트 열기 경로에서는 외부 변경 기준선 digest를
후행 작업으로 분리해, 홈 셸 표시가 전체 파일 해시 계산을 기다리지 않게 했다.

- 창 포커스 시 `refreshAll({ reportExternalChanges: true })`를 호출해 Finder/외부 에디터 수정 뒤 앱
  상태를 갱신한다.
- `projectChanges.ts`: source-of-truth 텍스트 파일의 해시 digest를 비교해 created/modified/deleted를
  구분한다. runs/trace/snapshots/exports 같은 변동성 출력은 추적하지 않는다.
- 초기 프로젝트 열기와 새 작품 생성은 `refreshAll({ deferDigest: true })`로 UI 데이터부터 채우고,
  digest 기준선은 백그라운드에서 계산한다. digest 읽기는 동시성 4개로 제한한다.
- Tauri/dev 파일 트리 walker는 `target`, `dist`, `build`, `.superloopy`, `.svelte-kit`,
  `.bindery` 변동성 출력, `exports`를 제외해 빌드 산출물이 작품 열기를 늦추지 않게 한다.
- 상단바에 [외부 변경 N건] 칩을 표시해 어떤 파일이 바뀌었는지 title로 확인할 수 있다.
- 파일 화면과 집필/회차 원고 직접 수정은 열어둔 뒤 디스크 쪽 파일이 바뀌었으면 저장 전 확인을
  요구한다. 덮어쓰기로 진행하면 외부 변경본을 먼저 snapshot에 남긴다.
- 실행 중에는 새로고침을 건너뛰어 작업 중 상태 경합을 줄인다.

남음: Tauri 네이티브 file watcher, diff 기반 merge UI, 다파일 실행 단위의 원자적 충돌 처리.

---

## 3. 아직 제품화 전 막히는 지점

### 3.1 배포 운영

- 자동 업데이트 없음.
- macOS는 ad-hoc 서명 번들까지 검증했지만 Apple Developer ID 공증은 없다.
- Windows 서명, Linux 패키지, 릴리스 채널, 다운로드 페이지가 없다.
- 크래시/오류 텔레메트리는 opt-in 구조가 없다.

### 3.2 장기 연재 정확도

- 현재 context pack은 섹션 분할 + 질의어 스코어러 기반이다.
- 벡터 RAG, 관계 그래프, branch/lineage, 50~100화 대규모 회귀 데이터는 없다.
- 지금 구조는 교체 지점은 분리되어 있으나 실제 검색 정확도 검증은 아직 필요하다.

### 3.3 편집 경험

- 후보 diff/hunk 적용과 CodeMirror 편집은 있다.
- 문장 단위 재생성, 선택 영역 rewrite, QA 지적 위치 점프, 인라인 코멘트는 아직 없다.

### 3.4 수익화

- BYOK 유료 앱은 기술적으로 가장 가까운 길이다.
- 관리형 크레딧은 계정, 결제, 크레딧 지갑, rate limit, 원가/마진 모니터링, 개인정보 처리방침이
  필요한 별도 백엔드 프로젝트다.

---

## 4. 우선순위 로드맵

### 완료된 P0

1. 비용 가시성.
2. Markdown/TXT/EPUB/DOCX 내보내기와 회차 복사.
3. CLI 온보딩과 실패 인과 표시.
4. 프로젝트 선택 복귀.
5. zip 기획 자료 읽기.

### 다음 P1

1. 자동 업데이트, Developer ID 공증, 배포 채널.
2. 자동 주기 백업과 restore point 목록 UI.
3. 실제 AI 산출물 골든셋과 프롬프트 회귀 리포트.
4. 네이티브 file watcher와 diff 기반 merge UI.
5. 잠금 해제된 Mac에서 패키지 UI의 프로젝트 열기, CLI 실행/cancel, 백업 복원 반복 QA.

### P2

1. 벡터 RAG/관계 그래프/branch-lineage.
2. 문장 단위 편집과 QA 위치 점프.
3. PDF/HWP/플랫폼별 발행 패키지.
4. i18n, 접근성, 선택적 클라우드/웹 sync.
5. 관리형 크레딧.

---

## 5. 최신 로컬 검증

- `npx vitest run tests/projectChanges.test.ts tests/backup.test.ts tests/exportManuscript.test.ts tests/quality.test.ts`:
  20/20 통과.
- `npm run check`: 0 errors, 0 warnings.
- `npm test`: 73/73 통과.
- `cargo test --manifest-path src-tauri/Cargo.toml`: native stream/PATH 2/2 통과.
- `npm run build`: 통과. 기존 Vite chunk-size warning만 남음.
- `npm run tauri:build:mac:standalone`: 통과.
- `codesign --verify --deep --strict --verbose=2 src-tauri/target/release/bundle/macos/Bindery.app`:
  `valid on disk`, Designated Requirement 충족.
- 새 standalone `Bindery.app` launch process 확인. 화면 캡처는 Mac 잠금으로 미완료.
- 내보내기+외부 변경 visual QA: 1280/768/390 viewport PASS, overflow 0, 버튼 겹침 0,
  외부 변경 칩 표시, export 버튼 6/6 표시.
  증거: `.superloopy/evidence/frontend/20260707T2105-external-change-guard/VISUAL_QA.md`.
