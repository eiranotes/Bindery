# UI Improvement Plan - Pensiv and Muvel Target

Date: 2026-07-02

## Reference Basis

- Pensiv official site: high-performance editor, plotboard, canvas, links/graph view, tasks, version history, export, AI review, local/offline mode, and recent design refresh around clearer editor chrome.
- Muvel official site: episode/wiki/memo project model, cross-platform writing, customizable writing environment, split workspaces, widgets, light/dark mode, local-only storage, smart quote actions, AI review/summary, automatic versioning.

## Current Visual QA Snapshot

Evidence directory:

```text
.superloopy/evidence/frontend/20260702-bindery-pensiv-muvel/
```

Captured screens:

- `landing-390.png`, `landing-768.png`, `landing-1280.png`
- `studio-390.png`, `studio-768.png`, `studio-1280.png`

Observed pass points:

- Current production preview opens at 390, 768, and 1280 px.
- Sample project opens at all three widths.
- No console errors during capture.
- No document-level horizontal overflow at all three widths.

Observed design gaps:

- Landing still reads like a centered app-card hero instead of a working book shelf.
- Current accent and logo use the purple/blue default that Superloopy flags as an AI tell.
- 1280 studio has a useful book-building shape, but the build ladder is visually bulky and too card-like.
- 390 studio works, but the build ladder clips/truncates labels and topbar utility chips feel crowded.
- Persistent controls still include emoji theme icons.
- Earlier visible copy said `Pensive-style`; this pass renamed the primary label to `Book Build Ladder`.

## Target UX

Bindery should open directly into a working author surface:

1. My Books view as a dense shelf/work queue, not a hero page.
2. Book Studio view with three durable zones: navigator, manuscript/build surface, AI evidence rail.
3. Build ladder as a narrow step index with status and next action.
4. Widgets as optional, placeable Muvel-like work aids.
5. Pensiv-like graph/canvas affordances for characters, plot, tasks, links, and version history.
6. AI proposal flow always tied to source text, snapshot, diff, and review gate.

## Implementation Phases

### Phase 1 - Token and Slop Cleanup

- [x] Replace `--accent: #7057ff` and dark `--accent: #8b5cf6` with the teal/warm pair from `DESIGN.md`.
- [x] Replace logo gradient with a book-spine or page-stack mark using declared tokens.
- [x] Replace emoji theme toggle with an icon component.
- [x] Rename `Pensive-style build ladder` to `Book Build Ladder`.
- [x] Reduce large radii on app cards toward the `8px to 14px` token range.
- [x] Remove the dark-tinted topbar background in light mode.

Verification:

- `npm --workspace apps/desktop run check`
- `npm run build`
- Screenshot 390, 768, 1280.

### Phase 2 - My Books as Workspace

- [x] Remove hero-card dominance.
- [x] Add a denser book queue with local/agent/next-action rail.
- [ ] Add last opened time, current phase, pending AI candidates, and snapshot count.
- [x] Keep Open Book as primary action, but make it a workspace action rather than the whole page.
- [ ] Add empty state only when there are no recent books.

Verification:

- Landing screenshot should show the product as a tool, not a marketing page.
- No horizontal overflow at 390 px.

### Phase 3 - Studio Density and Mobile

- Make build ladder a compact segmented rail with full labels on desktop and icon/number plus tooltip on mobile.
- Use the left navigator for Book / Files / Bible / Widgets, preserving Muvel's mental model.
- Make the right AI rail collapsible at tablet widths instead of disappearing without a reveal action.
- Add a mobile bottom command strip for current step, open file, and AI proposal count.

Verification:

- Open sample project at 390, 768, 1280.
- Confirm the current step, selected book, and next action remain visible.

### Phase 4 - Pensiv-Style Context Surfaces

- Add a graph/canvas view for character, place, task, and plot nodes.
- Add version history panel per document and per project.
- Add task list tied to story nodes and manuscript lines.
- Add export preparation screen for Markdown, PDF, EPUB, HWP planning, and review packet.

Verification:

- Canvas empty, loading, and populated states.
- Version restore dry-run state.
- Export blocked and ready states.

### Phase 5 - Muvel-Style Writing Comfort

- Add writing environment presets: platform preview, serif manuscript, compact editing, night review.
- Add widgets: word count, timer, dictionary placeholder, episode reference, quick memo.
- Expand smart quote settings with preview and per-language behavior.
- Persist workspace layout in `.bindery/project.json`.

Verification:

- Preset switch does not resize manuscript unexpectedly.
- Widgets can be hidden without losing writing flow.
- Settings persist after reload.

## Current Blockers

- This folder is not a git repository, so changes cannot be committed here.
- Windows `.exe` generation still requires a Windows target or runner. This Mac verified the macOS ARM64 standalone executable only.
- npm audit currently reports 3 low severity issues after install.

## 2026-07-02 Writing-First Rework Result

- [x] Made `작성` the default studio screen.
- [x] Split AI execution, evidence, candidate comparison, QA, and revision planning into `AI 작업`.
- [x] Koreanized visible app menus and panels.
- [x] Verified candidate generation is a real runnable UI flow, not only a static pipeline diagram.
- [x] Fixed mobile frame overflow after visual QA.
- [x] Captured Superloopy evidence under `.superloopy/evidence/frontend/20260702-bindery-writing-first/`.
- [x] Rebuilt macOS raw standalone executable and launchable `.app` bundle.

## Acceptance Criteria

- `DESIGN.md` is the token source for new UI values.
- Superloopy anti-slop checklist passes for the primary app surfaces.
- 390, 768, and 1280 screenshots show no broken layout, no document-level overflow, and no clipped primary actions.
- The first viewport presents a usable app workspace, not a landing page.
- Every AI action remains reviewable through evidence, snapshot, and diff.
