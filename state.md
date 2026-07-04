# state.md — Current Handoff State

## 2026-07-04 AI Envelope Schemas + Repair Loop (branch: feat/ai-mission-control)

- After pushing `4d50bc9` to `origin/feat/ai-mission-control`, continued the next architecture-review roadmap item.
- Implemented `DraftCandidateEnvelope` and `QAReportEnvelope` in `apps/desktop/src/lib/domain/agentEnvelopes.ts`.
  - Draft candidates are accepted only if validated JSON includes usable Korean `manuscript_md`, memory/canon delta metadata, plot compliance, continuity risks, style self-check, and change summary.
  - QA output is validated as `bindery.qa_report.v1`, while legacy `bindery:qa-json` blocks remain compatible when score/verdict/issues are present.
  - Invalid draft/QA agent output gets one repair prompt before the pipeline falls back to the existing native/mock candidate or QA report paths.
- `pipeline.ts` now tries the structured draft envelope path before `generateCandidate`, and normalizes repaired QA envelopes into Markdown with an embedded `bindery:qa-json` block.
- Added `tests/envelopes.node.test.mjs`; verified with Svelte check, esbuild-bundled envelope/planning smokes, styleSystem/styleAnalyzer node smokes, Python 18 tests, production build (known chunk warning only), static verify, AI adapter smoke, and diff check.

## 2026-07-04 Plan-And-Write Episode Brief + Scene Plan (branch: feat/ai-mission-control)

- Continued the architecture review follow-up after the AI Mission Control/run persistence commit on `feat/ai-mission-control`.
- Implemented the next roadmap item: `EpisodeBrief` and `ScenePlan` now exist as first-class pipeline steps before draft generation.
  - `planning.ts`: typed `EpisodeBrief`/`ScenePlan` models, agent JSON parsers, readable Markdown artifact renderers, and deterministic local fallbacks from plot board/open threads/previous summary/frontmatter/manuscript excerpts.
  - `pipeline.ts`: new `runEpisodeBriefAction` and `runScenePlanAction`; context packs include planning artifacts; QA prompts check brief/scene-plan compliance; `runDraftAction` refuses to generate until both artifacts exist.
  - `prompt.ts`/`pipelineStore.ts`/`AIStudio.svelte`: pipeline order is now `episode-brief -> scene-plan -> context -> draft -> analyze -> qa -> revise -> summarize -> commit`, automatically reflected in Mission Control.
  - `guidance.ts`: `episode-brief` and `scene-plan` feed draft/revise prompts as hard guidance.
  - `wikilink.ts`: `/brief` and `/plan` slash-menu entries hand off to the AI 작업 run surface.
- Added `tests/planning.node.test.mjs`; direct Node strip-types cannot resolve the app's bundler-style extensionless imports, so the verified path bundles it with repo-local esbuild and runs the bundle.
- Verified: `npm --workspace apps/desktop run check` (0 errors / 0 warnings), bundled planning smoke OK, styleSystem/styleAnalyzer node smokes OK, Python 18 tests OK, `npm run build` OK with the known chunk-size warning, static verify OK, AI pipeline adapter smoke PASS (codex), and `git diff --check` OK.
- Remaining follow-ups from the review: DraftCandidateEnvelope/QAReportEnvelope schemas + repair loop, explicit approval/edit UI for planning artifacts, MemoryWriteProposal approval UI, `.bindery/memory` semantic/episodic/procedural indexes, retrieval-based context packs.

## 2026-07-04 AI Mission Control + Run Persistence (branch: feat/ai-mission-control)

- Implemented the first slice of the architecture review (`Bindery_AI_pipeline_architecture_review_2026-07-03.md`) — Phase 1 items 1/3/4(부분)/5 of its priority list:
  - `runStore.ts`: PipelineRun model (runId, settings snapshot, per-step status/artifact links, human decisions), persisted to `.bindery/runs/{runId}/run.json` + `.bindery/runs/index.json`, hydrated on project open (stale `running` runs normalize to 중단).
  - `AIMissionControl.svelte` (`components/ai/mission/`): full-screen workspace — left step graph with run buttons + run history, center 산출물/프롬프트/컨텍스트/검토 tabs (검토 embeds CandidateDiffPanel/QADashboard/RevisionPanel), right inspector (settings, risks, decision log). Esc closes; entry from the AI rail and run stage.
  - `guidance.ts`: GuidanceSection now carries `hardness`(hard/soft/reference), `sourceId`, `tokenEstimate` (+`estimateTokens`); prompt text output unchanged.
  - `pipeline.ts` `runDraftAction`: honors `settingsStore.aiDefaultCandidateCount` (1–4) with re-call + variation directive; candidates relabeled 후보 A–D. Apply/discard/run-all/reset record human decisions.
- Browser-verified on the dev server: run chip starts on first step run, artifacts/prompt/context tabs render (hardness badges + token totals), candidate count honored with style scores, apply-all logs a decision and returns to 집필, 전체 실행 finishes the run into history as 검토 대기 (superseded run marked 중단), Esc closes, 0 console errors. svelte-check 0/0, Python 18 tests OK, node smokes OK.
- Not yet done from the review (follow-ups): DraftCandidateEnvelope/QAReportEnvelope JSON schemas, explicit approval/edit UI for EpisodeBrief/ScenePlan artifacts, MemoryWriteProposal approval UI, retrieval-based context pack, auto repair passes.

## 2026-07-03 Pipeline Gap Closure + UI Restructure

- Audit conclusion: style-analysis and AI writing pipelines run end to end (local-first analysis, native→Python CLI delegation, propose→review→apply). Three gaps were closed this pass.
- Gap fixes (done, browser-verified):
  - `context`/`summarize`/`commit` are real: `runContextAction`/`runSummarizeAction`/`runCommitAction` in `apps/desktop/src/lib/actions/pipeline.ts`. Summarize is agent-first with an offline fallback and still feeds `canon/summaries/{ep}.md`; commit snapshots the manuscript.
  - StyleMatch score shown per candidate in `CandidateDiffPanel.svelte` (uses the active `styleStore.presets[0]`).
  - PromptCapsule injected into draft/revise guidance in `guidance.ts`.
  - `AIStudio.svelte` no longer routes context/summarize/commit through the `novelctl()` stub.
- UI restructure toward Pensive (pensive.so) + Muvel (뮤블) references (done, browser-verified):
  - Chapter navigator renders only on the writing screen (`AppShell.svelte`/`TopBar.svelte`).
  - Top navigation reduced from five tabs to three (`집필 · 자료 · 작업실`); `문체`/`AI`/`내보내기` are folded under one `작업실` surface with a slim sub-nav in `MainSurface.svelte` (`studioViews`/`isStudioView` in `uiStore.ts`).
  - Flattened the materials/export/help surfaces: `panel-slim` and `help-panel` lost their rounded card/background chrome in favor of hairline-divided full-width sections (`app.css`).
  - `StyleSystemPanel.svelte` was already band/hairline based, so it was left as-is.
  - Remaining polish (not blocking): unify the AI/style rails into one full-bleed surface; Muvel-style editor widgets (timer/memo/dictionary/episode reference). (The earlier "book map" idea was from pensive.me, a separate US AI studio, not the Korean pensive.so/Muvel references, so it was dropped.)
- Verification this pass: svelte-check 0/0, Python 18 tests OK, TS/analyzer smoke OK, browser click-through (3 top tabs, studio sub-nav, navigator gating, flattened panels) with 0 console errors.
- Coordination note: Codex was actively committing during this session and swept the working tree into its commits (`501064e`, `e676d1e`); this session's later work is committed under `2931f49`, `e4dfd54`, and the docs commit that follows.

## 2026-07-03 Style System Patch State

- `bindery_style_system_patched_20260703.zip` has been applied for code, tests, and docs without replacing the existing long-running project history files.
- Structured style runtime now exists in TypeScript and Python: SceneClassification, StyleRouter, StyleStack merge, PromptCapsule, StyleMatchScore, and SkillPack export.
- Phase 2 is complete: native Tauri style commands call Python `novelctl` style subcommands, the SQLite schema lives in `packages/novelctl-core/novelctl/migrations/001_style_system.sql`, `style-sync` indexes project `styles/` JSON into `.bindery/style-system.sqlite3`, and `StyleSystemPanel.svelte` provides Preset Manager, Stack Mixer, Router Editor, Scene Override, Score Lab, Suggestion Lab, and SkillPack export preview.
- Structured-output guard schemas, Korean surface/NLP analysis, feature-based scoring hardening, SkillPack validator, zip exporter, reference policy, and regression fixture are implemented.
- `StyleStudio.svelte` shows SceneClassification/register rows in addition to the existing local evidence bundle.
- `styleAnalyzer.ts` now groups short sentence-like blocks into larger scene candidates, preventing one-scene-per-sentence analysis when pasted text contains blank lines after every sentence.
- `phase2_backlog.md` is present and its remaining tasks are tracked in `docs/TASKS.md`.
- Latest verification: Python unittest OK (18 tests), TypeScript style smoke OK, scene grouping smoke OK, Python compileall OK, static verify OK, Svelte check 0 errors/0 warnings, production build OK with the known chunk-size warning, Rust fmt/check OK, and Chrome DevTools visual QA at 1280/768/390 OK.

## Current stage

Stage 3.11 — Runtime Readiness, Manual, Naming Pass. Stage 3.9 UI/UX 기능은 유지하고, mock 기본값 OFF, 컴파일/검증 재현성 최소수정, 운영 매뉴얼, 이름 후보 문서를 추가한 상태.

2026-07-02 update: local macOS standalone validation passed after adding the missing Tauri library target. UI planning now has a root `DESIGN.md`, a Pensiv/Muvel improvement plan, and Superloopy visual QA evidence.

2026-07-02 implementation update: Pensiv/Muvel Phase 1 UI cleanup is implemented. The app defaults to Codex CLI for AI candidate generation because `agy` is unavailable, Gemini headless prompt is blocked by account/client policy, and Claude CLI authentication fails on this Mac.

## Source basis

- Input archive: `bindery stage3 5 result.zip`
- Prior base: Stage 3 scaffold + Stage 3.5 browser/Svelte UI feature layer
- Current patch: native command parity, project-root relative file API, candidate snapshot hardening, applied-hunk state, evidence/fallback reporting

## Current implementation status

| Area | Status |
|---|---|
| Browser prototype | implemented and smoke-tested |
| Svelte/Tauri source tree | implemented |
| CodeMirror editor component | implemented + custom extensions |
| QA / Repetition / Revision parsers | implemented |
| Candidate → Diff → Apply UI | hardened: apply-all and per-hunk apply both create a session snapshot before first mutation |
| Applied hunk state | implemented and passed into `DiffView` |
| Dynamic Link / Codex scan | browser mock implemented; native `list_codex` and `scan_codex_links` stubs implemented |
| Plot Grid | browser mock implemented; native `get_plot_grid` stub implemented |
| Tauri command parity | Stage 3.5 commands now registered in Rust: `run_qa`, `generate_revision_plan`, `generate_candidate`, `list_codex`, `scan_codex_links`, `get_plot_grid` |
| File API | hardened to `projectPath + relativePath` for `read_file`, `write_file`, `analyze_repetition` |
| Path security | added root-anchored resolver rejecting absolute paths, parent traversal, and project-root escape |
| Snapshot | hardened with root-bound target resolution and sha256 metadata returned to UI |
| `run_novelctl` fallback | changed from false-success mock to `ok:false`, `mode:"unavailable"` when native `novelctl` is unavailable |
| Windows installer config | present via Tauri NSIS target |
| Full npm build | PASS |
| svelte-check | PASS, 0 errors / 0 warnings |
| Browser smoke | PASS |
| cargo check | PASS on local macOS |
| macOS standalone build | PASS, `apps/desktop/dist-standalone/Bindery_0.3.0_arm64-standalone` |
| macOS standalone run smoke | PASS, launched and stopped with empty stdout/stderr |
| Windows standalone exe | pending Windows runner/local Windows |
| AI adapter smoke | PASS via `bash scripts/verify_ai_pipeline.sh` using Codex CLI |
| UI visual QA | PASS for open-book flow at 390/768/1280/1440, no console errors or document overflow |

## Architecture decisions retained

- Markdown/YAML/JSON are source of truth.
- AI outputs are candidates, not destructive overwrites.
- `manuscript.md` remains current episode working document.
- Episode `index.md` acts as pipeline manifest.
- QA produces taskable issues.
- Snapshot precedes high-risk rewrite and now also precedes per-hunk candidate apply.
- UI follows evidence-first lane design inspired by Superloopy, without copying its code.

## Native bridge contract after Stage 3.6

Core file operations now use explicit project anchoring:

```ts
readFile(projectPath, relativePath)
writeFile(projectPath, relativePath, content)
analyzeRepetition(projectPath, relativePath)
```

Rust commands now expose:

```text
open_project
list_tree
read_file
write_file
run_novelctl
test_gemini_cli
create_snapshot
list_snapshots
git_status
analyze_repetition
run_qa
generate_revision_plan
generate_candidate
list_codex
scan_codex_links
get_plot_grid
```

## Known blockers

- Windows `.exe` generation still needs Windows local or CI runner validation.
- Full interactive Tauri runtime invocation still needs `npm run tauri:dev` manual validation.
- Current native QA/candidate/codex/plot commands are deterministic stubs; they should later delegate to `novelctl`/Gemini pipeline or real project parsers.
- This folder is not a git repository, so local commit workflow is unavailable.
- `npm install` reports 3 low severity npm audit findings.
- Browser preview verifies mock candidate flow only; native Codex candidate flow is verified at adapter level and still needs a real Tauri click-through.

## Recommended next step

Stage 3.7 — Native Runtime Validation:

1. Install Rust + Tauri prerequisites.
2. Run `npm run tauri:dev`.
3. Validate project-root relative read/write on real project folders.
4. Validate Stage 3.5 command round-trip in Tauri runtime.
5. Build Windows NSIS artifact in GitHub Actions or Windows local environment.

## Stage 3.9 status

| 항목 | 상태 |
|---|---|
| 문서 세트 | BUILD_REPORT/README/state/plan/log Stage 3.9 기준 정리 |
| 스모크 | browser_smoke.sh = 실제 preview + tests/e2e_playwright.py (repo 포함) |
| settings 실연결 | mockMode→getInvoke, novelctlPath→run_novelctl |
| 스냅샷 | 에디터 버퍼 기준 (content 파라미터, TS+Rust) |
| scan_codex_links | 네이티브가 현재 content 수신 |
| 프리뷰 | DOMPurify 살균 |
| CSP | 배포 전환 계획 docs/DEPLOY_CSP.md |
| 미검증 | Rust 컴파일/Tauri 왕복/NSIS — BUILD_REPORT 참조 |


## Stage 3.11 status

| 항목 | 상태 |
|---|---|
| Mock mode 기본값 | OFF |
| Mock 상태 표시 | TopBar `MOCK OFFLINE` 배지 |
| Rust error conversion | `From<serde_json::Error>` 추가 |
| fresh check | `svelte-kit sync && svelte-check` |
| browser smoke | Chromium path fallback 보강, log tail 추가 |
| 운영 매뉴얼 | `docs/OPERATION_MANUAL.md` |
| 이름 후보 | `docs/NAME_IDEAS.md` |
| 실제 Tauri runtime | 아직 미검증 |
| Windows NSIS | 아직 미검증 |

## 다음 인수인계 포인트

1. `npm run tauri:dev` 후 Mock mode OFF 상태로 native command 왕복을 검증한다.
2. Windows runner에서 `npm run tauri:build:standalone`으로 `.exe` artifact를 확인한다.
3. `docs/UI_IMPROVEMENT_PLAN_20260702.md` Phase 1부터 진행한다.
4. 제품명은 `SerialForge`, `InkLedger`, `DraftForge`, `연재공방` 중 하나를 우선 검토한다.

Updated next steps:

1. Run the Tauri window and click `Draft` with Codex default settings.
2. Add a compact mobile step picker for the build ladder.
3. Add richer recent-book metadata on My Books.
4. Validate Windows standalone on a Windows runner.


## Stage 3.11 status

| 항목 | 상태 |
|---|---|
| 임시 제품명 | `Bindery` 반영 |
| 사용자 노출명 | TopBar, app title, Tauri productName/window title 변경 |
| package metadata | `bindery-workspace`, `bindery-desktop`, `@bindery/shared` |
| localStorage migration | 기존 `novel-studio-*` fallback 유지 |
| SnapshotPanel | 현재 에디터 버퍼 기준 snapshot |
| AI Panel episode | 열린 파일 경로 기반 episode 산출 |
| 코드 리뷰 | `CODE_REVIEW.md` |

## 2026-07-02 Writing-First UI Rework

- [x] `작성` is the default project-open screen.
- [x] `AI 작업` is separate from the main editor.
- [x] Candidate generation now stays on `AI 작업` and shows candidate comparison plus QA evidence.
- [x] Visible Korean menu/copy cleanup completed for primary screens.
- [x] Browser visual QA passed at 1440, 1024, and 390 px with 0 clipped text findings.
- [x] Codex AI adapter smoke passed.
- [x] macOS raw standalone and `.app` bundle rebuilt.

Current artifact paths:

- `apps/desktop/dist-standalone/Bindery_0.3.0_arm64-standalone`
- `apps/desktop/src-tauri/target/release/bundle/macos/Bindery.app`
