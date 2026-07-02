# 06. GUI Information Architecture

## 1. Main layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Top Bar: Project / Episode / Run / Search / Settings         │
├──────────────┬───────────────────────────────┬───────────────┤
│ Binder       │ Editor Area                   │ Inspector     │
│              │                               │               │
│ Episodes     │ Tabs: Source/Split/Preview    │ Context       │
│ Plot         │ Markdown Editor               │ QA            │
│ Codex        │                               │ Analysis      │
│ Notes        │                               │ Links         │
│ Analysis     │                               │ Agents        │
├──────────────┴───────────────────────────────┴───────────────┤
│ Bottom Console: Jobs / Logs / Diff / Git                     │
└──────────────────────────────────────────────────────────────┘
```

## 2. Navigation hierarchy

### 2.1 Top Bar

- Project switcher
- Current episode selector
- Global search
- Run button
- Git status
- Gemini status
- Settings

### 2.2 Left Binder

Sections:

```text
Episodes
Plot
Codex
Notes
Analysis
Snapshots
Exports
```

Each section has custom tree behavior.

- Episodes: episode groups, chapters, scenes.
- Plot: outline, open threads, mysteries, plot grid, canvas.
- Codex: character/location/faction/system/term.
- Notes: inbox/candidate/used/promoted/rejected.
- Analysis: QA/repetition/rhythm/reader review.
- Snapshots: episode/date/reason.

### 2.3 Editor Area

Tabs:

- Source
- Split
- Preview
- Review
- Diff

Episode workspace tabs:

```text
Brief | Context | Plan | Draft | Summary | Canon Delta | QA | Revision | Final
```

### 2.4 Right Inspector

Context-sensitive panels:

| Current file type | Inspector panels |
|---|---|
| Episode final | QA, Analysis, Links, Metadata, Agent Actions |
| Scene | Scene Properties, Plotlines, Characters, Revision |
| Codex | Aliases, Mentions, Progression, Related Items |
| Plot file | Threads, Coverage, Timeline |
| Note | Attach, Promote, Generate |
| QA report | Issues, Apply Fixes, Related Lines |

### 2.5 Bottom Console

Tabs:

- Jobs
- Logs
- Diff
- Terminal output
- Git

## 3. Key screens

## 3.1 Project Launcher

```text
[Novel Studio]

Recent Projects
  - Dungeon Moneyball     Last: EP012     Dirty: 3 files
  - Breadnyan             Last: memo      Clean

[Open Folder] [New Project] [Import novelctl Project]

Environment
  Gemini CLI: connected
  novelctl: found
  Git: found
```

## 3.2 Episode Dashboard

```text
EP012 의료 리스크
Status: draft
Word Count: 7,800 / 9,000
QA: Plot PASS | Style WARN | Lexicon FAIL

[Build Context] [Draft] [Analyze] [QA] [Revise] [Commit]

Recent files:
  13_final.md
  12_revision-plan.md
  10_lexicon-qa.md
```

## 3.3 QA Dashboard

```text
Overall: REVISE_REQUIRED

Plot            86 PASS
Continuity      91 PASS
Style           78 WARN
Voice           74 WARN
Lexicon         62 FAIL
Scene Pattern   70 WARN
Reader Pull     81 PASS

[Generate Revision Plan]
```

## 3.4 Analysis Dashboard

Widgets:

- Word count
- Dialogue/description ratio
- Repetition map
- Sentence ending pattern
- Tension curve
- Reader review
- Cliffhanger strength

## 3.5 Codex View

```text
Characters
  protagonist
  eira
  ...

[Editor]

Inspector:
  Aliases
  First appearance
  Related episodes
  Mention count
  Progression
```

## 3.6 Plot Grid

```text
| Scene | Main Plot | Eira Arc | Medical Risk | Tension | Status |
|---|---|---|---|---|---|
| 01 | setup | observe | mention | low | draft |
| 02 | interview | data-first | expose | mid | draft |
| 03 | conflict | independent judgment | core | high | draft |
```

## 4. UX principles

### 4.1 Primary action always visible

For episode:

- if no context: `Build Context`
- if context exists, no draft: `Draft`
- if draft exists, no QA: `Run QA`
- if QA fail: `Generate Revision Plan`
- if final exists: `Commit`

### 4.2 Never hide source files

GUI controls should always have “Open file” or “Reveal in Binder”.

### 4.3 Avoid modal overload

AI outputs, QA details, diff results should use side panels or bottom drawer, not endless modals.

### 4.4 Explicit destructive actions

Overwrite, restore, delete, commit canon changes require confirmation.

## 5. Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Cmd/Ctrl+S | Save |
| Cmd/Ctrl+P | Quick open |
| Cmd/Ctrl+Shift+P | Command palette |
| Cmd/Ctrl+Enter | Run current primary action |
| Cmd/Ctrl+K | AI command on selection |
| Cmd/Ctrl+Shift+Q | QA current episode |
| Cmd/Ctrl+Shift+S | Create snapshot |
| Cmd/Ctrl+Alt+D | Toggle diff view |
