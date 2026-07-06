# state.md — 현재 인수인계 상태

## 2026-07-06 프로젝트 선택 복귀 UX

- 상단바의 현재 작품 옆에 [작품 선택] 버튼을 추가했다. 열린 작품에서 시작 화면(ProjectPicker)으로
  돌아가 최근 작품/폴더 열기/새 작품 생성 흐름을 다시 사용할 수 있다.
- `returnToProjectPicker()`는 프로젝트별 UI 캐시, run 선택, 후보/제안/트리 상태를 초기화하고
  최근 작품 목록은 보존한다. AI/파일 작업이 실행 중일 때는 복귀를 막고 안내 토스트를 띄운다.
- 같은 프로젝트 안에서 새로 쓰는 진입점도 추가했다. 홈 보조 액션 [같은 작품에서 epXXX 처음부터 쓰기]는
  필요한 회차 스캐폴드와 바이블/플롯 row를 준비한 뒤 초안 후보 생성으로 보낸다. 이미 원고가 있는
  집필 화면에는 [처음부터 새 후보 만들기]를 노출해 현재 원고를 보존한 채 설계와 후보만 다시 만든다.
- 검증: `npm run check` 0 오류 · `npm test` 28/28 · `npm run build` OK(기존 chunk-size warning 유지) ·
  브라우저 클릭스루 390/768/1280px PASS.
  증거: `.superloopy/evidence/frontend/2026-07-06T10-27-32-236Z-project-switch-and-fresh-write/VISUAL_QA.md`.

## 2026-07-06 토큰 라우터 + 모델 티어 라우팅

- 기준: `bindery_ai_harness_final_lite_detail_design.md`. 1화 사전 토큰 절감 구조 구현:
  - `contextPack.ts` — 로컬 정적 선별(섹션 분할 + 플롯 row/요약/메모 질의어 스코어 +
    문자 예산 pruning + included/excluded manifest). AI를 쓰지 않는 1차 필터.
  - `context-distill` 스테이지 — 선별 팩이 기준(기본 3,000자)을 넘으면 경량 티어가
    집필 캡슐로 압축. 산출: `.bindery/artifacts/<ep>/context-{capsule.md,pack.json}`.
  - 브리프=선별 팩, 초안 후보=정제 캡슐이 기존 `{{bible}}` 슬롯을 대체.
  - 모델 티어: settings `profiles{light,heavy}` + `stageTiers`(5그룹) →
    `Ctx.agentFor(stage)`로 러너가 스테이지별 CLI/모델 선택. 설정 UI에 라우팅/예산 섹션.
  - 집필 "생성 근거 보기"에 팩 manifest(포함/제외/사유/압축률) 표시.
- 검증: check 0오류 · test 28/28 · build OK · 설정/근거 UI 클릭스루. 상세 log.md.
- 남은 후보: FTS/벡터 검색 계층, branch/lineage, 그래프 스튜디오 (스코어러 교체 지점 분리됨).

## 2026-07-06 컨셉 정의서 반영 패스

- 기준: `bindery_ai_harness_concept_direction.md`. 엔진 변경 없음, Lite 표면 보강:
  - Context Pack 투명성 — 집필 화면에 "참고: … / 비어 있어 추정: …" 한 줄 +
    "생성 근거 보기"에 자료별 투입 방식/경로 목록 (`context.ts`의 `sources`).
  - 검토 결과에 QA 3관점 verdict 칩(통과/주의/수정 필요) 요약.
  - 시작 블록 soft-gap 프리플라이트(작품노트 채우기 vs AI 추정 진행), 원고 [이전본 복원].
  - 초안 후보·기획 후보를 세로 카드에서 전폭 행 리스트로, 원고 리더 66vh로 확대.
  - 시작 화면: 열기/생성 상태 분리, 열기 15초 타임아웃+권한 안내.
- 검증: check 0오류 · test 21/21 · build OK · dev 클릭스루(라이트/다크, 1280/375). 상세는 log.md.
- 주의: 프리뷰/자동화가 띄운 dev 서버는 macOS 권한 때문에 `~/Documents` 아래 프로젝트
  열람(`fs list`)이 매달릴 수 있다. 사용자 터미널 실행은 정상.

## 2026-07-05 신규 하네스 구축 (v0.1)

### 무엇이 있는가
- `/Users/tofu/Bindery`가 제품 저장소다 (git, main). 레거시(HermesWorkspace/project/Bindery)는
  참조로만 쓰였고 이번 작업의 수정 없이 원상태다.
- 스택: Vite 6 + Svelte 5 + TS + Tauri v2. `npm run dev`(포트 5199)가 dev 브리지(파일/CLI)를 포함한
  완전한 로컬 런타임이고, `npm run tauri:build -- --bundles app`이 macOS `Bindery.app`을 만든다.
- 제품 루프 전체 구현: 소재(폴더 상태 보드) → 세계관 proposal → 승인 → 자산 파일 → 바이블
  후보/교체 → 플롯 제안/표 편집/회차 승인 → 브리프 → 장면 → 초안 후보 → diff hunk 적용
  (스냅샷) → 3관점 QA → 수정 계획(수용/기각) → 수정 후보 → 요약 → 정사 delta proposal →
  항목 승인/반영 → 픽스 → resume state → 다음 회차.
- 프롬프트 blueprint 16종(`prompts/`), 계약 검증(`src/lib/schemas/contracts.ts` + `schemas/*.json`),
  러너 단일 경로(repair 1회 + 정직한 폴백 + trace), proposal 레지스트리, 웹 AI 교환
  (idea/world/plot/brief/scene/draft/canon-delta 왕복).
- **UI는 이원 모드다 (2026-07-05 UX-first autopilot 개편).**
  기본은 간단 모드: 상단바 + 단일 작업면(최대 2단, 사이드바 없음), 메뉴
  홈|집필|작품노트|보류함|파일|설정. 홈은 다음 작업 센터(CTA 1개 + 한 줄 메모),
  집필은 기준→설계→초안→검토·수정→마감 레일 + 상황별 블록(바이블·플롯 준비/후보 카드/수정 체크리스트/마감 카드) + 실시간
  CLI 스트리밍(LiveRunPanel) + "생성 근거 보기". 설정에서 설계자 모드로 전환하면
  기존 파이프라인 화면(소재/세계관/플롯/회차/제안·정사)과 run 도크가 열린다.
- autopilot 레이어(src/lib/harness/{context,workflow,autopilot}.ts):
  기초자료 단일 로더(누락 보고), 상태→다음 행동 계산, stage 묶음 실행.
  soft output(브리프·장면 계획)은 autopilot 자동 승인, hard commit(원고 반영·canon
  변경·픽스·기획 채택)은 사람 버튼 전용. 후보는 정석안/추진안/감정안 3개 기본.
  기획 채택은 세계관 자산을 반영한 뒤 바이블을 적용하고, 그 바이블을 읽어 플롯을 짠다.
  AI 바이블 조립이 형식 문제로 실패하면 승인 자산 기반 로컬 바이블을 적용한다.
  라이트모드도 바이블 또는 현재 회차 플롯 row가 비어 있으면 집필을 막고
  [바이블과 플롯 준비하고 쓰기]를 먼저 실행한다.

### 검증 상태
- `npm test` 21/21 (검증 시나리오 §11 E2E 12건 + autopilot/workflow/바이블 체인 9건)
- `npm run check` 0 오류, `npm run build` OK
- 실 CLI 클릭스루(2차): gemini-3.5-flash로 홈→[이번 화 쓰기]→설계·장면·후보 3개
  전 과정 실시간 스트리밍 확인 (sandbox-projects/브리지 검증)
- `cargo check` OK, `npm run tauri:build -- --bundles app` OK
  (`src-tauri/target/release/bundle/macos/Bindery.app` 생성)
- dev 브리지 실검증: fs 왕복/경로 탈출 거부/scaffold OK
- 실 CLI: **claude OK** (연결 테스트 + 실제 소재 발굴 1회, 스키마 통과 65s).
  **codex는 이 머신 인증 만료**(refresh token revoked — `codex login` 필요, 앱 문제 아님).
  gemini 미검증.
- 상세: docs/implementation/acceptance_criteria.md

### 다음 인수인계 포인트
1. 패키지된 `Bindery.app`에서 실제 프로젝트 열기/CLI 실행/cancel 클릭스루 QA.
2. 브라우저에서 후속 실사용 클릭스루: `npm run dev` → 새 작품 → 소재 발굴(claude 연결) → 승인 플래그 포함 루프 1회.
3. codex를 쓰려면 `codex login` 후 설정 화면에서 프리셋 전환.
4. sandbox-projects/와 `src-tauri/target/`는 gitignore된 로컬 산출물 — 지워도 된다.
