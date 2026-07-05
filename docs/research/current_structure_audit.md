# Bindery 현재 구조 감사 (2026-07-05)

> **적용 노트 (2026-07-05)**: 이 감사는 레거시 저장소(~/HermesWorkspace/project/Bindery)를 대상으로 한다.
> 감사 후 사용자 결정에 따라 제품은 /Users/tofu/Bindery에 **신규 구축**되었고, 레거시는 수정 없이
> 패턴 흡수원으로만 쓰였다. §5의 유지/재배치/추상화/신규 구분은 신규 구축의 설계 입력이 되었다
> (구현 결과: docs/implementation/decisions.md D1~D12).


AI 장기 소설 집필 하네스 심화 작업 전에 저장소 전체(코드·문서·파이프라인·UI)를 감사한 결과다.
기준 커밋: `36e3b4e feat(pipeline): foreground AI pipeline as top-level workbench` (branch `feat/ai-mission-control`).
작업 트리에는 이전 세션의 설정 서피스 개편(`SettingsSurface.svelte` 등) 미커밋 변경이 있다.

관련 설계 참조: `/Users/tofu/Bindery/novel_harness_final_package` (동일 지시문의 선행 설계 패키지 — 스키마·프롬프트 블루프린트·starter 구조). 본 작업에서 이 패키지를 저장소로 흡수한다.

---

## 1. 저장소 지형

```text
apps/desktop            SvelteKit(static) + Tauri v2 데스크톱 앱 (제품 본체)
  src/lib/domain        순수 로직: planning, outline, agentEnvelopes, sourceIntake, styleSystem, diff, prompt, guidance …
  src/lib/actions       파이프라인/프로젝트 액션 레이어 (UI와 store 사이의 유일한 실행 경로)
  src/lib/stores        Svelte store: run/artifact/candidate/qa/outline/episodeProgress 등 25개
  src/lib/components    layout / pipeline / candidates / qa / style / plot / codex / editor …
  src-tauri/src         Rust command: 파일 IO(project-root 앵커), agent CLI 실행, snapshot, style
packages/novelctl-core  Python CLI(novelctl) — style 서브커맨드, SQLite 마이그레이션
packages/shared         공용 TS 타입
sample-project          로컬 테스트용 프로젝트
docs/                   운영/설계 문서 30여 개 (flat)
design_v0.2             과거 설계 패키지
```

## 2. 현재 AI 파이프라인 (구현 상태)

회차 단위 9단계: `episode-brief → scene-plan → context → draft → analyze → qa → revise → summarize → commit`
그 위에 작품 단위 `outline`(바이블→N화 아웃라인 제안→회차별 승인→플롯 보드 병합)이 있다.

| 단계 | 실행 방식 | 산출물 | 상태 |
|---|---|---|---|
| outline | Hybrid(agent→local) | `plot/episode-outline.json` + artifact | 구현·승인 흐름 있음 |
| episode-brief / scene-plan | Hybrid | `.bindery/artifacts/{ep}/…` | 구현 (승인/편집 UI 없음) |
| context | Static | 컨텍스트 팩 artifact | 구현 |
| draft | Hybrid + envelope 검증 + repair 1회 | 후보 A–D (원본 비파괴) | 구현 |
| analyze | Static | 표현 분석 | 구현 |
| qa | Hybrid + QAReportEnvelope + repair | QA 보고서(다게이트) | 구현 |
| revise | Hybrid | 수정 계획 체크리스트 | 구현 |
| summarize | Hybrid | `canon/summaries/{ep}.md` | 구현 (canon delta 제안 없음) |
| commit | Static | snapshot + `.bindery/episodes.json` 픽스 | 구현 (resume state 없음) |

지원 인프라: run 영속화(`.bindery/runs/{runId}/run.json`), artifact 영속화(`.bindery/artifacts/`), snapshot-before-apply, hunk 단위 적용, CandidateReviewSession(baseline hash), QATarget, 스타일 시스템(PromptCapsule/StyleMatchScore), source intake(통합 문서→프로젝트 부트스트랩, DOCX 포함).

## 3. 이미 구현 vs 스캐폴드/mock

구현되어 실제로 도는 것:
- Codex CLI 기본 어댑터(`run_agent_text`), provider/model 오버라이드, stdout/file 출력 모드, timeout
- candidate diff/apply(전체·hunk)와 사전 snapshot
- envelope 스키마 검증 + repair 1회 + 폴백 경로의 정직한 표시(`agent/fallback/static` 배지)
- 브라우저 mock 모드(백엔드 없이 UI 흐름 재현)

스캐폴드/부재:
- **소재 발굴(ideas) 단계 자체가 없음** — 파이프라인이 "이미 소재/바이블이 있는 상태"에서 시작
- **세계관 확장 proposal 없음** — source intake가 1회성 분해를 하지만 승인 없이 파일을 씀
- **정사(canon) 변경 proposal/승인 없음** — summarize가 요약만 쓰고, 설정 변화는 사람이 수동 반영
- **resume state 없음** — 다음 회차 시작 시 필요한 상태(열린 떡밥/인물 상태/플롯 위치/보류 결정)가 산재
- **프롬프트가 TS 문자열에 내장** — 미리보기는 되지만 관리 가능한 blueprint 파일이 아님
- **웹 AI 교환(packet export/import) 없음**
- planning artifact(브리프/장면계획) 명시적 승인·편집 UI 없음 (docs/TASKS.md에 후속 과제로 기록됨)

## 4. 장기 집필 시 흐름이 끊기는 지점

1. 신규 작품 시작: 소재→세계관→바이블 단계가 없어 "빈 바이블 템플릿"에서 수동으로 출발한다.
2. 회차 픽스 후: 요약은 남지만 인물 상태·관계·떡밥 변화가 canon으로 환류되지 않아, 회차가 쌓일수록 사람이 수동 동기화해야 한다.
3. 다음 회차 재개: previousSummary/previousManuscriptTail은 있으나 "보류 중 결정·플롯 위치"를 모아 주는 단일 재개 지점이 없다.
4. AI가 만든 설정 변화(canon_delta_candidates가 draft envelope에 이미 존재)가 UI 어디에도 노출되지 않고 버려진다.

## 5. 처분 구분

### 유지 (그대로 두거나 흡수처로 사용)
- 액션 레이어 패턴(`actions/pipeline.ts`) — 모든 실행이 한 경로로 수렴, UI는 호출만
- domain 모듈 패턴(순수 함수: prompt/parse/localFallback/renderArtifact) — outline.ts, planning.ts가 표본
- artifact/run/snapshot/episodeProgress 영속화와 `.bindery/` 레이아웃
- envelope 검증 + repair + 폴백 정직 표시
- Rust project-root 앵커 파일 API와 path resolver
- 스타일 시스템 전체(로컬 분석 우선 + AI 해석 보조)
- DESIGN.md 토큰 계약과 anti-slop 규칙

### 재배치
- `PLANNING_SOURCE_PATHS` 하드코딩 목록 → resume state 포함으로 확장 (문자열 나열 유지는 허용, 단일 정의 유지)
- draft envelope의 `canon_delta_candidates` → 버려지지 않고 proposal 레이어로 환류
- summarize 단계 → 요약 + CanonDeltaProposal 생성의 2산출 단계로 확장

### 추상화
- 프롬프트: TS 내장 문자열 → `src/lib/prompts/*.prompt.md` blueprint(?raw import + 변수 치환). 신규 단계(소재/세계관/정사 delta)부터 적용하고 기존 단계는 로드맵에 따라 이관
- 승인 흐름: outline 승인(전용 코드)과 앞으로 늘어날 proposal 승인(세계관/정사)을 공용 proposal 모델(`.bindery/proposals/`)로 일반화

### 신규 설계
- ideas 흐름: `ideas/{inbox,seeds,selected,discarded}/` + IdeaSeed 스키마 + 보드 UI
- WorldExpansionProposal: 채택 소재→자산(인물/장소/기관/규칙) 제안→승인분만 canon/world/characters 파일로
- CanonDeltaProposal + 승인 UI: 픽스 전후 정사 변경을 사람이 골라 반영
- `status/resume-state.md`: 다음 회차 시작 상태의 단일 문서 (commit 단계가 재생성)
- 웹 AI 교환 packet: `.bindery/exchange/` export + 결과 붙여넣기 import + 스키마 검증
- Rust `move_file` command: ideas 상태 전이(폴더 이동)용 최소 파일 이동

## 6. 문서화된 향후 과제와의 정합

`docs/TASKS.md`의 "아키텍처 리뷰 후속" 항목(MemoryWriteProposal 승인 UI, `.bindery/memory` 인덱스, planning artifact 승인 UI)은 본 작업의 proposal 레이어와 같은 방향이다. 본 작업은 그중 proposal 승인 구조와 resume state를 먼저 구현하고, memory 인덱스 분리는 roadmap으로 남긴다.
