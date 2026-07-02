# 02. 구현 Phase 분해 (Phase 0 ~ Phase 10)

> 각 Phase: 목표 / 구현 태스크 / 산출물 / 완료 기준 / 테스트 / 리스크.
> 리뷰 반영: Context Pack v2·Commit journal·단일 manuscript·QA 폐루프를 MVP 축으로 끌어올림.
> **MVP 범위 = Phase 0~5** (Phase 6 이후는 v1/v1.1).

---

## Phase 0 — CLI/JSON Contract 정리

| 항목 | 내용 |
|---|---|
| **목표** | GUI가 호출할 `novelctl`의 `--json` 계약과 공통 응답/에러 스키마 확립 |
| **구현 태스크** | (1) 공통 envelope `{ok, command, data, error}` 정의 (2) `status/context/draft/qa/analyze/snapshot --json` (3) exit code 표준화(0 ok, 2 usage, 3 domain, 4 gemini-missing) (4) repetition·rhythm·mention 로컬 구현 (5) `pipeline` manifest·`manuscript.md` 규약 (6) mock mode(gemini 없이 고정 candidate 반환) |
| **산출물** | `novelctl/cli.py`, `novelctl/contracts/response.py`, `analysis/{repetition,rhythm,mention}.py`, `docs/cli-json-contract.md` |
| **완료 기준** | `novelctl status\|context 012\|draft 012\|qa 012 --all\|analyze 012\|snapshot 012 --json` 모두 envelope 반환. mock으로 gemini 없이 draft candidate 생성 |
| **테스트** | pytest: envelope 스키마 검증, exit code, mock draft, repetition 한글 토큰화 golden |
| **리스크** | Gemini CLI 출력 포맷 변동 → adapter로 감싸고 raw 로그 저장, JSON parse 실패 시 raw 반환 |

---

## Phase 1 — Tauri Shell

| 항목 | 내용 |
|---|---|
| **목표** | 프로젝트를 열고 파일 트리를 본다. path 안전 강제 |
| **구현 태스크** | (1) Tauri2+SvelteKit scaffold (2) `open_project`/`create_project`/`list_tree` (3) **path sandbox(absolute·`..`·root밖 symlink 거부)** (4) 최근 프로젝트 저장(app data) (5) 설정 저장 read/write (6) `test_gemini_cli`/`test_novelctl` env check |
| **산출물** | `src-tauri/src/commands/project.rs`, `fs/sandbox.rs`, `lib/api/commands.ts`, `ProjectLauncher.svelte` |
| **완료 기준** | 폴더 열기→트리 표시, root 밖 경로 요청 거부, 최근 프로젝트 목록 유지 |
| **테스트** | cargo: sandbox reject(absolute/`../`/symlink), pytest 무관, playwright: launcher→open→tree |
| **리스크** | 대형 프로젝트 스캔 지연 → 증분 인덱싱·백그라운드 rebuild |

---

## Phase 2 — Markdown Editor (단일 현재본)

| 항목 | 내용 |
|---|---|
| **목표** | `manuscript.md`를 편집·저장한다. 정체성 고정 |
| **구현 태스크** | (1) CodeMirror6 마운트 (2) `read_file`/`write_file`(expected_hash) (3) Source/Split/Preview (4) autosave 2s debounce + AI 실행 전 저장 (5) word count worker (6) frontmatter fold/parse (7) wiki link highlight (8) dirty state (9) snapshot 버튼 (10) **IME compositionend 규약** |
| **산출물** | `components/editor/MarkdownEditor.svelte`, `PreviewPane.svelte`, `lib/editor/extensions/{frontmatter,wikilink,wordcount}.ts`, `workers/markdownParse.worker.ts` |
| **완료 기준** | 회차 편집·저장, 한글 IME 조합 중 데코 미개입, 외부 변경 충돌 다이얼로그 |
| **테스트** | vitest: frontmatter parse, dirty; playwright: 편집→저장→dirty 해제, 한글 입력 안정 |
| **리스크** | decoration×IME 충돌 → viewport-only + composition 중 filter 금지, macOS 한글 집중 테스트 |

---

## Phase 3 — Episode Workspace + Commit 원자성

| 항목 | 내용 |
|---|---|
| **목표** | 버튼으로 파이프라인 실행, 커밋이 안전하다 |
| **구현 태스크** | (1) 회차 폴더 인식(`pipeline` manifest 읽기) (2) 파일 탭(brief/context/draft/summary/qa/final) (3) 상태기반 단일 Primary CTA (4) `run_novelctl` job + 콘솔 스트리밍 (5) output file viewer (6) `입력 패키지 보기` (7) **commit journal(staged→verify→atomic move)** (8) crash 재개/롤백 |
| **산출물** | `components/episode/{EpisodeWorkspace,EpisodeTabs,EpisodeToolbar}.svelte`, `jobs/JobConsole.svelte`, `novelctl/commit_journal.py`, `src-tauri/src/proc/runner.rs` |
| **완료 기준** | context/draft/summary/qa/revise/commit 실행. 커밋 중 강제종료 후 재개 or 롤백 성공 |
| **테스트** | pytest: journal 상태기계·중단복구; playwright: CTA 흐름; cargo: job spawn/cancel/stream |
| **리스크** | 다중파일 실패경로 누락 → journal 픽스처 필수, 같은 output 동시 job 잠금 |

---

## Phase 4 — Context Pack v2 + Gemini Agent Center ★앞당김

| 항목 | 내용 |
|---|---|
| **목표** | 장기기억 결정화 + 에이전트 실행/편집 |
| **구현 태스크** | (1) `context/` tier 폴더 스캐폴드 (2) context-pack frontmatter(tier/budget/source_hashes/delta) (3) stale 감지(해시 비교) (4) 예산초과 tier 강등 (5) `.gemini/agents/*.md` 목록·prompt 편집·복원 (6) `run_agent` job + log streaming (7) creativity/strict preset UI→config 저장 (8) agent read/write scope 검증(novelctl) |
| **산출물** | `novelctl/pipeline/context.py`, `agents/`, `components/agents/{AgentList,AgentEditor,AgentRunner}.svelte`, `context/` 템플릿 |
| **완료 기준** | 소스 변경 시 stale 배지, 예산 내 pack 생성(50화 fixture), agent 편집·실행·로그 |
| **테스트** | pytest: tier 선택·예산 강등·stale; playwright: agent 편집→실행→로그 |
| **리스크** | 요약 품질 낮으면 장기 붕괴 → summarizer golden 비교, delta 정확도 검증 |

---

## Phase 5 — QA Dashboard + 폐루프 + 증분 QA

| 항목 | 내용 |
|---|---|
| **목표** | QA가 판정이 아니라 작업 큐가 된다 (MVP 완성점) |
| **구현 태스크** | (1) qa-json 블록 파싱 (2) **verdict 우선** 카드(점수 보조) (3) issue list + jump to line (4) issue→`qa/tasks/` 승격 (5) `cache.json` scene-hash 증분 QA (6) revision-plan viewer (7) **candidate→diff→hunk apply** (8) 재QA 자동 close |
| **산출물** | `components/qa/{QADashboard,QAScoreCard,QAIssueList,RevisionPlan}.svelte`, `editor/DiffPane.svelte`, `novelctl/pipeline/qa.py`, `qa/tasks/` |
| **완료 기준** | 변경 scene만 재QA, 해결 이슈 자동 close, hunk 단위 수락 |
| **테스트** | vitest: qa-json parse·malformed fallback; playwright: qa→task→revise→hunk apply→snapshot |
| **리스크** | 점수 재부각(점수놀이) → UI에서 점수 보조 유지, false-positive 마킹 |

---

## Phase 6 — Analysis Widgets

| 항목 | 내용 |
|---|---|
| **목표** | 뮤블식 반복/밀도 + cross-episode 틱 표시 |
| **구현 태스크** | (1) Repetition Map(word/phrase/ending/description, 판정 4분류) (2) 범위 토글(회차/최근5화/전체) (3) Rhythm/Density + baseline (4) Reader Review 패널(personas.yaml) (5) Episode metadata 분석 (6) term frequency history(SQLite) |
| **산출물** | `components/analysis/{RepetitionMap,RhythmPanel,ReaderReviewPanel}.svelte`, `analysis/project/{tics.md,repetition-global.json,baseline.json}`, `workers/repetition.worker.ts` |
| **완료 기준** | 범위 전환·판정 라벨·baseline 이탈 표시, 위치 클릭 이동 |
| **테스트** | pytest: distribution buckets·judgment; vitest: map 렌더·intentional 토글 |
| **리스크** | 지표 과적합→밋밋한 문장 → intentional 마킹·제안 optional 유지 |

---

## Phase 7 — Codex / Dynamic Links + Canon Fact

| 항목 | 내용 |
|---|---|
| **목표** | 설정명 자동감지·연결, canon fact 잠금 |
| **구현 태스크** | (1) codex index/alias editor (2) `scan_mentions`(trie+confidence) (3) hover preview (4) ambiguous 일괄 재검토 뷰 (5) safe apply(candidate) (6) `canon/facts/` 구조화 + canon-delta apply 연결 (7) progression↔timeline 체크 |
| **산출물** | `components/codex/{CodexBrowser,CodexEditor,AliasEditor,MentionPanel}.svelte`, `editor/extensions/dynamicMention.ts`, `canon/facts/`, `novelctl/pipeline/canon.py` |
| **완료 기준** | 조사/짧은 alias golden 통과, locked fact 변경 시도 감지, hover→apply |
| **테스트** | pytest: confidence·조사 결합·ambiguous; vitest: 데코·hover |
| **리스크** | alias 오탐 → min_length·auto_link·ambiguous 강제 |

---

## Phase 8 — Plot Board / Grid / Canvas (단일원천)

| 항목 | 내용 |
|---|---|
| **목표** | 장면/플롯을 카드·표·그래프로, scene frontmatter 단일원천 |
| **구현 태스크** | (1) Board(drag=frontmatter order) (2) Grid(frontmatter beats 인라인 편집) (3) Mermaid canvas(derive, export) (4) Obsidian Canvas JSON export(best-effort) (5) timeline (6) thread-auditor 리포트 |
| **산출물** | `components/plot/{PlotBoard,PlotGrid,CanvasPreview}.svelte`, `novelctl/analysis/plot_derive.py`, `canvas/layout-*.json`(좌표만) |
| **완료 기준** | 어느 뷰에서 고쳐도 scene frontmatter 한 곳만 변경, grid≠frontmatter 모순 0 |
| **테스트** | pytest: derive 일관성; vitest: drag reorder→order 반영 |
| **리스크** | 뷰가 또 다른 진실원이 됨 → derive-only, 레이아웃만 별도 저장 |

---

## Phase 9 — Snapshot / Git / Integrity

| 항목 | 내용 |
|---|---|
| **목표** | 안전한 버전관리·무결성 |
| **구현 태스크** | (1) `create_snapshot`/`list_snapshots`/`restore_snapshot`(pre-restore snapshot) (2) diff viewer (3) `git_status`/`git_commit`(optional) (4) `integrity_check`(stale summary/QA/context, broken wikilink, ambiguous alias, hash mismatch, locked fact 변경, commit journal 미완료, open-thread 방치) (5) snapshot pruning |
| **산출물** | `src-tauri/src/{snapshot,git}/`, `novelctl/integrity.py`, `components/snapshots/{SnapshotList,IntegrityPanel}.svelte` |
| **완료 기준** | restore 전 자동 백업, 무결성 리포트 카드, git 없이도 동작 |
| **테스트** | cargo: snapshot manifest hash·restore; pytest: integrity 규칙별 |
| **리스크** | 스냅샷 용량 증가 → 최근 N + before-commit 영구 pruning |

---

## Phase 10 — Export / Package

| 항목 | 내용 |
|---|---|
| **목표** | 연재 실무 산출 + 설치형 배포 |
| **구현 태스크** | (1) `exports/profiles/*`(문피아/카카페/시리즈) (2) `novelctl compile --profile --range` (3) Markdown/TXT export (4) backup ZIP (5) public-safe / private-full export (6) Tauri bundle(mac 우선) (7) bundled novelctl(v1) (8) 파일기반 migration(계획 먼저 표시) |
| **산출물** | `novelctl/pipeline/compile.py`, `exports/profiles/*.yaml`, `scripts/bundle-novelctl.sh`, `.novelctl/migrations/` |
| **완료 기준** | 1~50화 플랫폼 포맷 export, 설치 패키지 생성, public-safe에서 notes/runs/logs 제외 |
| **테스트** | pytest: compile 포맷·public-safe 필터; smoke: 패키지 실행 |
| **리스크** | Python 패키징 난이도 → MVP 외부 novelctl→v1 번들 단계적 |

---

## MVP 완료 정의 (Phase 0~5)

> 프로젝트 열기 → `manuscript.md` 편집/저장 → context/draft(mock 가능)/summary/qa/revise/commit 버튼 → QA Dashboard(verdict+task) → snapshot·hunk diff. 모든 산출물이 파일로 남고, 커밋이 원자적이며, context가 stale을 감지한다.
