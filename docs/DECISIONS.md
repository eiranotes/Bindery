# Decisions

Updated: 2026-07-02 (UI 하네스 개편)

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
