# Tasks

Updated: 2026-07-04 (AI project pipeline flow documentation)

## Done (2026-07-04 AI project pipeline flow documentation)

- [x] Document the current project-start to episode-run AI pipeline with explicit branches for `통합 문서`/bible-backed starts and bible-less starts.
- [x] Map the 9 implemented episode pipeline steps, their execution mode (Hybrid/Static), inputs, outputs, stop conditions, and artifact/run storage paths.
- [x] Separate implemented behavior from planned gaps: bible-to-multi-episode outline generation, candidate-target QA, baseline candidate diff, live CLI telemetry, and explicit fixed episode status.

## Next (AI pipeline observability + UX cleanup)

- [ ] Add `PipelineTarget` so full-run execution explicitly records single episode vs episode range, manuscript path, baseline hash, candidate count, and plot/outline basis.
- [ ] Add `RunEvent` streaming persistence under `.bindery/runs/{runId}/events.ndjson` for CLI spawn, stdout, stderr, file-output polling, schema repair, usage reporting, artifact writes, heartbeat, finish, and failure events.
- [ ] Add `StepUsage` summaries to `run.json` and `.bindery/runs/{runId}/usage.json`, including duration, output mode, prompt/output chars, token counts, token source label, estimated cost when available, timeout, exit code, and repair attempts.
- [ ] Add `AgentModelConfig` to settings so AI Runner can choose `CLI default` or an explicit provider model, with custom model argument templates for custom providers.
- [ ] Pass selected model data through `run_agent_text`, `generate_candidate`, streaming events, run settings, usage summaries, and artifacts.
- [ ] Show provider/model/output mode in AI 작업, Mission Control, live logs, and run history.
- [ ] Add a streaming-capable native/Tauri agent command path while keeping the existing final-result command as a compatibility fallback.
- [ ] Add Mission Control live execution UI: elapsed time, latest event, provider/mode, no-output waiting state, retry/repair state, usage label, and a log tab.
- [ ] Add per-step execution source badges so every pipeline step declares Static, AI, Hybrid, or Fallback, plus the actual mode used in the latest run.
- [ ] Add `CandidateReviewSession` so candidate diffs compare generation baseline to candidate by default and warn when current editor content differs.
- [ ] Add `QATarget` and target-aware QA buttons for current editor, selected candidate, baseline, and applied mixed content.
- [ ] Persist QA target metadata in run records and QA artifacts, including candidate id/session/hash when candidate QA is used.
- [ ] Split QA findings into static evidence and AI judgment, with deterministic POV/first-person evidence required before fail severity.
- [ ] Add bible/source based episode-outline proposal generation before EpisodeBrief, with explicit episode count/range and approval before writing plot-board rows.
- [ ] Rename or clarify `전체 실행` semantics so it cannot imply all episodes unless a range target is selected.
- [ ] Audit AI 작업, Mission Control, Candidate Review, Plot Board, Preferences, and Materials for nested-card/text-card slop and flatten them into tables, rails, inspectors, and disclosure rows.
- [ ] Verify model-setting migration, provider/custom model argument construction, streaming, usage, baseline diff, QA target selection, POV false-positive guards, and anti-slop UI changes with unit tests, mock streaming tests, Svelte check, build, and browser visual QA at 390/768/1280.

## Done (2026-07-04 Pipeline source clarity + workspace UI fixes)

- [x] Keep the writing editor visible when returning to `본문` from preview by preserving the CodeMirror host across mode changes.
- [x] Let plot-board beat descriptions wrap cleanly and use a multi-line beat editor.
- [x] Collapse Codex link-scan results by default and provide an explicit close action for the scan panel.
- [x] Show first-run `통합 문서` output destinations before project creation.
- [x] Fix preferences modal size so internal sections scroll without changing the outer dialog frame.
- [x] Show AI pipeline input basis and artifact availability in the run screen and Mission Control.
- [x] Include source-intake, setting bible, cast inbox, organizations, open threads, and Codex summaries in EpisodeBrief/ScenePlan planning prompts.

## Done (2026-07-04 Standalone startup project + MEDALLION seed — feat/ai-mission-control)

- [x] Add a startup project bootstrap so standalone/Tauri launches can open a real project folder from `BINDERY_START_PROJECT` or `--project`.
- [x] Create `/Users/tofu/Downloads/MEDALLION.bindery` beside `medallion bible.docx` from the preserved AI-refined source-intake result without rerunning AI.
- [x] Rebuild and launch the standalone app against `/Users/tofu/Downloads/MEDALLION.bindery`, then preserve visual/runtime evidence for review.

## Done (2026-07-04 AI 문맥 분해 + DOCX 통합 문서 — feat/ai-mission-control)

- [x] Add optional agent-assisted refinement on top of the deterministic source-intake split.
- [x] Make the agent read the preserved `notes/source-raw.md` instead of passing large bible text directly as a command argument.
- [x] Validate agent `SourceIntake` JSON and fall back to the local split when output is unavailable or invalid.
- [x] Add DOCX import for the `통합 문서` start path without adding a new production dependency.
- [x] Generate `world/organizations.md` from semantic source-intake results.
- [x] Run `/Users/tofu/Downloads/medallion bible.docx` through the current local split and AI refinement path, and record the observed quality gap.

## Done (2026-07-04 통합 문서 시작 + 하네스 분해 — feat/ai-mission-control)

- [x] Add a start-screen `통합 문서` entry for rough integrated idea/bible input.
- [x] Parse pasted or Markdown/TXT source material into a deterministic `SourceIntake` contract.
- [x] Generate harness-ready project files: setting bible, open threads, plot board JSON, character inbox/files, source intake report, raw source archive, and EP001 seed files.
- [x] Add smoke coverage for source-intake parsing and file generation.

## Next (통합 문서 시작 — 후속)

- [ ] Add PDF import through the document/PDF runtime path.
- [ ] Add an approval/edit surface before source-intake output overwrites generated template files.
- [ ] Show a source-intake comparison preview so authors can accept local vs AI split before project files are finalized.

## Done (2026-07-04 AI envelope 스키마 + repair loop — feat/ai-mission-control)

- [x] Introduce `DraftCandidateEnvelope` and `QAReportEnvelope` schemas in the frontend domain layer.
- [x] Validate draft candidate JSON before accepting agent prose as a candidate, including manuscript length/refusal/Korean prose/source-identical guards.
- [x] Validate QA reports through `QAReportEnvelope`, while keeping legacy `bindery:qa-json` block compatibility.
- [x] Add one repair-on-invalid retry for draft candidate and QA agent outputs before falling back to existing native/mock paths.
- [x] Render normalized QA envelope markdown with an embedded `bindery:qa-json` block for the existing parser/UI.

## Done (2026-07-04 Plan-And-Write 회차/장면 계획 단계 — feat/ai-mission-control)

- [x] Add `EpisodeBrief` and `ScenePlan` pipeline steps ahead of draft generation.
- [x] Link EpisodeBrief/ScenePlan generation to plot board rows, open threads, previous summaries, frontmatter characters, and manuscript excerpts.
- [x] Persist planning artifacts to `.bindery/artifacts/{episode}/episode-brief.md` and `.bindery/artifacts/{episode}/scene-plan.md` with embedded JSON blocks.
- [x] Feed planning artifacts into draft/revise guidance as hard context, context packs, and QA gate prompts.
- [x] Guard draft generation so it fails visibly until both planning artifacts exist.
- [x] Add `/brief` and `/plan` slash-menu entries that hand off to the AI 작업 run surface.

## Done (2026-07-04 AI 미션 컨트롤 + run 기록 — feat/ai-mission-control)

- [x] Add run persistence: runId, settings snapshot, per-step status/artifact links, human decisions, `.bindery/runs/{runId}/run.json` + index, hydration on project open.
- [x] Add the AI 미션 컨트롤 full-screen workspace with step graph, run history, large artifact/prompt/context/review viewers, and a settings/risk/decision inspector.
- [x] Add hardness/sourceId/token-estimate metadata to draft guidance sections and surface them in the 컨텍스트 tab.
- [x] Wire `aiDefaultCandidateCount` into draft generation with variation directives and 후보 A–D relabeling.

## Next (아키텍처 리뷰 후속 — 장기 기억/스키마)

- [ ] Add `MemoryWriteProposal` approval UI so AI-proposed canon changes require human confirmation.
- [ ] Split project memory into semantic/episodic/procedural indexes (`.bindery/memory`) with retrieval-based context packs.
- [ ] Add explicit approval/edit UI for EpisodeBrief and ScenePlan artifacts before draft generation.

## Done (2026-07-03 리뷰 패치 반영 + 후속 계획 구현)

- [x] Replace short manuscript prompt excerpts with front/middle/tail context windows for preview, QA, and summarize flows.
- [x] Stop full pipeline execution on action failure or QA `fail` verdict before summarize/commit.
- [x] Validate agent QA JSON, candidate markdown, and style guideline outputs before treating them as usable artifacts.
- [x] Add 120-second timeout and temp-file text passing for native style CLI commands.
- [x] Strengthen style banned-term parsing across inline lists, bullets, markdown tables, quotes, backticks, and parenthetical notes.
- [x] Remove repetition decoration rescans from the editor typing hot path.
- [x] Move artifact persistence to `.bindery/artifacts/index.json` plus full artifact files, with localStorage preview-only metadata.
- [x] Switch writing stats to 공백 제외 글자, sentence count, and manuscript-page estimates.
- [x] Pass selected text or cursor-near context from editor slash commands into the AI draft prompt.
- [x] Add drag reorder for plot-board scene rows.

## Done (2026-07-03 파이프라인 갭 마감 + 작업면 정리)

- [x] Replace the `context`/`summarize`/`commit` novelctl stubs with real assembly/agent/snapshot behavior in the action layer.
- [x] Wire StyleMatch scoring into the candidate review panel.
- [x] Inject the PromptCapsule into draft/revise guidance so the structured style runtime reaches the AI draft prompt.
- [x] Render the chapter navigator only on the writing screen to remove three-panel dispersion.

## Done (2026-07-03 UI 재편 — Pensive/뮤블 정렬)

- [x] Reduce top navigation: folded `문체`/`AI`/`내보내기` under a `작업실` surface with a slim sub-nav (three top tabs).
- [x] Replace rounded card nesting with hairline full-width sections across materials, export, and help surfaces.

## Next (UI 재편 — 후속 폴리시)

- [ ] Normalize existing CSS spacing/color drift against `DESIGN.md` so Superloopy `ds-compliance.mjs` can pass without waivers.
- [ ] Unify the AI and style studio rails into one calm full-bleed surface language.
- [ ] Add Muvel-style optional editor widgets (timer, quick memo, dictionary, episode reference).

Reference note: the UI direction follows pensive.so and Muvel (뮤블), the Korean
programs named for this project. The earlier "book map" idea came from pensive.me,
a separate US AI book-writing studio, so it was dropped from this backlog.

## Done

- [x] Hide the binder navigator outside the writing screen so AI/materials/export surfaces stay focused.
- [x] Prepare GitHub publish hygiene by ignoring local Superloopy state/evidence and personal sample source text.
- [x] Document the current AI writing pipeline user flow in Korean (`docs/AI_WRITING_PIPELINE_FLOW_20260703.md`) and verify the default Codex adapter smoke path.
- [x] Apply `bindery_style_system_patched_20260703.zip` structured style system patch.
- [x] Add deterministic SceneClassification, StyleRouter, StyleStack merge, PromptCapsule, StyleMatchScore, and SkillPack export runtime paths in TypeScript/Python.
- [x] Add `novelctl` style subcommands and local frontend style API entrypoints.
- [x] Add native Tauri style commands backed by the Python `novelctl` style runtime.
- [x] Move the MVP SQLite schema into a real migration file while keeping `style-sql` output compatible.
- [x] Add repository sync between project `styles/` JSON and SQLite (`style-sync`; JSON remains editable source, SQLite is query/index cache).
- [x] Build the Phase 2 `문체 시스템` UI: Preset Manager, Stack Mixer, Router Editor, scene classification override editor, Score Lab, Suggestion Lab, and SkillPack export preview.
- [x] Add Korean NLP expansion for morphology-like surface counts, action verbs, judgment markers, relationship markers, emotion dictionaries, and manual speaker correction policy.
- [x] Add structured LLM correction schemas for SceneClassification, paragraph function tagging, scoring explanation, and suggestions while keeping local scoring authoritative.
- [x] Harden scoring with feature-based rhythm/discourse/dialogue/lexical/fluency, content leakage review diagnostics, and overfit penalties.
- [x] Add SkillPack validator, zip exporter, reference loading policy, structured schema manifest, Korean marker manifest, and regression fixtures.
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

- [ ] Authenticate GitHub on this Mac or provide a remote URL, then add `origin` and push `main`.
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
