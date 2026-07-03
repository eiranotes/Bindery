# Tasks

Updated: 2026-07-03 (문체 시스템 Phase 2 시작)

## Done

- [x] Apply `bindery_style_system_patched_20260703.zip` structured style system patch.
- [x] Add deterministic SceneClassification, StyleRouter, StyleStack merge, PromptCapsule, StyleMatchScore, and SkillPack export runtime paths in TypeScript/Python.
- [x] Add `novelctl` style subcommands and local frontend style API entrypoints.
- [x] Add native Tauri style commands backed by the Python `novelctl` style runtime.
- [x] Move the MVP SQLite schema into a real migration file while keeping `style-sql` output compatible.
- [x] Show SceneClassification/register rows in the `문체` analyzer UI.
- [x] Fix scene candidate segmentation so sentence-separated text is grouped instead of treating every sentence-like paragraph as a separate scene.
- [x] Add regression coverage for sentence-separated style samples.
- [x] Fix packaged DMG sample opening by resolving `sample-project` to a writable app-data sample project.
- [x] Add a collapsible left binder sidebar with a compact rail for episode/file/bible navigation.
- [x] Clean up the studio topbar and navigation widths so Korean tab labels do not collapse into vertical text.
- [x] Rework the `문체` analyzer scene table into resilient four-column rows with responsive stacking.
- [x] Verify the polished shell and style analyzer at 1280/768/390 with Chrome visual QA.
- [x] Absorb the `bindery_v3_analyzer_logic_mvp` concept into the active `문체` analyzer: local normalize, segment, feature coding, evidence, globality, surface profile, and prompt capsule before AI interpretation.
- [x] Update style AI prompts so the AI handles semantic/emotional interpretation on top of the local bundle instead of replacing local analysis.
- [x] Show analyzer procedure, local summary, scene feature coding, and evidence records in the `문체` tab.
- [x] Record an artifact for every pipeline step and show a per-episode artifact shelf in the run stage.
- [x] Feed latest artifacts + style guideline into draft/revise candidate prompts (with real prompt preview).
- [x] Add `run_agent_text` Tauri command and unify agent CLI execution paths.
- [x] Build the `문체` tab: scene analysis → style extraction → rules/ban lists → proof scene → final guideline saved to `canon/style-guide.md`.
- [x] Build Tauri macOS `.app` bundle after the changes.
- [x] Write `docs/GAP_ANALYSIS_A_TO_Z_20260703.md`.

## Done (2026-07-03 A-to-Z)

- [x] Episode management: create/switch/status (초고/퇴고/발행) in the binder `회차` tab.
- [x] Real export: TXT/HTML/EPUB compilation into `exports/` (EPUB via dependency-free stored-ZIP builder, verified with `unzip -t`).
- [x] Sync artifacts to `.bindery/artifacts/`; feed summarize output into `canon/summaries/`.
- [x] Editable plot board (`plot/plot-board.json`); codex item creation UI.
- [x] Agent-based QA + revision plans with fallback; style-compliance and continuity gates.
- [x] Snapshot restore/compare with safety snapshot.
- [x] Project-wide search (⌘⇧F) and editor scene jump.
- [x] AI drafting parameters (length/creativity/instructions); style strictness (유연/균형/엄격).
- [x] Standalone macOS build.

## Next

- [ ] Add repository sync between project `styles/` JSON and SQLite.
- [ ] Build Preset Manager, Stack Mixer, Router Editor, scene classification override editor, Score Lab, and Suggestion Lab.
- [ ] Add Korean NLP expansion for morphology, action verbs, judgment markers, relationship markers, emotion dictionaries, and manual speaker correction.
- [ ] Add structured LLM correction schemas for SceneClassification, paragraph function tagging, scoring explanation, and suggestions while keeping local scoring authoritative.
- [ ] Harden scoring with feature-based rhythm/discourse/dialogue/lexical/fluency, content leakage review, and overfit penalties.
- [ ] Add SkillPack validator, zip exporter, reference loading policy, and regression fixtures.
- [ ] Add a user preference to remember the sidebar collapsed state across app launches.
- [ ] Add a native folder picker for `기존 폴더` so users do not need to paste absolute paths.
- [ ] Add manual scene split/merge and evidence confirmation editing for the analyzer.
- [ ] Drag-and-drop scene reordering on the plot board.
- [ ] Automated click-through inside the packaged app; Windows runner validation.

- [x] Rebuild `AI 작업` as a staged harness (연결→바이블→실행→검토) with a live status rail.
- [x] Move AI CLI settings out of the export screen into harness stage `01 연결`.
- [x] Add explicit bible handling: detection, template creation, and `바이블 없이 진행`.
- [x] Remove AI entry points from the writing screen (slash commands only navigate).
- [x] Merge the duplicated `검토` tab into the harness review stage.
- [x] Reduce main tabs to `집필 · 자료 · AI 작업 · 내보내기`; move `도움말`/`환경설정` to the topbar.
- [x] Delete dead components and mock-only binder content; clean orphaned CSS.
- [x] Restore the open project after page reload.

- [x] Add a first-run landing/start screen that clearly separates new project, existing folder, and sample entry.
- [x] Add native project creation for the default manuscript/settings/plot/notes structure.
- [x] Add a separate `도움말` page that explains the end-to-end writing and AI workflow.
- [x] Reduce the start screen's card-button feeling with a quieter line/form-based layout.
- [x] Remove raw project path switching from the writing topbar and route project switching through the start screen.
- [x] Make manuscript writing the main screen.
- [x] Move AI pipeline into a separate `AI 작업` screen.
- [x] Fix Korean menu and visible UI copy.
- [x] Remove text clipping and document-level horizontal overflow across desktop, tablet, and mobile QA widths.
- [x] Verify that AI candidate generation creates reviewable candidates instead of only showing a static flow.
- [x] Verify that QA output appears after pipeline execution.
- [x] Build raw standalone executable.
- [x] Build and open macOS `.app` bundle.

## Next

- [ ] Automate click-through validation inside the packaged Tauri `.app`.
- [ ] Add recent-project metadata: last opened time, current phase, pending candidates, snapshot count.
- [ ] Add richer Muvel-style optional widgets for timer, quick memo, dictionary, and episode reference.
- [ ] Add Pensiv-style graph/canvas view for files, settings, and plot relationships.
- [ ] Validate Windows standalone/installer on a Windows runner.
