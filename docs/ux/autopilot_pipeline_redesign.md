# Autopilot 파이프라인 재설계 (구현 기록)

작성: 2026-07-05 · 근거 문서: `bindery_ux_autopilot_pipeline_plan.md`, `bindery_ux_autopilot_dev_prompt.txt`

## 결론

내부 stage 파이프라인(브리프→장면→초안→QA→수정→요약→정사→픽스)은 그대로 두고,
그 위에 **workflow/autopilot 레이어**와 **간단 모드 UI**를 얹었다.

```text
내부는 하네스처럼 정교하게 (기존 stage · 파일 · 스냅샷 · proposal 유지)
외부는 워드프로세서처럼 단순하게 (홈·집필·작품노트·보류함)
AI는 중간 작업 자동 처리 (soft output 자동 승인)
인간은 후보와 정사만 선택 (hard commit은 버튼으로만)
```

## 레이어 구조

| 파일 | 역할 |
|---|---|
| `src/lib/harness/context.ts` | **기초자료 로더** — 바이블·스타일·재개 상태·열린 떡밥·플롯 row·이전 회차 요약·이전 화 끝부분을 한 번에 조립. 누락 자료는 `missing`으로 보고 (실행은 막지 않되 UI가 안내) |
| `src/lib/harness/workflow.ts` | 상태 → 다음 행동 계산 (`loadWorkflowSnapshot` + `computeNextStep`). 홈 CTA의 근거 |
| `src/lib/harness/autopilot.ts` | stage 묶음 실행: `runProjectStarterAutopilot` / `runEpisodeAutopilot` / `runRevisionAutopilot` / `runCloseEpisodeAutopilot` + hard commit 함수(`applyCandidateToManuscript`, `finalizeCloseEpisode`) |

## 승인 모델

### Soft output — 자동 생성·자동 승인 (autopilot 주체 기록)

- 회차 브리프, 장면 계획 (`bindery_approval.approvedBy: 'autopilot'`)
- QA 보고서, 수정 계획, 후보 요약, 회차 요약

### Hard commit — 반드시 사람이 버튼으로 확정

- 원고 반영: `applyCandidateToManuscript` (스냅샷 선행)
- 수정 반영: 체크리스트 → 수정 후보 생성 → 적용 (스냅샷 선행)
- 정사 변경: 마감 카드 체크박스 → `finalizeCloseEpisode` (체크 항목만 반영, 해제 항목은 보류함에 잔류)
- 회차 픽스: `finalizeCloseEpisode` 내부 `fixEpisode`
- 기획 채택: 홈의 기획 후보 카드 선택 = 작품 방향 확정 (이후 세계관·바이블·플롯 자동 구성)
- 바이블 조립은 AI가 ` ```markdown ` 코드펜스로 감싸도 정상 문서로 해석한다. AI 조립이 실패하면 승인 자산에서 뽑은 로컬 바이블을 적용해 플롯/회차가 빈 템플릿을 근거로 쓰지 않게 한다.

## 후보 정책

- 기본 3개, 의미 라벨: **정석안 / 추진안 / 감정안** (`CANDIDATE_APPROACHES`)
- 라벨별 변주 지시가 draft 프롬프트의 `{{variation}}`으로 들어간다
- 추천 = 자체 점검(style_self_check) 최고점 후보
- 후보 카드 메타(요약·위험·자수·점수)는 `.bindery/candidates/<ep>/index.json`에 영속

## 기초자료 강제 점검

집필 관련 stage는 파일을 흩어 읽지 않고 `loadEpisodeContext()` 결과만 프롬프트 변수로 옮긴다.
이번 개편에서 메운 구멍:

- `draft_candidate.prompt.md`: **이전 회차 요약, 이전 화 확정 원고 끝부분, 열린 떡밥** 추가
- `episode_brief.prompt.md`: **열린 떡밥** 추가 (재개 상태가 아직 없는 첫 픽스 전에도 떡밥이 전달됨)
- 비어 있는 바이블 또는 현재 회차 플롯 row는 라이트모드의 `prepareStoryFoundation` CTA로 먼저 처리한다.
  `runEpisodeAutopilot`도 이 둘이 없으면 후보 생성을 거부한다. 스타일 지침/이전 요약 등은
  `contextMissing`으로 실행 결과에 포함되어 토스트로 안내한다.
- 작품 시작 흐름은 `세계관 자산 → 바이블 → 플롯` 순서다. 플롯은 `canon/setting-bible.md`를 읽고, 회차 브리프와 초안은 `loadEpisodeContext()`를 통해 같은 바이블과 해당 플롯 row를 함께 읽는다.

## 스트리밍

- 브리지의 SSE(`/__bridge/agent-stream`) → `runFeed` 스토어에 stdout/stderr 원문 누적
- `LiveRunPanel.svelte`가 집필/홈 화면에서 실행 전체 흐름(스테이지 경계 포함)을 실시간 표시, 자동 스크롤 + 취소
- 상태바에는 마지막 줄 tail 유지

## 수용 기준 체크

- 회차 후보까지 기본 행동 1~2회: 기준 준비가 끝난 프로젝트는 홈 → [이번 화 쓰기], 기준이 비어 있으면 홈 → [바이블과 플롯 준비하고 쓰기] ✔
- 간단 모드에서 브리프 승인·개별 QA·packet·trace 버튼 미노출 ✔ (설계자 모드/근거 보기에 보존)
- 기본 후보 3개 이하 ✔
- 무입력 실행 가능 ✔ (`userNote` optional)
- hard commit 자동 확정 금지 ✔ (`tests/autopilot.test.ts`가 회귀 방지)
- 파일 기반 유지 ✔ (모든 산출물 경로 불변)
