# 수용 기준과 검증 결과 (최신 갱신 2026-07-10)

지시서 §11 검증 시나리오의 각 단계별 구현·검증 상태. "자동"은 `npm test`의
`tests/scenario.e2e.test.ts`(memory 브리지 + 스크립트 에이전트)로 매 실행 검증됨을 뜻한다.

## 2026-07-10 UI/CTA/성능 수용 결과

- 메달리온 resume가 `Episode 15`를 가리킬 때 홈의 주 동작은 `ep015 이어쓰기`, 보조 동작은
  `같은 설정으로 ep001부터 다시 쓰기`로 분리된다. 재시작은 기존 설정·플롯·원고를 삭제하지 않고
  resume만 snapshot 후 ep001로 갱신한다.
- 구조화 ZIP도 가져오기 전에 원본 resume 이어쓰기와 ep001 재시작을 선택하며, 플롯의 최장 20화를
  기본 8화로 줄이지 않고 보존한다.
- dev 브리지의 실제 agy 대화형 `/usage` 조회에서 모델 그룹별 5시간·주간 잔여율을 파싱했다.
  agy 선택 시 홈·상단바·설정은 실제 잔여 한도를 사용하며 추정 USD를 표시하지 않는다.
- 새 standalone Tauri 번들에서도 `/usage` 조회가 완료되어 캐시 시각이 갱신됐고, strict codesign과
  `/Applications/Bindery.app` 교체·실행을 확인했다.
- `npm run qa:ui-contract`: 22 Svelte 파일, button 178개, onclick 177개, form submit 1개,
  연결 없는 CTA 0개.
- dev 런타임: 간단/설계자 13화면 모두 진입, 현재 샘플 본문 CTA 86개, 이름 없는 버튼 0,
  콘솔 오류 0.
- 390/768/1280px: 13화면 전체 문서/작업면 수평 overflow 0.
- 초기 production JS: 883.40kB → 240.82kB. 지연 로드 청크는 모두 205kB 이하, 500kB warning 제거.
- agy 직접 호출: `gemini-3.5-flash`, exit 0, 8.46초, 지정 JSON 정확히 반환.
- 앱 내 Gemini CLI (agy) 연결 테스트: exit 0, 7.525초, `BINDERY-OK`.
- 최종 `/Applications/Bindery.app` 연결 테스트: exit 0, 9.394초, `BINDERY-OK`.
- standalone 클릭스루: 시작 화면 → 로컬 프로젝트 → 홈 → 설정 통과, strict codesign 통과.
- 패키지 프로젝트 열기 병목: 동기 `fs_op`를 async `spawn_blocking`으로 격리. 지연 프로젝트에서도
  UI 반응 유지, 15초 제한 뒤 시작 화면 복귀.
- 상세 증거: `docs/UI_CTA_PERFORMANCE_REVIEW_20260710.md` 및
  `.superloopy/evidence/frontend/20260710-bindery-workbench-overhaul/`.

| # | 시나리오 단계 | 상태 | 검증 방법 |
|---|---|---|---|
| 1 | 새 작품 생성 | 구현 | 자동 (createProject → 스켈레톤 파일) + dev 브리지 scaffold curl 검증 |
| 2 | 소재 후보 생성 | 구현 | 자동 + **실 CLI 검증**: blueprint→Claude CLI→스키마 통과 (65s, 후보 2건) |
| 3 | 소재 채택 | 구현 | 자동 (폴더 이동, listIdeas 상태 반영) + 브리지 move 왕복 curl 검증 |
| 4 | 세계관 확장 proposal | 구현 | 자동 (승인 전 파일 미생성 단언 포함) |
| 5 | 바이블/자산 파일 생성 | 구현 | 자동 (거부 자산 미생성, 승인 자산 생성, 바이블 후보→스냅샷→교체) |
| 6 | 플롯 구성 | 구현 | 자동 (제안→ep001만 승인→ep002는 draft 유지) |
| 7 | ep001 브리프 | 구현 | 자동 (plot row+resume 입력, 파일 존재, 승인 전 draft 상태 단언) |
| 8 | 장면 계획 | 구현 | 자동 (브리프 승인 전 거부 → 승인 후 2장면 생성, 승인 전 draft 상태 단언) |
| 9 | 초안 후보 | 구현 | 자동 (장면 계획 승인 전 거부 → 승인 후 후보 생성, 원고 비덮어쓰기 단언) |
| 10 | 후보 diff 확인 | 구현 | 자동 (hunk 생성) + 단위 테스트 (hunk 선택 적용) |
| 11 | QA 실행 | 구현 | 자동 (continuity 관점, warn 판정·근거 인용) — UI에서 3관점 선택 실행 |
| 12 | 수정 후보 생성 | 구현 | 자동 (수용 항목만 반영) |
| 13 | 일부 적용 | 구현 | 자동 (hunk 1개만 적용 → '얼음장' 반영 단언, 스냅샷 존재 단언) |
| 14 | 요약 생성 | 구현 | 자동 (canon/summaries/ep001.md) |
| 15 | 정사 변경 proposal 확인 | 구현 | 자동 (승인 전 canon 미반영 → 승인 후 characters/·open-threads 반영) |
| 16 | 다음 회차 resume state | 구현 | 자동 (다음 회차 ep002, 인물 상태, 보류 결정 포함 단언) |

## 추가 검증 (실환경, dev 브리지)

| 항목 | 결과 |
|---|---|
| `/__bridge/env` | OK |
| fs write/move/read 왕복 | OK (sandbox-projects/브리지 검증) |
| 경로 탈출(`../../package.json`) | 거부 확인 |
| codex CLI | 실패 — 이 머신의 codex 인증 만료(refresh token revoked). 앱은 exit 1 + stderr를 정직하게 기록 |
| claude CLI 연결 테스트 | OK (BINDERY-OK, exit 0, 10.8s) |
| 실제 소재 발굴 1회 | OK — idea_discovery blueprint → 스키마 준수 JSON 후보 2건 (65.4s) |
| agy 단일 후보 + 스트리밍 | OK — `gemini-3.5-flash`, 후보 1건, 13.7s, status 1/stdout 6/done 1 |

## 브라우저 클릭스루 (Chrome, dev 서버)

| 항목 | 결과 |
|---|---|
| 시작 화면 렌더 (다크 테마) | OK |
| 프로젝트 열기 → 셸(탭/탐색/하단 상태바) 렌더 | OK |
| 설정: Claude 프리셋 선택·저장 (.bindery/settings.json) | OK |
| 소재 발굴 인앱 실 AI 실행 | OK — 후보 2건 생성 (51.6s), busy 칩·AI 배지·trace 경로 표시 |
| 소재 채택 클릭 → 디스크 폴더 이동 | OK — ideas/inbox → ideas/selected 실파일 이동, 사이드바 카운트 갱신 |
| run 기록 파일 | OK — .bindery/runs/{runId}.json + index.json |
| 콘솔 오류 | 0건 |

## 빌드·정적 검증

- `npx vitest run tests/backup.test.ts tests/exportManuscript.test.ts` —
  14/14 통과 (DOCX, 백업 preview/복원/rollback).
- `npx vitest run tests/projectChanges.test.ts` — 3/3 통과
  (추적 대상 필터, tree flatten, created/modified/deleted digest diff).
- `npx vitest run tests/sourceUploads.test.ts tests/sourcePackage.test.ts` — 8/8 통과
  (`DecompressionStream` 없는 macOS WebView형 fallback, 진행률/취소/500엔트리 제한, 구조화 기획 가져오기).
- `npm test` — 77/77 통과 (코어 단위 + 시나리오 E2E + 자료 업로드/구조화 zip + 실제 agy 사용량 파싱 + 사용량/문체/백업/품질/외부변경).
- `cargo test --manifest-path src-tauri/Cargo.toml` — 3/3 통과
  (`run_agent_stream` stdout event와 최종 결과 일치, Finder PATH 보강, 파일 경로 가드/텍스트 왕복).
- `npm run check` — svelte-check 0 errors / 0 warnings.
- `npm run build` — OK. 초기 JS 234.06kB, chunk-size warning 없음.
- `npm run tauri:build:mac:standalone` — OK. macOS `Bindery.app` 번들 생성 및 ad-hoc 서명 OK:
  `src-tauri/target/release/bundle/macos/Bindery.app`.
- `codesign --verify --deep --strict --verbose=2 src-tauri/target/release/bundle/macos/Bindery.app` —
  `valid on disk`, Designated Requirement 충족.
- 프로젝트 열기 성능 패치 — `openProjectByPath`/`createProjectAt`는 초기 셸 진입 뒤
  `refreshAll({ deferDigest: true })`를 후행 실행. `projectChanges` focused 3/3, `cargo check` OK,
  `npm test` 67/67, standalone 재빌드·서명·launch process 확인 OK.
- 스캔 제외 확인 — Tauri/dev walker와 digest 필터가 `target`, `dist`, `build`, `.superloopy`,
  `.svelte-kit`, `.bindery` 변동성 출력, `exports`를 제외. 초기 tree-only 측정:
  `/Users/tofu/Documents/Bindery/Medallion` 22개 텍스트 파일 29ms, repo root 841개 텍스트 파일 1.2s.
- 내보내기+외부 변경 visual QA — 1280/768/390 viewport PASS, overflow 0, 버튼 겹침 0,
  외부 변경 칩 표시, export 버튼 6/6.
  증거: `.superloopy/evidence/frontend/20260707T2105-external-change-guard/VISUAL_QA.md`.

## 2026-07-05 후속 구현 확인

- 우측 고정 인스펙터 제거, 2단 레이아웃 + 하단 1줄 상태바 적용. 상태바는 설정에서 숨김 가능.
- 상단바 [작품 선택]으로 열린 작품에서 시작 화면(ProjectPicker)으로 돌아갈 수 있음. 실행 중인
  작업이 있을 때는 복귀를 막고 안내함.
- 홈 [epXXX 이어쓰기]와 [같은 설정으로 ep001부터 다시 쓰기], 집필 [처음부터 새 후보 만들기]로
  동일 프로젝트 안에서 이어쓰기·작품 재시작·새 초안 후보를 구분한다. 기존 원고는 자동으로 덮지 않음.
- 최초 [AI에게 기획 맡기기]에서 텍스트 자료 파일과 zip 묶음 자료를 업로드할 수 있음. zip은
  내부 텍스트 엔트리를 펼쳐 읽고, 별도 파일 업로드도 앱 차원의 개수 제한 없이 추가할 수 있음.
  실행 시 원문은 `notes/source-raw.md`에 저장되고, 기획 후보 생성 입력에는 제한된 자료 요약이
  함께 들어감.
- 내보내기 탭에서 Markdown/TXT/EPUB/DOCX 완성물을 만들고, 회차별 순수 텍스트를 복사할 수 있음.
- 내보내기 탭에서 프로젝트 백업 zip을 만들고, 안전한 텍스트 엔트리만 preview 후 현재 프로젝트에
  복원할 수 있음. 덮어쓰기 전 snapshot과 방금 복원 rollback이 제공됨.
- 초안/수정 후보에는 품질 상태(pass/warn/fail)와 placeholder/fallback/반복 등 좁은 회귀 이슈가 표시됨.
- dev bridge 실행은 `/__bridge/agent-stream`으로 stdout/stderr tail을 상태바에 표시하고, 실행 중 취소 요청을 보낼 수 있음.
- 브리프/장면 계획은 `bindery_approval.status`(`draft`/`approved`)를 저장하고, 초안 후보는 둘 다 approved일 때만 생성됨.
- 파일 화면에서 최근 스냅샷 복원 UI 제공. 복원 전 현재 파일도 자동 백업됨.
- 파일 화면과 회차 직접 원고 수정은 CodeMirror Markdown 에디터 사용.
- 창 포커스 복귀 시 외부 텍스트 파일 변경을 해시로 감지하고, 상단바에 변경 건수를 표시함.
- 파일 화면/집필/회차 직접 저장은 열어둔 뒤 디스크 파일이 바뀌었으면 확인을 요구하고 외부 변경본을
  snapshot으로 남긴 뒤 덮어씀.
- 웹 AI 교환 UI가 idea/world 외에 plot/brief/scene/draft/canon-delta까지 확장됨.
- Tauri v2 `tauriBridge` + Rust command 어댑터(fs/scaffold/run_agent_stream/cancel_agent/pick_folder/env) 추가, macOS 앱 번들 생성 확인.

## 남은 제한 (roadmap 참조)

- 패키지된 `Bindery.app`의 빌드·서명·launch, 프로젝트 열기, 설정/agy 실제 클릭스루를 완료했다.
  Developer ID 공증·자동 업데이트와 외부 file-provider 자체의 응답 지연은 별도 배포/환경 경계다.
- QA 대상은 현재 원고만 (후보 대상 QA는 로드맵)
- CodeMirror 고급 위젯(타자기 모드, 목표/통계 위젯)은 아직 없음.

## 2026-07-05 UX-first autopilot 개편 확인

수용 기준(bindery_ux_autopilot_pipeline_plan.md §9) 대비:

- **행동 수 1~2회**: 홈 → [이번 화 쓰기] 한 번으로 설계+장면+집필안 1개까지 자동 진행.
  아이디어 단계는 실제 `agy`/gemini-3.5-flash로 후보 1개와 stream event를 확인했다.
- **중간 승인 제거**: 간단 모드 화면에 브리프/장면 계획 승인, 개별 QA, packet 복사, trace,
  raw proposal apply 버튼 없음 (설계자 모드·"생성 근거 보기"에 보존).
- **후보 수 1개 기본**: 간단 모드는 집필안 1개. 설계자 모드만 필요 시 후보 수를 늘린다.
- **무입력 실행**: userNote optional — 기초자료(loadEpisodeContext)만으로 진행.
- **Hard commit 보호**: tests/autopilot.test.ts가 원고/canon/픽스 자동 확정 없음을 고정
  (현재 파일 11/11 통과). 원고 반영·수정 적용·마감 반영은 전부 스냅샷 선행.
- **파일 기반 유지**: 후보/브리프/장면/QA/수정/요약/proposal/trace 경로 불변.
- **기초자료 강제**: draft 프롬프트에 이전 회차 요약·이전 화 끝부분·열린 떡밥 추가.
  바이블 또는 현재 회차 플롯 row가 비어 있으면 라이트모드에서 [바이블과 플롯 준비하고 쓰기]
  CTA를 먼저 내고 `runEpisodeAutopilot`도 후보 생성을 거부한다. 스타일/이전 요약 등은
  contextMissing 토스트로 안내.
- **스트리밍**: dev SSE와 패키지 Tauri Channel 모두 stdout/stderr를 LiveRunPanel에 표시한다.
  Rust는 pipe를 병렬 drain하고 비동기 command로 실행해 cancel IPC가 막히지 않는다.
- **병렬 QA**: 문체/연속성/정사 3종을 동시에 실행하고, run index와 usage 원장은 큐 저장으로
  3건 모두 보존한다(`tests/autopilot.test.ts`, 관측 동시성 3).

최신 검증: `npm run check` 0 오류 · `npm test` 77/77 · `npm run build` OK · 실제 agy 후보 1개
스트리밍 검증. 과거 홈 CTA→후보 적용→다음 action→설계자 모드 클릭스루도 유지한다.
