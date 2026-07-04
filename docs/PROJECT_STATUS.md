# Project Status

Updated: 2026-07-04 (AI pipeline observability + UX cleanup plan)

## Current State

Bindery is a writing-first macOS/Svelte/Tauri app covering the full local novel workflow: first-run project creation from a blank template or from a rough integrated idea/bible source (paste, Markdown/TXT, or DOCX), episode management (create/switch/status), writing with scene jump and daily stats, materials (editable plot board, codex item creation), style replication with adjustable enforcement strength, a 9-step AI harness (`회차 브리프 -> 장면 계획 -> 컨텍스트 -> 초안 후보 -> 표현 분석 -> QA -> 수정 계획 -> 요약 -> 기록`) whose every step leaves file-synced artifacts that feed drafting (with author-tunable length/creativity/instructions), schema-validated draft/QA agent outputs with one repair retry before fallback, agent-based QA with style-compliance and continuity gates, snapshot compare/restore, project-wide search, and real TXT/HTML/EPUB export. Rough source intake is local-first but can now ask the configured AI runner to read the preserved `notes/source-raw.md` and return a validated semantic split before harness files are finalized. Standalone/Tauri launches can be pointed at a real project folder with `BINDERY_START_PROJECT` or `--project`, so validation builds can open a seeded author project without relying on browser preview or stale localStorage. The shell keeps the collapsible binder navigator on the writing screen and gives AI/materials/export surfaces a single focused work area; top navigation and analysis rows remain resilient so dense Korean labels truncate or scroll instead of stacking into vertical text. The style analyzer follows the v3 MVP procedure locally first: normalize input, group scene candidates, code local features, generate evidence, apply globality decisions, build a surface profile, then hand semantic interpretation to the configured AI runner only where local regex analysis is insufficient. The structured style runtime now includes repository sync, deterministic SceneClassification, StyleRouter, StyleStack merge, PromptCapsule, feature-based StyleMatchScore, Korean surface analysis, structured-output guards, and validated SkillPack export paths in TypeScript and Python. Storage is local-only by design; `styles/` JSON is the editable source and SQLite is the query/index cache.

## Planned (2026-07-04, AI pipeline observability + UX cleanup)

- Added `docs/AI_PIPELINE_OBSERVABILITY_UX_PLAN_20260704.md` as the implementation plan for CLI streaming, run event persistence, token/usage reporting, explicit pipeline targets, candidate diff baselines, bible-to-episode outline generation, and anti-slop AI workspace cleanup.
- Next implementation should make every running CLI step show elapsed time, latest event, provider/mode, stdout/stderr or file-output progress, retry/repair state, and token usage with an exact/reported/estimated/unavailable label.
- AI Runner settings also need an explicit model contract: `CLI default` must be shown as a real option, explicit provider model ids must be persisted, and provider/model/output mode should appear in run records, usage summaries, Mission Control, and live logs.
- The same pass should label each pipeline step as Static, AI, Hybrid, or Fallback, then record the actual mode used in the latest run.
- Mission Control should gain a live log tab and per-step usage/duration summaries backed by `.bindery/runs/{runId}/events.ndjson`, `usage.json`, and richer `run.json` metadata.
- The AI pipeline should stop implying broad "전체 실행" semantics unless the author chooses an explicit episode range; candidate diff review should default to the generation baseline and warn when the live editor changed.
- QA needs an explicit target contract so the app can distinguish current-editor QA from selected-candidate QA, baseline QA, and mixed applied-content QA. POV/first-person findings should require declared expected POV plus line-level evidence before they can fail a gate.
- UI cleanup should replace text-heavy nested cards with dense workbench tables, rails, split panes, key-value rows, and disclosure sections aligned with `DESIGN.md`.

## Completed (2026-07-04, Pipeline source clarity + workspace UI fixes)

- Fixed the writing view so switching back to `본문` keeps the CodeMirror editor mounted and visible instead of requiring `미리보기`.
- Reworked plot-board beat display so long Korean descriptions wrap inside table cells instead of being clipped inside pill-like labels; editing beat text now uses a two-line field.
- Changed Codex `링크 스캔` output into a collapsed result summary with explicit `결과 보기` and `닫기`, preventing confidence chips such as `100%` from permanently covering panel space.
- Added a first-run `통합 문서` destination map showing exactly where rough source material is written: `notes/source-raw.md`, `notes/source-intake.md`, `canon/setting-bible.md`, `characters/`, `world/organizations.md`, `plot/plot-board.json`, and `plot/open-threads.md`.
- Fixed the preferences modal frame height so section changes scroll inside a stable dialog instead of resizing the outer window.
- Added pipeline input-basis visibility in AI 작업 and Mission Control, and made Mission Control show the episode artifact list plus per-step artifact counts.
- Expanded EpisodeBrief and ScenePlan planning input so agent prompts include source-intake output, setting bible, character inbox, organizations, open threads, and Codex item summaries in addition to plot board rows, previous summary, and manuscript excerpts.

## Completed (2026-07-04, Standalone startup project + MEDALLION seed)

- Added a Tauri startup-project bootstrap: `BINDERY_START_PROJECT`, `--project <path>`, or a bare project path argument can open a real folder before localStorage restoration.
- Created `/Users/tofu/Downloads/MEDALLION.bindery` beside `/Users/tofu/Downloads/medallion bible.docx` by copying the preserved AI-refined source-intake output, adding `.novelctl/config.yaml`, and adding `notes/ai-refinement-run.md` so the app can read the result without rerunning AI.
- Verified with `npm --workspace apps/desktop run check`, `cargo fmt --check`, `cargo check`, `npm run build`, `npm run tauri:build:standalone`, `npx tauri build --bundles app`, app launch with `--project /Users/tofu/Downloads/MEDALLION.bindery`, WebKit localStorage inspection for `bindery-projects.current.rootPath`, and Computer Use/screenshot evidence under `.superloopy/evidence/frontend/20260704-standalone-medallion/`.

## Completed (2026-07-04, AI 문맥 분해 + DOCX 통합 문서)

- Added optional `AI 문맥 분해` to the `통합 문서` start path. Bindery writes the raw source first, asks the configured agent to read `notes/source-raw.md`, validates the returned semantic `SourceIntake` JSON, and falls back to the local split if the agent is unavailable or invalid.
- Extended source-intake output with organizations/factions via `world/organizations.md` and richer metadata in `notes/source-intake.md`, so bible documents with teams, institutions, leagues, or factions do not collapse into character or plot labels.
- Added DOCX source import without a new production dependency: the app extracts `word/document.xml`, preserves heading markers, and passes the extracted text into the same source-intake flow as Markdown/TXT.
- Ran `/Users/tofu/Downloads/medallion bible.docx` through the current static split and the new AI refinement path. Static split misclassified labels like `나이`, `이름`, `7`, and `10`; AI refinement produced `source: agent`, 7 characters, 9 organizations, 10 plot beats, 10 open threads, and 15 style notes under `/tmp/medallion-source-intake/refined`.
- Verified with `node --experimental-strip-types tests/sourceIntake.node.test.mjs`, `node --experimental-strip-types tests/documentText.node.test.mjs`, `npm --workspace apps/desktop run check`, bundled planning/envelope smokes, Python unit tests, style node smokes, actual DOCX extraction against `medallion bible.docx`, `npm run build`, `python3 scripts/verify_static.py`, `bash scripts/verify_ai_pipeline.sh`, `git diff --check`, and Playwright visual QA at 390/768/1280.

## Completed (2026-07-04, 통합 문서 시작 + 하네스 분해)

- Added a `통합 문서` first-run path on the start screen. Authors can paste rough ideas, synopsis, setting bible, cast notes, or load a Markdown/TXT source file before creating the project.
- Added a deterministic `SourceIntake` domain contract that separates rough source material into premise/logline, world rules, characters, plot beats, open threads, style notes, a source digest, and an initial `plot/plot-board.json`.
- Project creation from source now writes harness-ready files: `canon/setting-bible.md`, `plot/open-threads.md`, `plot/plot-board.json`, `characters/cast-inbox.md`, per-character files when detected, `notes/source-intake.md`, `notes/source-raw.md`, and seeded EP001 files.
- Added source-intake smoke coverage and kept the browser/Tauri path local-first: browser mock can preview the UI, while native Tauri writes the generated files into the chosen project folder.
- Verified with `npm --workspace apps/desktop run check`, bundled Node smokes for source-intake/planning/envelopes, `python3 -m unittest discover -s tests -v`, style node smokes, `npm run build`, `python3 scripts/verify_static.py`, `bash scripts/verify_ai_pipeline.sh`, `git diff --check`, and Playwright Chromium visual QA at 390/768/1280 plus submit handoff.

## Completed (2026-07-04, AI envelope 스키마 + repair loop)

- Added `DraftCandidateEnvelope` and `QAReportEnvelope` domain schemas with validators, JSON extraction from direct/fenced/comment-block output, QA markdown normalization, schema examples for prompts, and smoke coverage.
- Draft generation now tries a structured `DraftCandidateEnvelope` agent call first; invalid output gets one repair prompt, and only validated `manuscript_md` becomes a candidate. If the structured path is unavailable or unrecoverable, the previous native/mock candidate path remains the fallback.
- QA generation now validates/normalizes `QAReportEnvelope` output, keeps compatibility with existing `bindery:qa-json` blocks, and sends one repair prompt before falling back to the existing `run_qa` report path.
- Verified with `npm --workspace apps/desktop run check`, bundled `tests/envelopes.node.test.mjs` and `tests/planning.node.test.mjs` via esbuild, `node --experimental-strip-types tests/styleSystem.node.test.mjs`, `node --experimental-strip-types tests/styleAnalyzer.node.test.mjs`, `python3 -m unittest discover -s tests -v`, `npm run build`, `python3 scripts/verify_static.py`, `bash scripts/verify_ai_pipeline.sh`, and `git diff --check`.

## Completed (2026-07-04, Plan-And-Write 회차/장면 계획 단계)

- Added `EpisodeBrief` and `ScenePlan` as first-class pipeline steps before context/draft, with typed domain models, readable artifacts, embedded JSON blocks, agent-first generation, and local fallbacks when the CLI output is unavailable or invalid.
- Linked planning to `plot/plot-board.json`, `plot/open-threads.md`, previous summaries, manuscript frontmatter characters, and current manuscript excerpts; scene cards carry purpose, goal, conflict, turn, POV, entities, memory requirements, target length, tension, exit hook, and beat labels.
- Made draft generation require both `episode-brief` and `scene-plan` artifacts, so the Plan-And-Write contract is enforced even for single-step or slash-command draft flows.
- Fed the planning artifacts into draft/revise guidance as hard context, into context packs, and into QA prompts as gate criteria for brief/scene-plan compliance.
- Updated Mission Control/run graph automatically through `PipelineStep`, added `/brief` and `/plan` slash-menu entries, updated the AI writing flow document, and added a bundled planning-domain smoke test.
- Verified with `npm --workspace apps/desktop run check`, bundled `tests/planning.node.test.mjs` via esbuild, `node --experimental-strip-types tests/styleSystem.node.test.mjs`, `node --experimental-strip-types tests/styleAnalyzer.node.test.mjs`, `python3 -m unittest discover -s tests -v`, `npm run build`, `python3 scripts/verify_static.py`, `bash scripts/verify_ai_pipeline.sh`, and `git diff --check`.

## Completed (2026-07-03, 리뷰 패치 반영 + 후속 계획 구현)

- Applied the external review patch intent against the current codebase: AI prompts, QA, summary, and prompt preview now use a front/middle/tail manuscript context window instead of only the opening excerpt.
- Made full AI pipeline execution fail fast: action failures and QA `fail` verdicts stop the run before summarize/commit, while preserving the failed report as an artifact.
- Added agent output contract checks for QA JSON blocks, candidate markdown, and final style guidelines; invalid agent output falls back or fails visibly instead of entering review as valid work.
- Hardened the style runtime bridge with a 120-second timeout, temp-file text passing for long scene/style-score input, and cleanup retention for style and agent temp files.
- Reworked artifact storage so localStorage keeps metadata/preview only, while `.bindery/artifacts/` stores full artifact files plus `index.json`.
- Switched writing stats to Korean-friendly 공백 제외 글자 중심 metrics, with sentence and manuscript-page estimates in the editor toolbar.
- Added selection-aware slash command context handoff and drag reorder for plot-board scenes.
- Verified with `npm --workspace apps/desktop run check`, `npm run build`, `cargo fmt --check`, `cargo check`, Python style-system tests, Node style smoke tests, `python3 scripts/verify_static.py`, `bash scripts/verify_ai_pipeline.sh`, and `git diff --check`.

## Completed (2026-07-03, GitHub 게시 준비)

- Prepared repository hygiene for GitHub publishing by excluding local Superloopy state/evidence and personal sample source text from version control.
- Confirmed the repository has no configured GitHub remote yet; publishing still requires GitHub authentication or a manually created remote URL.
- Verified publish-ready state with `git diff --check`, `npm --workspace apps/desktop run check`, `bash scripts/verify_ai_pipeline.sh`, `npm run build`, and `python3 scripts/verify_static.py`.

## Completed (2026-07-03, 작업면 집중도 정리)

- Hid the binder navigator outside the writing screen so AI/materials/export work surfaces are no longer split into duplicate side rails.

## Completed (2026-07-03, AI 작성 파이프라인 문서화)

- Added `docs/AI_WRITING_PIPELINE_FLOW_20260703.md`, a Korean user-flow document explaining `AI 작업` from project open through CLI connection, bible handling, seven pipeline steps, artifact storage, candidate diff/apply, fallbacks, and verification commands.
- Verified the default local AI adapter smoke path with `bash scripts/verify_ai_pipeline.sh` (`AI pipeline adapter smoke: PASS (codex)`).

## Completed (2026-07-03, 문체 시스템 Phase 2 완료)

- Added `novelctl style-sync`: project `styles/` JSON for profiles/presets/stacks/routers/classifications/reports is indexed into `.bindery/style-system.sqlite3`, with `styles/style-repository.json` documenting the sync result.
- Added structured-output schema manifests for SceneClassification correction, paragraph function tags, score explanation, and suggestions; score guards keep local scoring authoritative.
- Expanded Korean surface/NLP analysis with morphology-like counts, action verbs, judgment markers, relationship markers, emotion markers, and manual speaker correction policy.
- Hardened style scoring with feature-based discourse/dialogue/lexical/fluency signals, leakage diagnostics, register mismatch penalties, and overfit/repetition penalties.
- Added the `문체 시스템` UI stage with Preset Manager, Stack Mixer, Router Editor, scene classification override controls, Score Lab, Suggestion Lab, and SkillPack export preview.
- Added SkillPack validation and zip export support, plus reference loading policy, structured schema manifest, Korean marker manifest, and regression fixture files.
- Verified: `python3 -m unittest discover -s tests -v`, `node --experimental-strip-types tests/styleSystem.node.test.mjs`, `node --experimental-strip-types tests/styleAnalyzer.node.test.mjs`, `python3 -m compileall -q packages/novelctl-core/novelctl`, `python3 scripts/verify_static.py`, `npm --workspace apps/desktop run check`, `npm run build`, `cargo fmt --check`, `cargo check`, and Chrome DevTools visual QA at 1280/768/390.

## Completed (2026-07-03, 문체 시스템 패치 적용)

- Applied `bindery_style_system_patched_20260703.zip`: added the structured style runtime, Python CLI style subcommands, local frontend API entrypoints, SceneClassification UI rows, docs, and tests.
- Fixed the analyzer scene segmentation regression: sentence-like blocks separated by blank lines are now grouped into larger scene candidates unless explicit scene separators or headings indicate a hard boundary.
- Added a regression smoke test for the sentence-separated sample case so future changes do not return to one sentence per scene.
- Captured remaining Phase 2 items from `phase2_backlog.md`: SQLite repository/migrations, native Tauri style commands, preset/stack/router manager UI, Korean NLP expansion, LLM structured correction, scoring hardening, and SkillPack validation/zip export.
- Verified: `python3 -m unittest discover -s tests -v`, `node --experimental-strip-types tests/styleSystem.node.test.mjs`, `node --experimental-strip-types tests/styleAnalyzer.node.test.mjs`, `python3 -m compileall -q packages/novelctl-core/novelctl`, `npm --workspace apps/desktop run check`, `npm run build`, `python3 scripts/verify_static.py`.

## Completed (2026-07-03, 문체 시스템 Phase 2 시작)

- Added native Tauri style commands for scene classification, route resolution, PromptCapsule building, style match scoring, and SkillPack export.
- Chose the Phase 2 backend strategy: Rust commands call the Python `novelctl` style runtime first, preserving the deterministic implementation while leaving a future native Rust port optional.
- Updated frontend style API wrappers so Tauri runtime uses native commands when available and falls back to the TypeScript local runtime in browser/mock mode.
- Moved the SQLite schema into `packages/novelctl-core/novelctl/migrations/001_style_system.sql`; `style-sql` now reads the migration-backed schema.
- Verified: `cargo fmt --check`, `cargo check`, `python3 -m unittest discover -s tests -v`, `node --experimental-strip-types tests/styleSystem.node.test.mjs`, `node --experimental-strip-types tests/styleAnalyzer.node.test.mjs`, `python3 -m compileall -q packages/novelctl-core/novelctl`, `npm --workspace apps/desktop run check`.

## Completed (2026-07-03, 패키지 앱 샘플 열기 수정)

- Fixed packaged `.app`/DMG behavior for `sample-project`: the Tauri `open_project` command now seeds a writable sample project under the app data directory when the user opens the default sample path.
- The seeding path only creates missing files, so edits inside the packaged sample are not overwritten on the next launch.
- Verified: `cargo fmt --check`, `cargo check`, `npm --workspace apps/desktop run check`.

## Completed (2026-07-03, UI 정리와 접히는 사이드바)

- Added a topbar sidebar toggle and a 54px collapsed binder rail for `회차`, `파일`, and `설정집`.
- Tightened the studio shell so top tabs, project chips, episode rows, and file nodes keep stable horizontal labels with ellipsis or horizontal scrolling.
- Reworked the `문체` analysis table from nine narrow columns into four durable reading columns (`장면`, `기능`, `수치`, `표층`) with responsive two-column/one-column stacking.
- Verified Chrome visual QA at 1280/768/390: body/app/style-stage overflow 0px, collapsed rail width 54/52px, and no detected narrow multi-line text offenders.

## Completed (2026-07-03, 문체 분석 MVP 절차 흡수)

- Added a local style analyzer domain modeled after `bindery_v3_analyzer_logic_mvp`: input profile, scene records, evidence records, language surface profile, and prompt capsule.
- Reworked the `문체` tab analysis flow so local analysis completes first and AI extraction explicitly receives the local bundle for emotional rhythm, narrative distance, and description texture interpretation.
- Added UI evidence/procedure visibility: MVP step grid, local summary metrics, scene feature table, and evidence candidate list.
- Updated style prompts and offline fallbacks so `F_RULE_###`, globality decisions, and do-not-transfer constraints are included before final guideline generation.
- Verified: `npm --workspace apps/desktop run check`, `npm run build`, `python3 scripts/verify_static.py`, Chrome headless visual QA at 1280/768/390.

## Completed (2026-07-03, A-to-Z pass)

- Episode `회차` tab (create/switch/초고·퇴고·발행), editable plot board persisted to `plot/plot-board.json`, codex item creation UI.
- Agent-based QA and revision plans (fallback preserved); style-compliance gate (banned-term scan) and continuity gate (previous episode summary in QA prompt).
- Artifacts synced to `.bindery/artifacts/`; summarize output fed to `canon/summaries/`.
- Snapshot compare/restore with automatic safety snapshot; project search (⌘⇧F); editor scene jump; daily writing stats.
- Real export: TXT/HTML/EPUB compilation into `exports/` (browser: download). EPUB3 assembled dependency-free (stored-ZIP), verified with `unzip -t`.
- AI drafting parameters (분량/창의성/추가 지시) injected into candidate prompts; style guideline strictness (유연/균형/엄격) with deviation-allowing preambles.
- Verified: svelte-check 0 errors, vite build, cargo check, standalone macOS build, browser click-through (회차 탭, 파라미터→프롬프트 반영, 검색, 내보내기 화면).

## Completed (2026-07-03, 산출물 + 문체)

- Artifact shelf: every pipeline step (context/draft/analyze/qa/revise/summarize/commit) records a per-episode artifact with viewer modal and `집필 반영` badges.
- Guidance injection: `generate_candidate` accepts a guidance block (bible + style guideline + latest artifacts); prompt preview shows the real assembled prompt.
- New `run_agent_text` Tauri command and unified agent CLI runners (stdout/file/codex exec).
- `문체` tab: sample input → per-scene quantitative stats → AI emotional extraction → scene-type rules + banned words/imagery → proof scene not in the source → final guideline saved into the project; offline fallbacks are clearly labeled.
- Verified: svelte-check 0 errors, vite build, cargo check, `npx tauri build --bundles app` success, browser click-through of the full style flow and artifact-fed draft prompt.

## Completed (2026-07-02)

- Rebuilt `AI 작업` as the staged harness: CLI connection (provider/command/output/test/demo), bible detection with template creation or explicit skip, a 7-step pipeline (컨텍스트→초안 후보→표현 분석→QA→수정 계획→요약→기록) with per-step status and prompt preview, and a review stage (candidate diff, QA, revision plan, repetition map).
- Removed AI from the writing surface; editor slash commands only navigate to the harness.
- Merged the old `검토` tab into the harness review stage; export screen now holds only snapshots and job history.
- Moved editor preferences into a `환경설정` modal; AI connection status is a topbar button that jumps to harness stage 01.
- Deleted dead components (`RightDock`, `BuildLadder`, `EpisodeTabs`, `EvidenceSummary`, `AIPanel`, `SettingsPanel`) and mock-only binder content; cleaned orphaned CSS.
- Restored open project (file tree + manuscript) after page reload; fixed job console `\n` rendering.

## Verification

- `npm --workspace apps/desktop run check` — 0 errors
- `npm run build` — success
- `python3 scripts/verify_static.py` — pass
- Browser click-through (Vite dev): start → sample → 집필/자료/AI 작업(4단계, 데모 전체 실행)/내보내기/도움말/환경설정, dark mode, 1024px responsive.

## Known Risks

- Superloopy design-system compliance currently reports broad existing token drift (`off-scale-spacing` and undeclared terminal/status colors). This review pass recorded evidence but did not normalize legacy CSS outside the requested patch scope.
- Windows `.exe`/NSIS output is still unverified on a Windows runner.
- Browser QA verifies the full UI flow with mock data; native Codex CLI is verified at adapter level.
- The build still warns that one Vite chunk is larger than 500 kB.
- Tauri `.app` bundle was not rebuilt after this UI rework (frontend build verified; run `npx tauri build --bundles app` before distributing).
