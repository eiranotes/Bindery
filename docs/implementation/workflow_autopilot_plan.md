# workflow/autopilot 구현 계획 및 결과

작성: 2026-07-05 · 상태: 구현 완료 (tests/autopilot.test.ts로 고정)

## 목표

내부 stage를 삭제·중복 구현하지 않고, 그 위에 상태 계산(workflow)과 묶음 실행(autopilot)
레이어를 얹어 "최소 입력 · 자동 중간 처리 · 최종 선택" UX를 만든다.

## 사용자 액션 모델

```ts
type UserAction =
  | 'startProject' | 'prepareStoryFoundation'
  | 'writeNextEpisode' | 'regenerateCandidates'
  | 'applyCandidate' | 'reviseCurrentDraft' | 'applyRevision'
  | 'closeEpisode' | 'reviewPendingChanges' | 'directEdit' | 'openAdvancedDetails';
```

기존 세부 버튼(브리프 생성/승인, 장면 계획 생성/승인, QA 3종, 수정 계획/후보, 요약,
정사 제안, 픽스 등)은 이 액션들 뒤로 접혔다. 설계자 모드(EpisodeSurface 등)에는 그대로 남아 있다.

## 실행 단위와 stage 매핑

| autopilot | 내부 stage 재사용 | hard commit 여부 |
|---|---|---|
| `runProjectStarterAutopilot(userNote?)` | idea-discovery(1) | 없음 (후보 카드만) |
| `adoptStarterIdea(idea)` | world-expansion → applyProposal → bible-assembly → applyBibleCandidate → plot-plan | 사용자의 카드 선택이 승인 지점. 바이블은 AI 조립본 또는 승인 자산 기반 로컬 조립본을 먼저 적용한 뒤 plot row를 draft로 만든다 |
| `ensureStoryFoundation({episode})` | bible-assembly → applyBibleCandidate → plot-plan | **hard** — 라이트모드의 [바이블과 플롯 준비하고 쓰기] 명시 버튼. 바이블이 없거나 현재 회차 plot row가 없을 때만 먼저 실행 |
| `runEpisodeAutopilot({episode, userNote?, candidateCount?})` | episode-brief → scene-plan → draft-candidate ×1(기본) | 없음 — 후보 파일만. 브리프·장면 계획은 autopilot 자동 승인(soft), 설계자 모드는 수를 늘릴 수 있음 |
| `applyCandidateToManuscript(candidate)` | applyToManuscript(스냅샷) | **hard** — 버튼 전용 |
| `runRevisionAutopilot({episode})` | qa-style + qa-continuity + qa-canon → revision-plan | 없음 — 체크리스트 반환 |
| `buildRevisionCandidate(plan)` + 적용 | revision-candidate → applyToManuscript | **hard** — [체크한 수정 적용] |
| `runCloseEpisodeAutopilot(episode)` | summary → canon-delta proposal | 없음 — 마감 카드 반환 |
| `finalizeCloseEpisode(card, checks)` | applyProposal(체크 항목만) → fixEpisode → resume state | **hard** — [반영하고 마감] |

## 상태 → 다음 행동 (workflow)

`loadWorkflowSnapshot`이 읽는 것: 바이블 실질 내용 여부(hasSubstance), 플롯 존재,
대상 회차 plot row 존재, 채택 자산/소재 수, 회차 목록/진행 상태, 대상 회차의 원고·요약·후보,
보류 proposal 수.

`computeNextStep` 우선순위:

1. 아무것도 없음(바이블·플롯·진행·원고·후보·자산·채택 소재 전부 없음) → `startProject`
2. 바이블 없음 또는 대상 회차 plot row 없음 → `prepareStoryFoundation`
3. 원고 없음 + 초안 후보 있음 → `applyCandidate` ("후보 보기")
4. 원고 없음 → `writeNextEpisode` ("이번 화 쓰기")
5. 원고 있음 + 요약 없음 → `reviseCurrentDraft` (보조: 마감)
6. 요약 있음 → `closeEpisode`

보류함(pendingProposals)은 메인 CTA와 경쟁하지 않고 항상 보조 카드로 병기한다.

## 테스트

`tests/autopilot.test.ts` (memory 브리지 + 스크립트 에이전트):

- 무입력 `runEpisodeAutopilot` → 기준 누락 시 차단, 준비 후 설계 자동 승인(approvedBy: autopilot) + 집필안 1개 + 원고 불변
- workflow 상태 전이: startProject → prepareStoryFoundation → writeNextEpisode → applyCandidate → reviseCurrentDraft → closeEpisode → writeNextEpisode(ep002)
- 원고가 이미 있어도 기준 바이블/대상 회차 플롯이 빠져 있으면 검토·마감보다 `prepareStoryFoundation`을 먼저 요구
- QA 3종 병렬 실행 + 모든 run/usage 기록 보존 + 수정 제안 기본 체크
- 마감: high 리스크 기본 해제, 체크 항목만 canon 반영, 해제 항목 보류함 잔류, 픽스+재개 상태 갱신
- 오프라인: 뼈대 후보 1개로 정직하게 멈춤, 자동 확정 없음
- 기획 채택 및 라이트모드 준비: 코드펜스 바이블 출력도 적용, AI 바이블 조립 실패 시 로컬 바이블을 적용하고 그 바이블이 플롯 입력으로 들어감
