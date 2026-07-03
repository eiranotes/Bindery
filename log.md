# log.md — Stage 3 Work Log

## 2026-07-03 Style System Patch

- Inspected `bindery_style_system_patched_20260703.zip` and confirmed it adds a structured style runtime, Python CLI style subcommands, frontend local API entrypoints, SceneClassification UI rows, tests, and documentation.
- Applied the patch code/docs/tests while preserving existing project status history.
- Checked the reported scene segmentation issue and confirmed the archive itself did not fix it: current and patched `styleAnalyzer.ts` both mapped every paragraph candidate to a scene record.
- Fixed `paragraphCandidates()` so explicit separators/headings remain hard scene boundaries, while short sentence-like blocks are grouped into larger scene candidates.
- Added `tests/styleAnalyzer.node.test.mjs` to cover text pasted with blank lines after every sentence.
- Updated `docs/PROJECT_STATUS.md`, `docs/TASKS.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md`, and `docs/STYLE_ANALYSIS_METHOD.md`.
- Verification passed: Python unittest, TypeScript style smoke, scene grouping smoke, Python compileall, Svelte check, production build, and static project verification.

## 2026-07-03 Style System Phase 2 Start

- Added Tauri native commands: `classify_style_scene`, `resolve_style_route`, `build_prompt_capsule`, `score_style_match`, and `export_style_skill_pack`.
- Native commands call the Python `novelctl` style runtime and return the CLI JSON `data` payload; development fallback locates the repo-local CLI when `novelctl` is not installed.
- Frontend style API wrappers now try native Tauri commands when a `projectPath` is supplied and fall back to the TypeScript runtime in browser/mock mode.
- Moved the SQLite style schema from an inline Python constant into `packages/novelctl-core/novelctl/migrations/001_style_system.sql`.
- Added tests confirming `SQLITE_SCHEMA` and `novelctl style-sql` read the migration-backed schema.
- Verification passed: cargo fmt/check, Python unittest, TypeScript style smoke, scene grouping smoke, Python compileall, and Svelte check.

## 2026-07-01

- Unpacked `bindery design v0.2`.
- Confirmed original archive already includes Stage 1/2 planning artifacts.
- Added Stage 3 implementation scaffold.
- Created monorepo structure under `bindery/`.
- Added SvelteKit/Tauri app shell.
- Added static browser prototype for immediate UI validation.
- Added Python `novelctl` mock/core commands.
- Added Rust Tauri commands for project, file, novelctl, snapshot, git, repetition analysis.
- Added Windows NSIS bundling config.
- Added docs: README, USAGE, implementation notes, benchmark, plan/state/log.
- Added sample project with episode/canon/plot/notes files.

## Validation log

Validation results are also written to `BUILD_REPORT.md` after running scripts.

## 2026-07-01 Validation Update

- `npm install --ignore-scripts` completed.
- `npm --workspace apps/desktop run check` passed with 0 errors / 0 warnings.
- `npm run build` passed.
- `bash scripts/browser_smoke.sh` passed and wrote `browser-smoke.png`.
- `python3 scripts/verify_tauri_static.py` passed.
- Tauri native build remains pending because Cargo/Rust is not installed in this container.

## 2026-07-01 Stage 3.5 — UI/UX feature layer

Enhanced browser/Svelte mode from scaffold to a working evidence-first IDE.

### Added domain layer (`apps/desktop/src/lib/domain/`)
- `frontmatter.ts` — dependency-free YAML frontmatter reader with source ranges.
- `reports.ts` — QA parser (qa-json block + table fallback), revision-plan parser, repetition distribution.
- `diff.ts` — LCS line diff + hunk grouping + `applyHunk` incremental apply.
- `codex.ts` — alias-trie Dynamic Link scan with confidence scoring, masked regions.
- `plot.ts` — Plot Grid model + subplot-gap / tension-flatline / repeated-beat warnings.

### Added CodeMirror extensions (`apps/desktop/src/lib/editor/`)
- frontmatter badge + dim, dynamic mention decoration + hover card, repetition decoration,
  qa lint diagnostics, wikilink completion + AI command menu, wordcount StateField, theme.
- Data pushed into the editor via StateEffects (IME-safe, recompute on transaction).

### Added components
- CandidateDiffPanel + DiffView (A/B, unified/split, per-hunk + apply-all, snapshot-before-apply).
- Enhanced QADashboard (gate grid, issue list, jump-to-line, add-to-revision, mark false positive).
- Enhanced RepetitionPanel (distribution heat strips), RevisionPanel, CodexPanel, PlotGridPanel.
- Tabbed RightDock (Evidence/Codex/Plot/Crew), ToastHost, Binder Files/Codex tabs, center Editor↔Diff switch.
- Action layer `$lib/actions/pipeline.ts` centralizes store-driving pipeline steps.

### API / backend
- 6 new commands wired with getInvoke() native + mock fallback; interfaces documented in
  `design_v0.2/implementation/backend/stage3_5_new_commands.md`. Tauri Rust bridge left as the only TODO.

### Validation
- `npm --workspace apps/desktop run check` → 0 errors / 0 warnings.
- `npm run build` → PASS.
- Domain unit tests (diff/codex/reports/frontmatter) → PASS.
- Playwright E2E against the real preview build → 17/17 flows pass, 0 console errors.
- Screenshots captured for editor, QA, candidate diff, codex, plot states.

## 2026-07-01 Stage 3.6 — Native Bridge Hardening

Applied the full correction set raised after reviewing Claude's Stage 3.5 archive.

### Native bridge parity
- Added Rust command registrations for Stage 3.5 frontend calls:
  `run_qa`, `generate_revision_plan`, `generate_candidate`, `list_codex`,
  `scan_codex_links`, `get_plot_grid`.
- Added deterministic native stubs so a real Tauri runtime does not fail with
  `unknown command` when these UI flows are triggered.

### Project-root relative path API
- Changed frontend API contracts to use `projectPath + relativePath` for file IO:
  `readFile(projectPath, relativePath)`, `writeFile(projectPath, relativePath, content)`,
  `analyzeRepetition(projectPath, relativePath)`.
- Updated Binder, EpisodeTabs, EditorToolbar, and pipeline analysis actions.
- Added Rust `path_utils.rs` with root anchoring, absolute-path rejection,
  parent traversal rejection, canonical project-root escape checks.

### Candidate safety
- Added `sessionSnapshotId` to `candidateStore`.
- `applyAll` and `applyOneHunk` now share `ensureSessionSnapshot()`.
- Per-hunk apply now snapshots before the first mutation in the review session.
- `appliedHunks` is updated after hunk apply and passed into `DiffView`.
- `DiffView` displays applied hunks as disabled `적용됨` when no revert handler exists.

### Evidence/fallback reporting
- `run_novelctl` no longer reports command-spawn failure as success.
- Unavailable native `novelctl` returns `ok:false`, `mode:"unavailable"`, and stderr evidence.

### Validation
- `python3 scripts/verify_static.py` → PASS.
- `python3 scripts/verify_tauri_static.py` → PASS.
- `npm install --ignore-scripts` → PASS.
- `npm run build` → PASS.
- `npm --workspace apps/desktop run check` → PASS, 0 errors / 0 warnings.
- `bash scripts/browser_smoke.sh` → PASS.
- Tauri native build remains pending because Rust/Cargo is not installed in this container.

## 2026-07-02 Stage 3.7 — Design Elevation + Feature Port + Gap Review

Base: ChatGPT Stage 3.6 archive (native stubs, relative-path API, session-snapshot apply) — all preserved.

### Ported (adapted to new projectPath+relativePath API)
- Real-text analyzer `domain/analysis.ts` (word/ending modes; crutch/dialogue-tag/AI-cliché detection; count-first judging; position dedupe). `runAnalyzeAction(mode?)` now analyzes the open document client-side.
- Focus / Typewriter / Zen writing modes (`editor/focus.ts`, `writingModeStore`), session word goal + progress bar, autosave + Cmd/Ctrl+S, Command Palette (Cmd/Ctrl+K).
- Cached mention scan (ViewPlugin single scan reused by hover; skip during IME composition; 60k-char cutoff).

### Design elevation (app.css token rewrite + component pass)
- Layered surfaces (bg/bg-1/bg-2/bg-desk), refined lines, thin themed scrollbars, focus-visible rings, prefers-reduced-motion.
- Button hierarchy inverted: quiet default, `.primary` reserved for Open Project / Run pipeline / 전체 적용 / 수정 반영.
- Signature: lamplit manuscript surface (warm radial glow on editor/preview), serif 16px/2.0, 70ch measure.
- Eyebrow label voice for section headers; refined TopBar status chips + ⌘K hint; dock tab entrance micro-motion.

### Validation
- svelte-check 0 errors / 0 warnings; npm run build PASS.
- Playwright E2E on real preview build: 17/17 flows PASS, 0 console errors (incl. analyzer decorations matching live text, focus/zen/goal/palette, Ctrl+S).
- Per-screen mockup screenshots captured (editor / evidence / diff / codex / plot / focus / zen / palette).

### Gap review
- Doc↔code audit recorded in `docs/GAP_REVIEW_stage3_7.md` with remaining roadmap (manual link insert, Plot Board/Canvas, Progressions, prompt preview, worker scan, native cargo build).

## 2026-07-02 Stage 3.8 — Muvel/Pensiv-inspired Redesign + Roadmap Items

### Design system (light-first, referenced 뮤블/펜시브)
- Principle adopted from Muvel: "글 쓸 때 시야에 들어올 필요 없는 모든 걸 치운다".
- Theme system: `themeStore` + `[data-theme]` tokens; LIGHT default (warm paper #f4f2ee, low-contrast chrome), dark retained; toggle in TopBar; flash-free bootstrap in app.html; CodeMirror light/dark theme pair swapped via Compartment.
- Hardcoded colors swept to semantic vars across 14 components (--hover/--chip/--pop/--accent-soft/--ok-soft…).
- CTA reduction: quiet default buttons, exactly ONE `.primary` per screen (프로젝트 열기 → 파이프라인 실행 → 전체 적용 → 이 프롬프트로 실행).
- Center = pure manuscript: pipeline bar removed from editor column; view seg(본문/분할/미리보기) + word count + ⋯ overflow menu (저장/스냅샷/포커스/타자기/Zen/줄번호/세션 목표).
- Right dock tabs Koreanized + AI tab added as default: pipeline steps as described list rows.

### Roadmap items implemented
- Prompt preview: `domain/prompt.ts` assembles step prompt (metadata + relevant codex + manuscript head); 👁 per step opens modal with "이 프롬프트로 실행".
- Codex Progressions: type + mock + per-entry episode timeline in 설정집 panel.
- Dead component removed (EpisodePipelineBar).

### Validation
- svelte-check 0/0, build PASS.
- Playwright E2E 18/18, 0 console errors — incl. light default, theme toggle, prompt preview content, progressions expand, overflow-menu focus/zen, link insert.
- Light/dark per-screen screenshots captured (10).

## 2026-07-02 Stage 3.9 — Competitive Analysis Response + Hardening

- Competitive analysis vs 뮤블/펜시브: docs/COMPETITIVE_ANALYSIS_stage3_9.md (기능/UX/폰트/AI 하네스, 우위·부족·계획).
- Muvel-benchmark editor conveniences: smartQuotes(pair+Enter escape), autoReplace(—/→/…), `//` writer-comment dim — settings-gated, IME-safe (inputRules.ts).
- Manuscript typography settings: serif/gothic preset + 13–22px size via CSS vars (editor+preview 동기).
- Wiring/hardening: mockMode→getInvoke gate; novelctlPath→run_novelctl(TS+Rust, echo 포함); createSnapshot content param(TS+Rust) — candidate/manual snapshot이 에디터 버퍼 기준; scan_codex_links content param(TS+Rust); MarkdownPreview DOMPurify.
- Test assets: tests/e2e_playwright.py in repo(exit code, smart-quote check); scripts/browser_smoke.sh → 실제 preview 대상.
- Docs: BUILD_REPORT 재작성(검증/미검증 정밀 표), DEPLOY_CSP.md, README/state/plan 정리.
- Verified: check 0/0 · build PASS · domain unit PASS · smoke(E2E 19/19, 0 errors).
- Not verified(환경): cargo 컴파일, Tauri invoke 왕복, NSIS — BUILD_REPORT 명시.

## 2026-07-02 Stage 3.11 — Runtime Readiness, Manual, Naming Pass

- Mock mode default changed from ON to OFF in `settingsStore`.
- TopBar now shows `MOCK OFFLINE` when Mock mode is enabled.
- SettingsPanel now labels Mock mode as 기본 OFF and explains browser mock behavior.
- Added `From<serde_json::Error>` to Rust `AppError` for snapshot metadata serialization readiness.
- Updated desktop `check` script to run `svelte-kit sync` before `svelte-check`.
- Updated Playwright E2E launcher so `CHROME_PATH` is optional rather than hardcoded to `/opt/...`.
- Added smoke-test diagnostics: preview URL, Chrome mode, preview log tail on failure.
- Added full operational manual: `docs/OPERATION_MANUAL.md`.
- Added temporary-name replacement ideas: `docs/NAME_IDEAS.md`.
- Updated README/USAGE/BUILD_REPORT/plan/state for Stage 3.11.
- Scope intentionally limited: no new product features beyond requested defaults/manual/minimal hardening.


## Stage 3.11 — Bindery naming + code review pass

- Renamed visible product branding from temporary Bindery predecessor to `Bindery`.
- Updated Tauri productName/title/identifier/publisher and package metadata.
- Added localStorage fallback from old settings/theme keys to new `bindery-*` keys.
- Patched SnapshotPanel to snapshot live editor buffer content.
- Removed `ep001` hard-code from AIPanel novelctl calls.
- Made Run All execute all configured pipeline steps.
- Improved Repetition Map heatmap bucket navigation.
- Added `CODE_REVIEW.md` with frontend/backend wiring review and remaining efficiency/stub notes.

## 2026-07-02 Standalone Build + Superloopy UI Planning Pass

- Installed npm dependencies.
- Fixed Tauri Cargo layout by adding `apps/desktop/src-tauri/src/lib.rs` and making `main.rs` call `novel_studio_lib::run()`.
- Verified `npm --workspace apps/desktop run check` with 0 errors and 0 warnings.
- Verified `npm run build`.
- Verified `cargo check`.
- Built macOS standalone executable:
  `apps/desktop/dist-standalone/Bindery_0.3.0_arm64-standalone`.
- Smoke-ran the standalone executable and confirmed it stayed alive for 5 seconds with empty stdout/stderr, then stopped it.
- Researched Pensiv and Muvel official references for UI/UX direction.
- Added root `DESIGN.md`.
- Added `docs/UI_IMPROVEMENT_PLAN_20260702.md`.
- Captured Superloopy visual QA at 390, 768, and 1280 px under
  `.superloopy/evidence/frontend/20260702-bindery-pensiv-muvel/`.
- Recorded current design gap: functional preview passes, but purple accent, hero-card landing, emoji icon, and mobile ladder truncation need Phase 1 cleanup.

## 2026-07-02 UI Implementation + AI Pipeline Adapter Pass

- Replaced purple primary/dark plot accent with teal/warm design tokens.
- Removed the dark-tinted topbar background in light mode.
- Reworked My Books from a centered hero card into a local-first book queue.
- Compactified the Book Build Ladder and renamed the visible `Pensive-style` label.
- Replaced emoji theme control with a CSS icon control.
- Set Tauri window config to explicitly keep `resizable` and `decorations` enabled.
- Changed default AI provider to Codex CLI.
- Added Codex-specific native candidate adapter using `codex exec --output-last-message`.
- Added `scripts/verify_ai_pipeline.sh`.
- Added `docs/AI_PIPELINE_VALIDATION_20260702.md`.
- Verified `bash scripts/verify_ai_pipeline.sh` passes with Codex.
- Verified Gemini headless prompt is blocked by current account/client policy, Claude fails 401, and `agy` is unavailable.
- Captured Superloopy visual QA under `.superloopy/evidence/frontend/20260702-bindery-ui-implementation/`.

## 2026-07-03 21:40 KST — Style System Phase 2 Completion Pass

- Completed remaining `phase2_backlog.md` items: `style-sync`, JSON-to-SQLite repository policy, Phase 2 style-system UI, Korean surface/NLP dictionaries, structured-output schemas/guards, feature-based scoring hardening, SkillPack validator, zip export, reference policy, and regression fixtures.
- Added `StyleSystemPanel.svelte` for Preset Manager, Stack Mixer, Router Editor, Scene Override, Score Lab, Suggestion Lab, and SkillPack export preview.
- Added/expanded regression coverage for repository sync, Korean surface report, scoring diagnostics, SkillPack validation, and SkillPack zip contents.
- Final checks passed: Python unittest, TypeScript style smoke, scene grouping smoke, Python compileall, static verification, Svelte check, production build, Rust fmt/check, and Chrome DevTools visual QA at 1280/768/390.

## 2026-07-02 Writing-First UI + Pipeline Verification Pass

- Used Superloopy frontend workflow for the visual pass.
- Re-checked Pensiv and Muvel references from web sources.
- Reworked navigation into `작성`, `AI 작업`, `자료`, `검토`, `내보내기`.
- Made project open select `manuscript.md` and land in `작성`.
- Removed the always-visible AI right dock from the main writing shell.
- Moved AI execution/candidate comparison/QA/revision/evidence into `AI 작업`.
- Koreanized visible controls across settings, snapshots, execution log, QA, codex, plot board, and candidate review.
- Fixed mobile frame width overflow after Playwright detected a 435px app frame at 390px viewport.
- Browser QA result: 1440/1024/390 all 0 clipping findings; candidate and QA generated; active tab stayed `AI 작업`.
- Rebuilt raw standalone and `.app`; opened `.app` successfully.
