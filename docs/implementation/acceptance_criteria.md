# 수용 기준과 검증 결과 (2026-07-05)

지시서 §11 검증 시나리오의 각 단계별 구현·검증 상태. "자동"은 `npm test`의
`tests/scenario.e2e.test.ts`(memory 브리지 + 스크립트 에이전트)로 매 실행 검증됨을 뜻한다.

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

- `npx vitest run tests/sourceUploads.test.ts` — 3/3 통과
- `npm test` — 31/31 통과 (코어 단위 + 시나리오 E2E + 자료 업로드 zip)
- `npm run check` — svelte-check 0 errors / 0 warnings
- `npm run tauri:build:mac:standalone` — vite 프로덕션 빌드 OK(기존 chunk-size warning 유지) +
  macOS `Bindery.app` 번들 생성 및 ad-hoc 서명 OK:
  `src-tauri/target/release/bundle/macos/Bindery.app`
- `codesign --verify --deep --strict --verbose=2 src-tauri/target/release/bundle/macos/Bindery.app` —
  `valid on disk`, Designated Requirement 충족.

## 2026-07-05 후속 구현 확인

- 우측 고정 인스펙터 제거, 2단 레이아웃 + 하단 1줄 상태바 적용. 상태바는 설정에서 숨김 가능.
- 상단바 [작품 선택]으로 열린 작품에서 시작 화면(ProjectPicker)으로 돌아갈 수 있음. 실행 중인
  작업이 있을 때는 복귀를 막고 안내함.
- 홈 [같은 작품에서 epXXX 처음부터 쓰기]와 집필 [처음부터 새 후보 만들기]로 동일 프로젝트 안에서
  새 회차 또는 새 초안 후보를 시작할 수 있음. 기존 원고는 자동으로 덮지 않음.
- 최초 [AI에게 기획 맡기기]에서 텍스트 자료 파일과 zip 묶음 자료를 업로드할 수 있음. zip은
  내부 텍스트 엔트리를 펼쳐 읽고, 별도 파일 업로드도 앱 차원의 개수 제한 없이 추가할 수 있음.
  실행 시 원문은 `notes/source-raw.md`에 저장되고, 기획 후보 생성 입력에는 제한된 자료 요약이
  함께 들어감.
- dev bridge 실행은 `/__bridge/agent-stream`으로 stdout/stderr tail을 상태바에 표시하고, 실행 중 취소 요청을 보낼 수 있음.
- 브리프/장면 계획은 `bindery_approval.status`(`draft`/`approved`)를 저장하고, 초안 후보는 둘 다 approved일 때만 생성됨.
- 파일 화면에서 최근 스냅샷 복원 UI 제공. 복원 전 현재 파일도 자동 백업됨.
- 파일 화면과 회차 직접 원고 수정은 CodeMirror Markdown 에디터 사용.
- 웹 AI 교환 UI가 idea/world 외에 plot/brief/scene/draft/canon-delta까지 확장됨.
- Tauri v2 `tauriBridge` + Rust command 어댑터(fs/scaffold/run_agent/cancel_agent/env) 추가, macOS 앱 번들 생성 확인.

## 남은 제한 (roadmap 참조)

- 패키지된 `Bindery.app`에서 실제 프로젝트 열기/CLI 실행/cancel의 클릭스루 검증은 아직 별도 수동 QA 필요.
- QA 대상은 현재 원고만 (후보 대상 QA는 로드맵)
- CodeMirror 고급 위젯(타자기 모드, 목표/통계 위젯)은 아직 없음.

## 2026-07-05 UX-first autopilot 개편 확인

수용 기준(bindery_ux_autopilot_pipeline_plan.md §9) 대비:

- **행동 수 1~2회**: 홈 → [이번 화 쓰기] 한 번으로 설계+장면+후보 3개까지 자동 진행 —
  실 CLI(gemini-3.5-flash) 클릭스루로 확인 (설계 13.5s → 장면 20.9s → 후보 3개 57~82s/개).
- **중간 승인 제거**: 간단 모드 화면에 브리프/장면 계획 승인, 개별 QA, packet 복사, trace,
  raw proposal apply 버튼 없음 (설계자 모드·"생성 근거 보기"에 보존).
- **후보 수 3개 이하 + 의미 라벨**: 정석안/추진안/감정안, 자체 점검 점수 기반 추천 배지.
- **무입력 실행**: userNote optional — 기초자료(loadEpisodeContext)만으로 진행.
- **Hard commit 보호**: tests/autopilot.test.ts가 원고/canon/픽스 자동 확정 없음을 고정
  (17/17 통과). 원고 반영·수정 적용·마감 반영은 전부 스냅샷 선행.
- **파일 기반 유지**: 후보/브리프/장면/QA/수정/요약/proposal/trace 경로 불변.
- **기초자료 강제**: draft 프롬프트에 이전 회차 요약·이전 화 끝부분·열린 떡밥 추가.
  바이블 또는 현재 회차 플롯 row가 비어 있으면 라이트모드에서 [바이블과 플롯 준비하고 쓰기]
  CTA를 먼저 내고 `runEpisodeAutopilot`도 후보 생성을 거부한다. 스타일/이전 요약 등은
  contextMissing 토스트로 안내.
- **스트리밍**: SSE stdout 원문을 LiveRunPanel에 실시간 표시. UTF-8 청크 경계 깨짐 버그를
  `setEncoding('utf8')`로 수정하고 300KB 한글 왕복(치환문자 0)으로 검증.

검증: `npm run check` 0 오류 · `npm test` 21/21 · `npm run build` OK · 실 CLI 클릭스루
(홈 CTA→스트리밍→후보 카드→후보 적용→홈 next action 갱신→설계자 모드 전환).
