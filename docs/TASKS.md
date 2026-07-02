# Tasks

Updated: 2026-07-03 (산출물 + 문체)

## Done

- [x] Record an artifact for every pipeline step and show a per-episode artifact shelf in the run stage.
- [x] Feed latest artifacts + style guideline into draft/revise candidate prompts (with real prompt preview).
- [x] Add `run_agent_text` Tauri command and unify agent CLI execution paths.
- [x] Build the `문체` tab: scene analysis → style extraction → rules/ban lists → proof scene → final guideline saved to `canon/style-guide.md`.
- [x] Build Tauri macOS `.app` bundle after the changes.
- [x] Write `docs/GAP_ANALYSIS_A_TO_Z_20260703.md`.

## Next (from gap analysis)

- [ ] Episode management: create/switch/status for multiple episodes.
- [ ] Real export formats (TXT/EPUB first) in `내보내기`.
- [ ] Sync artifacts to `.bindery/artifacts/` files; feed summarize output back into the setting bible.
- [ ] Editable plot board; codex item creation UI.
- [ ] Style-compliance QA gate using the confirmed guideline.
- [ ] Snapshot restore/compare.

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
