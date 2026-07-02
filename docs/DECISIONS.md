# Decisions

Updated: 2026-07-02 22:37 KST

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
