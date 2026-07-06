# Bindery AI 장기 집필 하네스 아키텍처 (2026-07-05)

## 0. 위치

- 저장소: `/Users/tofu/Bindery` (신규 구축). 레거시 참조: `~/HermesWorkspace/project/Bindery`.
- 스택: Vite 6 + Svelte 5 + TypeScript + Tauri v2 패키징 스캐폴드. 브리지 계층이 dev/memory/tauri 런타임 경계다.

## 1. 계층 (Composable architecture 원칙)

```text
UI (src/lib/ui)                 화면·상호작용만. 도메인 로직 없음
  └ stores (src/lib/stores)     화면 상태 + 새로고침 접착층
      └ harness (src/lib/harness)  도메인 로직 — 단계별 순수 서비스 (UI 무지)
          ├ runner.ts           모든 AI 실행의 단일 경로
          ├ schemas ← contracts 출력 계약 검증
          ├ prompts ← blueprint prompts/*.prompt.md 원본
          └ bridge (src/lib/bridge)  로컬 접근 인터페이스
              ├ devBridge  → server/bridge.ts (Vite 미들웨어: Node fs + CLI spawn + SSE stream/cancel)
              ├ memoryBridge (테스트·데모)
              └ tauriBridge → src-tauri Rust commands (fs/scaffold/run_agent/cancel_agent/env)
```

의존 방향은 위→아래 단방향. harness는 Svelte를 import하지 않으므로 vitest에서 그대로 돈다
(검증 시나리오 E2E가 이 성질을 사용).

## 2. 러너 — AI 실행의 단일 경로

`runStage(ctx, spec)` 하나로 모든 AI 단계가 흐른다:

```text
blueprint 렌더({{var}} 치환, 출처 주석 포함)
→ bridge.runAgent (CLI spawn, cwd=프로젝트, 프롬프트 원문은 .bindery/trace/에 저장)
→ spec.parse (contracts.ts 구조 검증)
→ 실패 시 repair 프롬프트 1회 재시도
→ 그래도 실패면 spec.fallback (정직한 로컬 뼈대 또는 null)
→ RunRecord 저장 (.bindery/runs/{runId}.json + index.json) + UI 리스너 통지
```

RunRecord에는 source(agent/fallback), promptChars/outputChars, exitCode, stderr tail,
promptFile 경로, repair 여부, 폴백 사유, 사용 command/model이 남는다 (§3.6, §6 요구).

## 3. 파일 레이아웃 (진실은 파일)

`src/lib/core/layout.ts`가 단일 정의처.

```text
project.yaml                    프로젝트 메타
ideas/{inbox,seeds,selected,discarded}/  소재 (상태 = 폴더)
canon/setting-bible.md          정사 요약층 (집필·QA 기준)
canon/summaries/{ep}.md         회차 요약
characters/ relationships/ world/{locations,institutions,systems,...}  자산 상세층
plot/plot-board.json            PlotPlan (구조 진실) + series-outline.md (사람이 읽는 렌더)
plot/open-threads.md            열린 떡밥
style/style-guide.md            스타일 지침
status/resume-state.md          재개 상태 (픽스 단계가 재생성)
story/chapters/{ep}/{brief,scene-plan,manuscript,index}.md
.bindery/
  artifacts/{scope}/…           단계 산출물 (타임스탬프본+latest)
  candidates/{ep}/…             원고 후보 (원본 비파괴)
  proposals/{id}.json           승인 대기/이력
  snapshots/…                   파괴적 쓰기 전 백업
  runs/ trace/ exchange/        실행 기록·프롬프트 원문·웹 교환
  settings.json                 실행기 설정
```

앱 상태는 어디에도 source of truth가 아니다. 스토어는 전부 파일에서 hydrate된다.

## 4. 단계 그래프와 산출물 연결

```text
소재 발굴(IdeaSeed batch) ──사람: 폴더 이동──▶ selected
  └▶ 세계관 확장(WorldExpansionProposal) ──사람: 항목 승인──▶ 자산 파일
        └▶ 바이블 조립(md 후보) ──사람: 적용──▶ canon/setting-bible.md
              └▶ 플롯 설계(PlotPlan) ──사람: 회차 승인──▶ plot-board
                    └▶ 회차 브리프(EpisodeBrief) → 장면 계획(ScenePlan)
                          └▶ 초안 후보(DraftCandidate×N) ──사람: diff/hunk──▶ manuscript
                                ├▶ QA ×3관점(QAReport) → 수정 계획(RevisionPlan, 사람 수용/기각)
                                │     └▶ 수정 후보 ──diff──▶ manuscript
                                └▶ 요약(md) → 정사 변경(CanonDeltaProposal)
                                      ──사람: 항목 승인──▶ canon 파일 patch
                                            └▶ 픽스 → resume-state 재생성 → 다음 회차 브리프 입력
```

각 화살표의 산출물은 파일이고, `──사람──▶` 화살표가 승인 관문이다 (AI candidate-first + Human review).

## 5. 승인(proposal) 모델

- `Proposal = WorldExpansionRecord | CanonDeltaRecord`, 항목별 decisions(approved/rejected/pending).
- `applyProposal`만 canon 파일을 쓴다. 반영 규칙:
  - 세계관 자산: kind→디렉터리 매핑으로 새 파일 생성 (기존 파일은 스냅샷 후 교체).
  - 정사 변경: 기존 파일에 proposal 표식 주석과 함께 **append** (파괴적 병합 금지, 같은 proposal 재적용 방지 마커). 사람이 나중에 파일을 정리하는 것을 전제로 한 안전 병합.
- 대상 경로는 `canon|characters|relationships|world|plot|status/` 아래로 제한 (파서에서 강제).

## 6. AI 연결

- CLI 프로필: command + argsTemplate(모델 유/무 2벌) + outputMode(stdout|file) + timeout.
  프리셋: codex/claude/gemini/custom. `{prompt} {model} {promptFile} {outputFile}` 치환.
- 실행 trace: stdout/stderr/exit/duration + 프롬프트 원문 파일. timeout·spawn 오류도 기록.
- 웹 AI 교환: packet export(.bindery/exchange/{id}/packet.md + manifest) → 사용자가 웹 AI 실행 →
  응답 붙여넣기 → 동일 파서로 검증 → 정식 artifact/proposal 등록(source=web-import).
  현재 idea-discovery·world-expansion·plot-plan·episode-brief·scene-plan·draft-candidate·canon-delta 왕복이 UI에 연결됨.
- 오프라인 모드: 모든 단계가 로컬 뼈대로 동작하되, 수정 후보·정사 변경처럼 "지어내면 위험한"
  단계는 뼈대를 만들지 않고 정직하게 거부한다.

## 7. 보안·안전 장치

- 브리지 fs: 프로젝트 루트 앵커 + 경로 탈출 거부 (검증됨).
- 파괴적 쓰기 전 스냅샷(.bindery/snapshots) — 후보 적용, 바이블 교체, proposal 반영, 픽스.
- 스냅샷 복원 UI는 파일 화면에서 제공하며, 복원 전에도 현재 상태를 자동 백업한다.
- 브리프/장면 계획은 파일 내부 `bindery:json`의 `bindery_approval.status`로 draft/approved를 저장한다.
  초안 생성은 둘 다 approved일 때만 통과한다.
- CanonDelta target_path 화이트리스트 + `..` 거부.
- QA에서 근거(evidence) 없는 fail은 warn으로 강등 — 추정으로 실패 처리하지 않는다.

## 8. 검증

- `npm test` — 코어 단위 + 검증 시나리오 E2E(지시서 §11 전체 루프, memory 브리지 + 스크립트 에이전트).
- `npm run check` — svelte-check 0 errors.
- `npm run build`, `cargo check`, `npm run tauri:build -- --bundles app` — 웹 빌드와 macOS app 번들 생성 검증.
- dev 브리지 실검증: fs 왕복·경로 탈출 거부·Claude CLI 실행(BINDERY-OK)·실제 소재 발굴 1회
  (blueprint→CLI→스키마 통과, 65s). docs/implementation/acceptance_criteria.md 참조.
