# Project Status

Updated: 2026-07-03 (문체 시스템 Phase 2 완료)

## Current State

Bindery is a writing-first macOS/Svelte/Tauri app covering the full local novel workflow: episode management (create/switch/status), writing with scene jump and daily stats, materials (editable plot board, codex item creation), style replication with adjustable enforcement strength, an AI harness whose every step leaves file-synced artifacts that feed drafting (with author-tunable length/creativity/instructions), agent-based QA with style-compliance and continuity gates, snapshot compare/restore, project-wide search, and real TXT/HTML/EPUB export. The shell now has a collapsible left navigator rail, tighter top navigation, and wider resilient analysis rows so dense Korean labels truncate or scroll instead of stacking into vertical text. The style analyzer follows the v3 MVP procedure locally first: normalize input, group scene candidates, code local features, generate evidence, apply globality decisions, build a surface profile, then hand semantic interpretation to the configured AI runner only where local regex analysis is insufficient. The structured style runtime now includes repository sync, deterministic SceneClassification, StyleRouter, StyleStack merge, PromptCapsule, feature-based StyleMatchScore, Korean surface analysis, structured-output guards, and validated SkillPack export paths in TypeScript and Python. Storage is local-only by design; `styles/` JSON is the editable source and SQLite is the query/index cache.

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

- Windows `.exe`/NSIS output is still unverified on a Windows runner.
- Browser QA verifies the full UI flow with mock data; native Codex CLI is verified at adapter level.
- The build still warns that one Vite chunk is larger than 500 kB.
- Tauri `.app` bundle was not rebuilt after this UI rework (frontend build verified; run `npx tauri build --bundles app` before distributing).
