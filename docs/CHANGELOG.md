# Changelog

## 2026-07-04 (Plan-And-Write 회차/장면 계획 단계)

- Added two planning steps before drafting: `회차 브리프` creates an EpisodeBrief from plot board/open threads/previous summary/manuscript context, and `장면 계획` turns that brief into scene cards with purpose, conflict, turn, POV, memory requirements, target length, tension, and exit hook.
- Planning artifacts are saved like other pipeline outputs (`.bindery/artifacts/{episode}/episode-brief.md` and `scene-plan.md`) with embedded JSON blocks and readable Markdown; agent output is used when valid, otherwise clearly labeled local fallbacks are generated.
- Draft generation now refuses to run until both planning artifacts exist, then injects them as hard guidance into draft/revise prompts. Context packs and QA prompts also include the brief and scene plan as plan-compliance criteria.
- The AI pipeline now shows 9 steps in the run surface and Mission Control; `/brief` and `/plan` slash-menu entries hand off to the AI 작업 surface.

## 2026-07-04 (AI 미션 컨트롤 + run 기록)

- Added the AI 미션 컨트롤 full-screen workspace (`작업실 → AI 파이프라인 → 미션 컨트롤`): left pipeline graph with per-step run buttons and run history, a large center viewer with 산출물/프롬프트/컨텍스트/검토 tabs, and a right inspector for run settings, risks (QA verdict, failed steps, candidates), and the human decision log.
- Pipeline executions are now recorded as runs: each run gets a `runId`, a settings snapshot, per-step status/artifact links, and human decisions (run-all, apply-all, apply-hunk, discard, reset), persisted to `.bindery/runs/{runId}/run.json` and `.bindery/runs/index.json`, and restored as history when the project reopens.
- Draft/revise prompt guidance sections now carry hardness (규칙/지향/참고), source IDs, and token estimates; the 컨텍스트 tab shows exactly what will enter the prompt and how heavy it is.
- Draft candidate generation now honors the 환경설정 후보 수 (1–4): the agent path is called again with a variation directive until the target count is reached, and candidates are relabeled 후보 A–D.

## 2026-07-03 (리뷰 패치 반영 + 후속 계획 구현)

- AI prompt preview, QA, and summary now include front/middle/tail manuscript context windows so long episodes do not lose late-scene turns and hooks.
- Full pipeline execution now stops on action failure or QA `fail` verdict before summary/record steps.
- QA, draft candidate, and final style guideline outputs now pass lightweight contract checks before entering the app flow.
- Style CLI execution now has a 120-second timeout, passes long text through temp files, and cleans old temp files.
- Style banned-term parsing now handles inline lists, bullets, tables, quotes, backticks, and parenthetical notes more reliably.
- Repetition highlights refresh only when the analysis report changes, reducing editor keystroke work on long drafts.
- Artifact storage now writes full files plus `.bindery/artifacts/index.json`; localStorage keeps preview metadata only.
- Writing stats now prioritize Korean 공백 제외 글자, with sentence count and manuscript-page estimates in the editor.
- Editor slash commands now carry selected text or cursor-near context into the AI draft prompt, and plot-board scene rows can be reordered by drag.

## 2026-07-03 (작업실 재편 + 카드 평탄화)

- Reduced the top navigation from five tabs to three (`집필 · 자료 · 작업실`); `문체`/`AI`/`내보내기` now live under one `작업실` surface with a slim sub-nav, keeping the AI and style tools as separate screens without top-tab clutter.
- Flattened the materials, export, and help surfaces: removed rounded card nesting in favor of hairline-divided full-width sections, aligned with the Pensive/Muvel calm-surface direction and the DESIGN.md anti-card-nesting lock.

## 2026-07-03 (파이프라인 갭 마감)

- Made the AI pipeline `컨텍스트`/`요약`/`기록` steps produce real output instead of fixed novelctl stubs: context assembles the previous-episode summary, manuscript-detected codex items, and open threads; summarize calls the agent (with an offline fallback) and feeds `canon/summaries/{ep}.md`; commit creates a real snapshot with a journal artifact.
- Scored draft candidates against the active style preset and showed the StyleMatch score in the candidate review panel.
- Injected the structured PromptCapsule (scene-routed style rules) from `문체 시스템` into the draft/revise prompt guidance.

## 2026-07-03 (GitHub 게시 준비)

- Ignored local Superloopy state/evidence and ad hoc source-text samples so they are not accidentally included when publishing the repository.

## 2026-07-03 (작업면 집중도 정리)

- Hid the binder navigator outside the writing screen so AI/materials/export work surfaces use a single focused layout.

## 2026-07-03 (AI 작성 파이프라인 문서화)

- Added `docs/AI_WRITING_PIPELINE_FLOW_20260703.md`, explaining the current Korean AI writing pipeline from project open, CLI connection, bible handling, seven execution steps, artifact storage, candidate review/apply, fallback behavior, and verification commands.

## 2026-07-03 (문체 시스템 Phase 2 완료)

- Added `novelctl style-sync` for syncing project `styles/` JSON into `.bindery/style-system.sqlite3` with a `styles/style-repository.json` summary.
- Added the `문체 시스템` stage with Preset Manager, Stack Mixer, Router Editor, Scene Override, Score Lab, Suggestion Lab, and SkillPack export preview.
- Expanded Korean style analysis with deterministic surface counts for morphology-like endings/particles, action verbs, judgment markers, relationship markers, emotion markers, and manual speaker correction policy.
- Hardened StyleMatch scoring with feature-based discourse, dialogue, lexical, fluency, leakage, register mismatch, and overfit diagnostics.
- Added structured-output schema manifests and guards so LLM correction/suggestion output cannot set the authoritative local score.
- Added SkillPack validator, zip export path, reference loading policy, Korean marker manifest, structured schema manifest, and regression fixture files.

## 2026-07-03 (문체 시스템 Phase 2 시작)

- Added native Tauri style commands for `classify_style_scene`, `resolve_style_route`, `build_prompt_capsule`, `score_style_match`, and `export_style_skill_pack`.
- Frontend style API wrappers now try native Tauri commands first and fall back to the local TypeScript runtime in browser/mock mode.
- Moved the SQLite style schema into `packages/novelctl-core/novelctl/migrations/001_style_system.sql`; `novelctl style-sql` continues to emit the migration-backed schema.

## 2026-07-03 (문체 시스템 패치 적용)

- Applied the structured style system patch: deterministic scene classification, style routing, stack merge, prompt capsule, scoring, SkillPack export, Python CLI subcommands, frontend local API entrypoints, docs, and tests.
- Added SceneClassification/register rows to the `문체` analyzer so the local scene bundle now feeds a clearer primary/secondary/register view.
- Fixed scene candidate segmentation: pasted text with blank lines after every sentence is grouped into larger scene candidates instead of producing one scene per sentence-like block.
- Added regression coverage for the sentence-separated sample case.

## 2026-07-03 (패키지 앱 샘플 열기 수정)

- Fixed `.app`/DMG sample project opening: `sample-project` now resolves to a writable app-data sample project in packaged builds instead of a repo-relative path.
- The packaged sample project seeds only missing files, so user edits are not overwritten on later launches.

## 2026-07-03 (UI 정리와 접히는 사이드바)

- Added a topbar sidebar toggle and compact binder rail so the left project navigator can collapse while keeping `회차`, `파일`, and `설정집` reachable.
- Cleaned up the studio shell widths: top tabs, project chips, file nodes, and episode rows now use stable no-wrap labels, ellipsis, or horizontal scrolling instead of cramped vertical text.
- Reworked the `문체` scene analysis table into four readable columns (`장면`, `기능`, `수치`, `표층`) with responsive tablet/mobile stacking.
- Added Chrome visual QA evidence for 1280/768/390 widths covering collapsed sidebar behavior, style analyzer overflow, and narrow text wrapping checks.

## 2026-07-03 (문체 분석 MVP 절차 흡수)

- Reworked the `문체` analyzer around a local-first MVP procedure: input normalization, paragraph scene segmentation, scene feature coding, evidence generation, globality decisions, language surface profile, and prompt capsule generation now happen locally before AI analysis.
- Added structured local analyzer records for scene types, pacing, paragraph closing devices, dialogue stats, emotion handling, surface features, `F_RULE_###` evidence, and prompt capsule rules.
- Updated the `문체` tab to show the procedure status, local summary metrics, scene feature table, and evidence candidates before the AI extraction step.
- Updated style extraction, guide, proof, and final guideline prompts so AI uses the local analyzer bundle as evidence and only fills semantic/emotional interpretation gaps.
- Offline fallback outputs now include local evidence and prompt capsule information instead of only simple averages.

## 2026-07-03 (A-to-Z 갭 해소)

- Episode management: binder gains a `회차` tab with per-episode status (초고/퇴고/발행), one-click episode switching, and `+ 새 회차` scaffolding (`story/chapters/epNNN/`).
- Plot board editing: scene add/delete, title/tension/beat cell editing, saved to `plot/plot-board.json` (loaded back on refresh).
- Codex item creation: `+ 새 항목` form writes typed templates into `characters/`, `world/`, `canon/`, `lore/`.
- Real QA: `QA` step now runs the configured agent CLI with a gate-scoring prompt (fallback to the previous file/native report); revision plans are generated from actual QA issues.
- Style-compliance gate: banned terms from the confirmed style guideline are scanned client-side and merged into QA issues; continuity gate feeds the previous episode summary into the QA prompt.
- Artifacts are now synced to `.bindery/artifacts/{episode}/{step}.md`; `summarize` output is fed back into `canon/summaries/{ep}.md` (auto-detected as bible).
- Snapshot restore & compare: diff modal against the current manuscript plus one-click restore with an automatic before-restore safety snapshot.
- Real export: TXT/HTML/EPUB compilation (all episodes or current) into `exports/` (browser: download); frontmatter stripped automatically. EPUB3 is assembled dependency-free as a stored-ZIP container (new `write_file_hex` command for binary output), integrity-verified with `unzip -t`.
- Writing stats: daily written-word bars (last 7 days) recorded at save time.
- Project-wide search modal (⌘⇧F) across Markdown files with jump-to-line; scene jump dropdown in the editor toolbar.
- AI drafting parameters: target length, creativity (보수적/균형/과감), and free-form author instructions are injected into candidate prompts.
- Style flexibility: guideline enforcement strength (유연/균형/엄격) controls the preamble injected with the style guide, and guideline generation now phrases rules as ranges with explicit deviation allowances.

## 2026-07-03 (산출물 체계 + 문체 재현)

- Every pipeline step now records an artifact (context pack, draft candidates, expression analysis, QA report, revision plan, summary, commit log) into a per-episode artifact shelf shown in the `03 실행` stage.
- Draft/revise candidate prompts now automatically include writing guidance assembled from the latest artifacts and the style guide; the prompt preview shows the real assembled prompt.
- Added the `문체` (style replication) tab: paste a sample → per-scene quantitative analysis (sentence length, dialogue ratio, emotion-word density, ending habits, inversion) → AI extracts the emotional layer (breathing, temperature, narrative distance) → scene-type writing rules with banned words/banned imagery → a proof scene that does not exist in the source → a final style guideline saved to `canon/style-guide.md` and fed into draft prompts. Quantitative values are treated as reference ranges, never copy targets; reusing source sentences is forbidden by the prompts.
- Added a generic `run_agent_text` Tauri command; candidate generation accepts a `guidance` block; agent CLI runners were unified (stdout / file / codex exec).
- Offline/demo mode generates clearly-labeled fallback style documents from the quantitative analysis so the flow works without a CLI.
- Added `docs/GAP_ANALYSIS_A_TO_Z_20260703.md` covering remaining gaps (episode management, plot board editing, real export, snapshot restore, etc.).

## 2026-07-02 (UI 하네스 개편)

- Reworked the top navigation to four Korean tabs: `집필`, `자료`, `AI 작업`, `내보내기`; `도움말` and `환경설정` moved to the topbar.
- Rebuilt `AI 작업` as a staged harness: `01 연결` (CLI provider, command, output mode, test, demo mode) → `02 바이블` (detect setting bible, create template, or explicitly proceed without one) → `03 실행` (7-step pipeline with per-step status, prompt preview, and connected step rail) → `04 검토` (candidate diff, QA, revision plan, repetition map).
- Removed all AI entry points from the writing screen; editor slash commands now only navigate to the AI harness.
- Merged the old `검토` tab into the AI harness review stage, removing duplicated panels.
- Removed mock-only binder content (fake progress meter, hardcoded episode list) and dead components (`RightDock`, `BuildLadder`, `EpisodeTabs`, `EvidenceSummary`, `AIPanel`, `SettingsPanel`).
- Added an `환경설정` modal for editor preferences (font, size, autosave, line numbers, mentions, smart input).
- Restored the open project (file tree and manuscript) after a page reload.
- Fixed the literal `\n` rendering in the job console.

## 2026-07-02

- Added a project-first start screen for creating a new work, opening an existing folder, or loading the sample project.
- Added native project creation that writes the initial manuscript, setting bible, plot, notes, and `.novelctl/config.yaml`.
- Added a separate `도움말` screen for the full writing, AI, review, and export workflow.
- Simplified the studio topbar by moving project switching back to the start screen.
- Refined the start UI away from card-like launcher buttons toward a quieter Pensiv-style line/form layout.
- Reworked Bindery into a writing-first studio with `작성` as the main screen.
- Split AI generation and review into the separate `AI 작업` screen.
- Added top-level Korean navigation: `작성`, `AI 작업`, `자료`, `검토`, `내보내기`.
- Koreanized visible controls and panels across settings, snapshots, job logs, QA, codex, plot board, and candidate review.
- Fixed mobile and desktop text clipping/overflow found during visual QA.
- Made candidate generation stay in `AI 작업` and show candidate comparison plus QA output.
- Rebuilt macOS raw standalone executable and launchable `Bindery.app`.
- Verified Codex CLI AI adapter smoke path.
