# Decisions

Updated: 2026-07-03 (문체 시스템 Phase 2 시작)

## Native Style Commands Use The Python Runtime First

Decision: Phase 2 native Tauri style commands call the Python `novelctl` style subcommands instead of reimplementing the style runtime in Rust immediately.

Reason: The deterministic style logic already exists and is tested in TypeScript/Python. A Rust port would duplicate a large ruleset before the API settles. The native command layer gives the app a stable backend contract now, while keeping a future Rust implementation optional.

## Style Schema Is A Migration File

Decision: The MVP SQLite schema lives in `packages/novelctl-core/novelctl/migrations/001_style_system.sql`; `SQLITE_SCHEMA` is loaded from that file for CLI compatibility.

Reason: Phase 2 needs real migrations and repository sync. Keeping schema as a file makes review, migration ordering, and future database setup clearer than a large inline Python constant.

## Structured Style Runtime Lives Beside The Existing Analyzer

Decision: Keep the existing local-first `styleAnalyzer.ts` evidence pipeline, and add the new structured style runtime as a separate TypeScript/Python layer for SceneClassification, StyleRouter, StyleStack merge, PromptCapsule, StyleMatchScore, and SkillPack export.

Reason: The existing analyzer already feeds the current `문체` workflow and prompt builders. The structured runtime is a routing/generation contract, not a replacement for the evidence bundle, so separating the layers avoids breaking current analysis artifacts while making Phase 2 storage/API/UI work possible.

## Scene Candidates Are Grouped, Not Sentence-Split

Decision: The analyzer treats explicit separators (`***`, `---`, headings) as hard scene boundaries, but otherwise merges short paragraph or sentence-like blocks until they have enough scene mass before creating a scene record.

Reason: Many pasted novels or OCR/text exports put a blank line after every sentence. Treating each block as a scene made “장면별 분석” degenerate into sentence-by-sentence analysis. Scene classification needs larger units unless the author explicitly marks a boundary.

## Packaged Sample Uses App Data

Decision: In a packaged Tauri app, `open_project("sample-project")` seeds and opens a writable sample project under the app data directory instead of treating `sample-project` as a relative filesystem path.

Reason: Finder-launched `.app`/DMG builds do not run from the repository root, so the previous relative path failed. The sample must work out of the box and remain writable without depending on developer checkout paths.

## Studio Navigator Collapses To A Rail

Decision: The binder remains the left-side project navigator on desktop, but it can collapse into a 54px rail with three icon-like Korean controls for `회차`, `파일`, and `설정집`. The topbar owns the collapse/expand toggle, while clicking a rail item reveals that tab again.

Reason: Authors need the manuscript or analysis surface to reclaim horizontal space without losing orientation. A rail preserves the workspace map without forcing long labels into narrow columns.

## Dense Analyzer Rows Use Reading Groups

Decision: The `문체` analyzer scene output groups related metrics into four reading columns (`장면`, `기능`, `수치`, `표층`) instead of many tiny numeric columns.

Reason: The analyzer must remain scan-friendly at desktop width and degrade cleanly on tablet/mobile. Grouping prevents Korean labels and values from wrapping one character per line while still keeping the local-first procedure visible.

## Style Analyzer Is Local First

Decision: The `문체` analyzer follows the v3 MVP pipeline as a local procedure before any AI interpretation: normalize input, segment paragraph-based scene candidates, code scene features, generate `F_RULE_###` evidence, apply globality decisions, build a language surface profile, and create a prompt capsule. AI is used only after that for semantic/emotional interpretation and prose guidance generation.

Reason: Local regex analysis can reliably produce repeatable structural evidence, while AI is better used for rhythm, temperature, narrative distance, and description texture. Separating these roles keeps the analyzer reviewable and prevents AI prose from replacing measurable evidence.

## Analyzer Evidence Is Shown In The UI

Decision: The `문체` tab exposes the analyzer procedure, local summary counts, scene feature table, and evidence candidate list before the user asks AI to extract style.

Reason: The style analyzer is only useful if authors can see which rules came from repeated local features and which parts still need AI interpretation or manual judgment.

## Every Pipeline Step Leaves An Artifact

Decision: Each harness step records its output as a per-episode artifact; the latest context/summary/QA/revision/analysis artifacts plus the style guideline are automatically assembled into a guidance block passed to candidate generation.

Reason: The harness is only trustworthy if every run leaves reviewable evidence, and the AI should never draft blind — it must see what the pipeline already learned about the episode.

## Style Replication Extracts Feel, Not Numbers

Decision: The `문체` studio computes quantitative stats client-side but treats them strictly as reference ranges. The AI prompts focus on emotional qualities (breathing/rhythm, where emotion is placed, narrative distance) and explicitly forbid copying source sentences. Verification is a newly-written scene that does not exist in the source, judged by reading.

Reason: Matching averages produces parody; the goal is that new text *reads* like the author. Ban lists (banned words/banned imagery) guard against both AI clichés and style-breaking habits.

## Style Guideline Lives In The Project

Decision: The confirmed guideline is written to `canon/style-guide.md`, so it appears in the AI harness bible stage and survives outside the app.

Reason: Artifacts that matter must be plain files in the project, not app-internal state.

## AI Work As A Staged Harness

Decision: `AI 작업` is a single staged surface — `01 연결 → 02 바이블 → 03 실행 → 04 검토` — with a persistent left rail showing live status per stage, instead of scattered panels across `AI 작업`/`검토`/`내보내기`.

Reason: The AI novel harness is Bindery's differentiator; the pipeline must be legible at a glance. CLI setup was buried in the export screen, bible input had no explicit place, and review panels were duplicated across two tabs.

## No AI In The Writing Screen

Decision: The `집필` screen has zero AI entry points. Editor slash commands only navigate to the harness; they never execute AI.

Reason: Full separation between writing and AI work was requested; the manuscript surface must stay quiet and never trigger generation as a side effect of typing.

## Bible Is Optional But Explicit

Decision: Stage `02 바이블` detects setting documents; if none exist, the author either creates a `canon/setting-bible.md` template or explicitly chooses `바이블 없이 진행`.

Reason: Projects without a bible are a first-class case. Making the skip explicit keeps prompt contents predictable instead of silently omitting canon.

## Help And Preferences Leave The Main Tabs

Decision: Four main tabs (`집필`, `자료`, `AI 작업`, `내보내기`); `도움말` is a topbar button and editor preferences live in a `환경설정` modal.

Reason: Pensiv-style minimalism — main navigation should map to the actual writing pipeline, not utilities.

## Project Onboarding First

Decision: The app starts from a project-oriented landing screen with `새 작품`, `기존 폴더`, and `샘플` paths.

Reason: The author needs to know whether they are creating, loading, or previewing before entering the editor. Settings can be absent; writing and local save must still be immediately available.

## Workflow Help As Top-Level Screen

Decision: `도움말` is a top-level studio tab instead of a buried modal.

Reason: The product workflow spans project creation, writing, materials, AI candidate review, QA, and export. A separate page makes the full pipeline visible without turning the main editor into an explanation surface.

## Writing First

Decision: `작성` is the primary app surface. Opening a project now selects a writable manuscript and shows the editor first.

Reason: The product is for authors writing and saving their own manuscript. AI is a support feature, not the center of the daily workflow.

## AI As Separate Pipeline

Decision: AI candidate generation, QA, evidence, candidate comparison, and revision planning live in `AI 작업`.

Reason: AI output must remain reviewable and should never silently overwrite the manuscript.

## Reference Direction

Decision: Use Pensiv for separated document/material surfaces and Muvel for clean local writing/workspace ergonomics.

Sources:

- Pensiv writing tool comparison: file type separation, AI Review, Plotboard, Canvas, snapshots.
- Pensiv Scrivener alternative: Docs, Plotboards, Characters, Canvas, Folders.
- Muvel Play Store listing: local/offline writing, desktop/tablet/mobile availability, filetree widget, EPUB export.

## macOS Launch Target

Decision: Tell users to open `Bindery.app`, not the raw standalone executable.

Reason: The raw executable is terminal-runnable and can trigger macOS “no application set to open” behavior in Finder. The `.app` bundle is the normal double-click target.
