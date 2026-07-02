# 07. 실제 구현 순서 (커밋 단위)

> 각 커밋: 변경 파일 / 구현 내용 / 테스트 방법 / 다음 커밋 의존성.
> MVP(Phase 0~5)를 커밋 단위로 상세화, Phase 6~10은 그룹 커밋으로 요약.
> 접두: `feat/`, `test/`, `chore/`. `[P#]`은 Phase.

## Phase 0 — CLI/JSON Contract

**C001 [P0] chore: monorepo scaffold**
- 변경: `package.json`, `pnpm-workspace.yaml`, `packages/novelctl-core/pyproject.toml`, `packages/shared-schemas/`, `scripts/dev.sh`
- 내용: pnpm workspace + uv 프로젝트 초기화, 폴더 골격
- 테스트: `pnpm install`, `uv sync` 성공
- 의존: 없음

**C002 [P0] feat: novelctl response envelope + error codes**
- 변경: `novelctl/contracts/response.py`, `contracts/errors.py`, `shared-schemas/json/app-error.schema.json`
- 내용: `{ok,command,data,error}` envelope, exit code(0/2/3/4), `AppError`
- 테스트: pytest `test_envelope.py`(ok/err 직렬화)
- 의존: C001

**C003 [P0] feat: novelctl status --json**
- 변경: `novelctl/cli.py`, `novelctl/project.py`
- 내용: 프로젝트 스캔, `pipeline` manifest 읽기, health 요약
- 테스트: pytest `test_status.py`(golden project 대상)
- 의존: C002

**C004 [P0] feat: local analyzers (repetition/rhythm/mention)**
- 변경: `analysis/repetition.py`, `analysis/rhythm.py`, `analysis/mention.py`
- 내용: 한글 토큰화(kiwipiepy optional+regex fallback), distribution buckets, 문장끝 regex, alias trie
- 테스트: pytest golden(반복 count·distribution·조사 alias)
- 의존: C002

**C005 [P0] feat: context/draft/summary/qa/analyze/snapshot --json (mock)**
- 변경: `pipeline/{context,draft,summary,qa,revise,commit}.py`, `agents/runner.py`, `snapshot.py`
- 내용: 파이프라인 골격, mock mode(고정 candidate), candidate는 `.novelctl/runs/<id>/`
- 테스트: pytest `test_pipeline_mock.py`(candidate 생성, 원본 미수정 assert)
- 의존: C003, C004

**C006 [P0] feat: manuscript.md + pipeline manifest 규약**
- 변경: `project.py`, `project-template/story/chapters/ep001/{index.md,manuscript.md,stages/}`
- 내용: 단일 현재본 규약, 단계본 stages/, manifest 갱신 유틸
- 테스트: pytest `test_manifest.py`(stage 추가 시 리넘버링 없음)
- 의존: C003

## Phase 1 — Tauri Shell

**C007 [P1] feat: Tauri + SvelteKit scaffold**
- 변경: `apps/desktop/{package.json,svelte.config.js,vite.config.ts,src-tauri/*}`
- 내용: 빈 앱 실행, adapter-static
- 테스트: `pnpm --filter desktop tauri dev` 실행
- 의존: C001

**C008 [P1] feat: path sandbox (Rust)**
- 변경: `src-tauri/src/fs/sandbox.rs`, `error.rs`
- 내용: relative-only, `..`·absolute·root밖 symlink 거부
- 테스트: cargo `sandbox_tests`(reject 케이스)
- 의존: C007

**C009 [P1] feat: open_project / create_project / list_tree**
- 변경: `src-tauri/src/commands/project.rs`, `lib/api/commands.ts`
- 내용: 검증·스캔·template 복사, 트리 타입 분류
- 테스트: cargo + playwright(open→tree)
- 의존: C008

**C010 [P1] feat: ProjectLauncher + 최근 프로젝트 + 설정**
- 변경: `components/settings/{ProjectLauncher,EnvironmentCheck}.svelte`, `stores/project.svelte.ts`, `stores/settings.svelte.ts`, `commands: read/write_app_settings, test_gemini_cli, test_novelctl`
- 내용: launcher UI, env check, app data persist
- 테스트: playwright(open→launcher→env badge)
- 의존: C009

## Phase 2 — Markdown Editor

**C011 [P2] feat: read_file / write_file (expected_hash, atomic)**
- 변경: `commands/files.rs`, `lib/api/commands.ts`
- 내용: sha256, tmp→rename, 충돌검사
- 테스트: cargo(conflict), vitest(wrapper)
- 의존: C009

**C012 [P2] feat: CodeMirror MarkdownEditor mount**
- 변경: `components/editor/MarkdownEditor.svelte`, `lib/editor/setup.ts`, `stores/editor.svelte.ts`
- 내용: CM6, doc as source, open/save 배선
- 테스트: playwright(열기→편집→저장)
- 의존: C011

**C013 [P2] feat: frontmatter parse/fold + wiki link highlight + word count**
- 변경: `lib/editor/extensions/{frontmatter,wikilink,wordcount}.ts`, `workers/markdownParse.worker.ts`
- 내용: fold marker, `[[..]]` 하이라이트, 실시간 자수(worker)
- 테스트: vitest(frontmatter parse), playwright(word count)
- 의존: C012

**C014 [P2] feat: autosave + dirty + Split/Preview + snapshot 버튼**
- 변경: `components/editor/{EditorToolbar,PreviewPane}.svelte`, `commands: create_snapshot`
- 내용: 2s debounce, AI 전 저장, markdown-it preview, snapshot
- 테스트: playwright(dirty→autosave→clean, snapshot 생성)
- 의존: C013

**C015 [P2] test: 한글 IME 안정화**
- 변경: `lib/editor/ime.ts`, `tests/ime.spec.ts`
- 내용: compositionend까지 데코/filter 보류
- 테스트: playwright(macOS 한글 조합 중 데코 미개입)
- 의존: C013

## Phase 3 — Episode Workspace + Commit

**C016 [P3] feat: watch_project + 충돌 다이얼로그**
- 변경: `src-tauri/src/fs/watcher.rs`, `components/editor/ConflictDialog.svelte`
- 내용: notify, self-write 무시, external+dirty→conflict
- 테스트: cargo(watcher), playwright(외부 변경 충돌)
- 의존: C011

**C017 [P3] feat: run_novelctl job + JobConsole streaming**
- 변경: `src-tauri/src/proc/runner.rs`, `commands/jobs.rs`, `components/jobs/JobConsole.svelte`, `stores/jobs.svelte.ts`
- 내용: spawn, stdout/stderr emit, cancel
- 테스트: cargo(spawn/cancel/stream), playwright(콘솔 로그)
- 의존: C009

**C018 [P3] feat: EpisodeWorkspace 탭 + 상태기반 Primary CTA**
- 변경: `components/episode/{EpisodeWorkspace,EpisodeTabs,EpisodeToolbar,EpisodeDashboard}.svelte`, `stores/episode.svelte.ts`
- 내용: pipeline manifest 읽어 탭·CTA 결정
- 테스트: playwright(CTA 상태 전이)
- 의존: C017, C006

**C019 [P3] feat: high-level 파이프라인 command + output viewer + 입력 패키지 보기**
- 변경: `commands: run_episode_{context,draft,summary,qa,revise,commit}, view_prompt_package`, `components/episode/OutputFileViewer.svelte`
- 내용: 버튼→novelctl, candidate viewer, 전송파일 미리보기
- 테스트: playwright(mock draft→viewer)
- 의존: C018, C005

**C020 [P3] feat: commit journal (원자성)**
- 변경: `novelctl/commit_journal.py`, `pipeline/commit.py`
- 내용: before-snapshot→staged→verify→atomic move→done, 재개/롤백
- 테스트: pytest(중단복구, locked fact 미변경 assert)
- 의존: C005, C006

## Phase 4 — Context Pack v2 + Agent Center

**C021 [P4] feat: context/ tier scaffold + ContextPack frontmatter**
- 변경: `project-template/context/*`, `pipeline/context.py`, `shared-schemas/json/context-pack.schema.json`
- 내용: tier/budget/source_hashes/delta 생성
- 테스트: pytest(예산 내 tier 선택, 필수 tier)
- 의존: C005

**C022 [P4] feat: stale 감지 + 예산 강등**
- 변경: `pipeline/context.py`, `integrity.py`
- 내용: source_hash 비교, 초과 시 tier 요약 강등
- 테스트: pytest(소스 변경→stale, 초과→강등)
- 의존: C021

**C023 [P4] feat: Agent Center (목록/편집/복원/실행/로그)**
- 변경: `components/agents/{AgentList,AgentEditor,AgentRunner,CreativityParams}.svelte`, `stores/agent.svelte.ts`, `commands: run_agent`
- 내용: `.gemini/agents/*.md` CRUD, run+log, creativity→config
- 테스트: playwright(편집→실행→로그), pytest(scope 검증)
- 의존: C019, C017

## Phase 5 — QA Dashboard + 폐루프 + Diff

**C024 [P5] feat: qa-json parse + QADashboard(verdict 우선)**
- 변경: `components/qa/{QADashboard,QAScoreCard,QAIssueList}.svelte`, `stores/qa.svelte.ts`
- 내용: novelstudio:qa-json 파싱, verdict 카드(점수 보조), malformed fallback
- 테스트: vitest(parse/fallback), playwright(대시보드)
- 의존: C019

**C025 [P5] feat: issue jump + diagnostics decoration**
- 변경: `lib/editor/extensions/qaDiagnostics.ts`, `QAIssueList` 연동
- 내용: lineStart/End→CM range, squiggle, gutter
- 테스트: playwright(issue 클릭→line 이동)
- 의존: C024, C012

**C026 [P5] feat: issue→revision task + 재QA 자동 close**
- 변경: `pipeline/qa.py`, `pipeline/revise.py`, `components/qa/RevisionPlan.svelte`, `qa/tasks/`
- 내용: task 파일화, input_hash 캐시, 재검출 안 되면 fixed
- 테스트: pytest(증분 QA·auto close)
- 의존: C024

**C027 [P5] feat: candidate→diff→hunk apply + pre-apply snapshot**
- 변경: `components/editor/DiffPane.svelte`, `lib/editor/merge.ts`(CodeMirror Merge), `stores/editor(diffSession)`
- 내용: 좌 현재본/우 candidate, hunk 수락, stale candidate 차단, 적용 전 snapshot
- 테스트: playwright(revise→diff→hunk apply→snapshot 생성)
- 의존: C026, C014

**C028 [P5] test: MVP E2E golden flow**
- 변경: `tests/e2e/mvp_flow.spec.ts`, `packages/project-template`(golden)
- 내용: open→edit→context→draft(mock)→qa→task→revise→hunk apply→commit
- 테스트: playwright 전 흐름 green
- 의존: C020, C023, C027

> **여기까지 MVP 완료.**

## Phase 6~10 (그룹 커밋 요약)

**C029~C033 [P6] Analysis**: RepetitionMap(범위 토글/판정4분류) → RhythmPanel+baseline → ReaderReviewPanel(personas) → cross-episode tics → term history. 테스트: pytest+vitest.
**C034~C038 [P7] Codex/Links**: CodexBrowser/AliasEditor → scan_mentions+confidence → hover preview → ambiguous 재검토 → safe apply → canon/facts 구조화+delta apply. 테스트: 조사/ambiguous golden.
**C039~C043 [P8] Plot**: PlotBoard(order) → PlotGrid(beats derive) → Mermaid export → Obsidian Canvas export → thread-auditor. 테스트: derive 일관성.
**C044~C048 [P9] Snapshot/Git/Integrity**: snapshot list/restore(pre-restore) → diff viewer → git status/commit → integrity_check(전 규칙) → pruning. 테스트: manifest hash·restore.
**C049~C052 [P10] Export/Package**: export profiles+compile → backup ZIP(public-safe/private-full) → Tauri bundle(mac) → bundled novelctl(v1)+migration. 테스트: compile 포맷·public-safe 필터.

## 커밋 의존성 그래프(요약)

```text
C001 → C002 → C003 → C005 → C020(commit journal)
        C002 → C004 → C005
C001 → C007 → C008 → C009 → C010
                      C009 → C011 → C012 → C013 → C014 → C027
                      C009 → C017 → C018 → C019 → C023, C024
C005 → C021 → C022     C019 → C024 → C025, C026 → C027 → C028(MVP)
C003 → C006 → C018, C020
```
