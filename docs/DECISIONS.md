# Decisions

Updated: 2026-07-04 (Standalone startup project + MEDALLION seed)

## Standalone Startup Projects Use Explicit Env Or CLI Input

Decision: Standalone/Tauri app startup can receive a real project folder through `BINDERY_START_PROJECT`, `--project <path>`, `--project=<path>`, or a bare path argument. This startup path takes priority over the localStorage-restored recent project for that launch.

Reason: Packaged and standalone validation should prove the app can read a real author project folder directly, not only a browser preview or whatever localStorage happened to remember. Keeping the input explicit avoids baking personal sample paths into production defaults while still making reproducible local demo launches possible.

## Source Intake Agent Reads The Raw File Before Finalizing Harness Files

Decision: `통합 문서` project creation still starts with a deterministic local split, but when `AI 문맥 분해` is enabled the app first writes `notes/source-raw.md`, asks the configured agent to read that project file, validates the returned semantic `SourceIntake` JSON, and only then writes the final harness files. If the agent is unavailable or invalid, the local split remains the fallback.

Reason: Rough bible documents are contextual, not just heading buckets. Passing the raw text as a command argument is fragile for larger documents and encourages shallow splitting. A file-backed agent pass lets the model inspect the complete source while keeping local-first creation, validation, and fallback behavior intact.

## DOCX Source Import Uses A Minimal Local Extractor

Decision: The start screen accepts DOCX for source intake by reading the package's `word/document.xml`, extracting paragraph text, and preserving Word heading styles as Markdown heading markers before running the same source-intake flow as Markdown/TXT.

Reason: Many authors bring a rough bible as a Word document. Adding a focused extractor avoids a new production dependency and keeps DOCX import limited to text intake; deeper PDF or layout-aware document processing remains a separate follow-up.

## Organizations Are First-Class Source Intake Output

Decision: Semantic source intake can now produce organizations/factions/institutions as `SourceIntakeOrganization` records and writes them to `world/organizations.md`, in addition to character files and the setting bible.

Reason: Large bible documents often describe teams, leagues, corporations, guilds, or institutions. Treating those as characters or plot beats collapses the project map and weakens later brief/scene planning.

## Rough Source Intake Creates Harness Files Deterministically First

Decision: The start screen includes a `통합 문서` path that accepts pasted text, Markdown/TXT, or DOCX source files, creates a project, and deterministically separates the rough integrated idea/bible into local harness files before optional agent refinement: `canon/setting-bible.md`, `plot/open-threads.md`, `plot/plot-board.json`, `characters/`, `world/organizations.md`, `notes/source-intake.md`, `notes/source-raw.md`, and EP001 seed files.

Reason: First-run authors often have one messy document rather than clean Bindery folders. A local deterministic split gives them immediate, reviewable project structure and keeps AI optional. Agent-assisted refinement can later sit on top of the same `SourceIntake` contract instead of replacing the local-first bootstrap.

## Agent Draft And QA Outputs Use Repairable Envelopes

Decision: Draft generation first asks agents for `DraftCandidateEnvelope` JSON, and QA asks for `QAReportEnvelope` data embedded in the existing `bindery:qa-json` block. If validation fails, the app sends one repair prompt that converts the invalid output into the required JSON object before falling back to the previous native/mock path.

Reason: The architecture review called out that free-form agent output was too fragile for long-running pipeline state. A single repair retry catches common format drift without making the run loop unbounded or hiding failures.

## Legacy QA Blocks Stay Compatible

Decision: `QAReportEnvelope` validation accepts the existing `bindery:qa-json` block shape when the required score/verdict/issues fields are present, then normalizes it into the v1 envelope markdown used by the UI parser.

Reason: Existing artifacts and fallback reports should remain readable. The schema layer is a hardening layer, not a forced artifact migration.

## Drafting Requires Episode Brief And Scene Plan

Decision: The AI pipeline now starts draft generation only after `episode-brief` and `scene-plan` artifacts exist for the current episode. These artifacts are treated as hard guidance in draft/revise prompts, included in context packs, and supplied to QA as plan-compliance gates.

Reason: The architecture review's Plan-And-Write principle requires the model to plan the episode and scene beats before writing prose. Keeping the guard in `runDraftAction` makes the contract apply to full-run, single-step, and slash-command handoff flows instead of relying only on UI order.

## Planning Artifacts Are Agent-First With Local Fallbacks

Decision: `EpisodeBrief` and `ScenePlan` are typed domain artifacts with embedded JSON blocks and readable Markdown. The app asks the configured agent for JSON first, then falls back to deterministic local planning from the plot board, open threads, previous summaries, frontmatter characters, and manuscript excerpts if the CLI is unavailable or invalid.

Reason: Authors should be able to exercise the pipeline offline or in browser/mock mode, but local fallbacks must be clearly labeled and reviewable. The JSON block preserves a future path to approval/edit UI, schema validation, and memory writeback without breaking today's artifact shelf.

## Long Manuscripts Use Front Middle Tail Context Windows

Decision: AI prompt preview, QA, and summary prompts include a bounded manuscript window made from the opening, middle, and ending instead of the first-only excerpt.

Reason: Long serial episodes often place reversals, endings, and hooks outside the opening. A bounded three-part window keeps prompts affordable while avoiding a systematic blind spot.

## Pipeline Failures Stop The Run Before Record Steps

Decision: Full pipeline execution stops when an action fails or QA returns a `fail` verdict. The failed output remains an artifact, but later summarize/commit steps do not run as if the episode passed.

Reason: Summary and commit artifacts imply a reviewed state. Continuing after a failed QA gate made the status rail look cleaner than the underlying manuscript quality.

## Artifacts Are File-Backed With Preview-Only Browser State

Decision: Full artifacts live under `.bindery/artifacts/` with an `index.json` manifest. Browser localStorage stores only metadata and a preview.

Reason: QA reports and draft candidates can be large. Keeping full content in localStorage risks quota and serialization stalls, while local files preserve the local-first evidence trail.

## Korean Writing Stats Use Character-First Counts

Decision: Daily writing progress and editor headline stats use 공백 제외 글자 as the primary unit, with sentence count and manuscript-page estimates as supporting metrics.

Reason: Whitespace-delimited word counts are weak for Korean fiction. Character-first counts match manuscript and platform expectations better.

## Local Evidence And Source Text Stay Out Of Git

Decision: Local Superloopy state/evidence under `.superloopy/` and ad hoc source-text samples under `sample/` are ignored and are not part of the publishable GitHub repository.

Reason: Superloopy files are local QA/work-session artifacts, and copied prose samples may be private or copyrighted. The tracked `sample-project/` remains the safe app fixture.

## Binder Belongs To The Writing Surface

Decision: The left binder navigator is shown only on the writing screen. AI work, materials, style analysis, and export screens use their own focused work areas without the extra binder column.

Reason: Non-writing screens already have their own rails, panels, and review stages. Keeping the binder visible everywhere created duplicate navigation density and reduced room for dense Korean labels and analysis output.

## Style JSON Is The Editable Source

Decision: Project `styles/` JSON files are the editable source for style profiles, presets, stacks, routers, classifications, and reports. `.bindery/style-system.sqlite3` is a local query/index cache rebuilt by `novelctl style-sync`.

Reason: Authors and tools can review, version, copy, and repair JSON files directly. SQLite gives fast lookup and future native queries without making the database the only durable source of truth.

## Local Style Scoring Is Authoritative

Decision: Structured LLM outputs may correct classifications, tag paragraph functions, explain scores, and suggest revisions, but they cannot set the authoritative `StyleMatchScore.total_score`.

Reason: The score must be reproducible and inspectable. LLM prose is useful for explanation and suggestion, while deterministic feature scoring is safer for regression tests and user trust.

## SkillPacks Must Be Self-Validating

Decision: Exported style SkillPacks include reference loading policy, regression fixtures, structured-output schema manifests, Korean marker manifests, a validator script, and a validation report. Zip export is created only from the generated SkillPack directory.

Reason: Style adapters are reusable artifacts. They need portable checks for required files, few-shot limits, score authority rules, and regression coverage before they are shared or loaded elsewhere.

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
