# UI Rework - Writing First

Date: 2026-07-02

## Goal

Make Bindery behave like an authoring tool first: open a project, write, save, and only move into AI when the author explicitly wants candidate generation or review.

## Reference Notes

- Pensiv emphasizes file type separation, AI Review, Plotboard, Canvas, graph view, local mode, and snapshots.
- Pensiv's Scrivener comparison describes a separation between Docs, Plotboards, Characters, Canvas, and Folders.
- Muvel is positioned as a novel writing editor with desktop/tablet/mobile use when logged in, local/offline use without an account, and recent features such as EPUB export and filetree widgets.

## Implemented

- `작성`: manuscript editor, selected file, save state, word count.
- `AI 작업`: step execution, evidence, candidate comparison, QA result, revision plan.
- `자료`: settings/codex and plot board.
- `검토`: QA, repetition map, revision plan, candidate comparison.
- `내보내기`: snapshots, execution log, AI connection settings.

## Visual QA

Evidence directory:

```text
.superloopy/evidence/frontend/20260702-bindery-writing-first/
```

Final Playwright checks:

- 1440 desktop: overflow 0, candidate true, QA true.
- 1024 tablet: overflow 0, candidate true, QA true.
- 390 mobile: overflow 0, candidate true, QA true, app width 390.
