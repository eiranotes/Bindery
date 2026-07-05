# 05. UI Spec — Pensiv Benchmark Applied

## 1. Design principle

The UI should not be “AI chat beside editor”. It should be a local-first project workspace where every AI output lands in an editable file or review panel.

Pensiv-inspired structure:

```text
Left  = structure map
Top   = current context tabs
Center= active editable surface
Right = inspector / context / QA / proposals
Bottom= run trace / tasks / prompt audit when needed
```

## 2. Primary navigation

Top-level modes:

| Mode | Purpose |
|---|---|
| Home | resume, recent work, pending decisions |
| Ideas | 소재발굴/inbox/premise lab |
| World | asset sheets and world canvas |
| Bible | generated bible surface and source coverage |
| Plot | plotboard, timeline, open threads |
| Write | manuscript/scene editor |
| Review | candidates, QA, revision plan |
| Canon | proposals, canon delta, asset promotion |
| Export | compile, PDF/MD/EPUB/TXT |

AI is not a top-level isolated world. AI appears as action buttons inside each mode:

```text
Generate seeds
Expand selected idea
Draft asset sheet
Assemble bible
Suggest plot cards
Draft scene
Run QA
Propose canon delta
```

## 3. Left sidebar

Sections:

```text
Project Home
Ideas
  Inbox
  Seeds
  Premise Lab
World
  Characters
  Locations
  Institutions
  Systems
  Relationships
Plot
  Series Outline
  Plotboard
  Timeline
  Open Threads
Story
  Episodes
  Scenes
Review
  Candidates
  QA Reports
Canon
  Pending Proposals
  Approved Deltas
Research
Settings
```

Each item shows:

- status dot
- authority badge
- pending proposal count
- unsaved indicator
- last modified

## 4. Center surfaces

### Idea Board

- Card list for seeds.
- Markdown editor for selected seed.
- AI generation drawer for variants.
- Promote/merge/discard buttons.

### World Sheets

- Table/list of assets.
- Selected sheet editor.
- Right-side links: related scenes, relationships, open contradictions.
- Draft/canon status switch requires approval.

### World Canvas

- Nodes: characters, places, institutions, systems, conflicts.
- Edges: relation, dependency, threat, secret, location.
- Every node links to a Markdown sheet.

### Bible Workspace

- Left: source asset checklist.
- Center: `canon/setting-bible.md` editor/preview.
- Right: source coverage, missing facts, contradictions.
- Button: Assemble bible from approved assets.

### Plotboard

Views:

- act board
- episode board
- scene board
- timeline
- thread matrix

Cards are stored in `plot/plot-board.yaml`. Card detail opens as markdown block or sheet.

### Write Desk

- Center manuscript editor.
- Optional split: scene plan, character sheet, previous chapter, style guide.
- Right inspector: current scene brief, voice rules, open thread touchpoints, word count.
- AI button states: draft scene, continue, rewrite selection, describe, dialogue pass.

### Review Desk

- Candidate tabs.
- Diff viewer.
- QA issue list with source locators.
- Revision checklist.
- Apply hunk / apply selection / reject buttons.
- Snapshot indicator.

### Canon Desk

- Pending proposals grouped by type.
- Patch preview.
- Approve/edit/reject/defer.
- Conflict resolver.

## 5. Stage output editing pattern

Every AI stage follows this UI pattern:

```text
[Run AI] -> output file opens in center -> user edits -> [Accept as candidate/proposal/source] -> validation -> next stage
```

For example:

```text
Generate Episode Brief
-> story/chapters/ep003/brief.md.candidate opens
-> user edits markdown
-> Accept
-> file replaces/updates brief.md with snapshot
```

## 6. Prompt Audit panel

For every AI action, show a panel with:

- prompt template name/version
- model/provider/profile
- token estimate
- included hard/soft/reference/candidate sources
- excluded source list
- stale source warnings
- branch contamination warnings
- schema output target
- output destination path

## 7. Writer statistics

Project home and Write Desk should show:

- today characters
- current session characters
- episode target progress
- streak/activity heatmap
- file-type distribution
- pending review items

Keep stats local-first by writing:

```text
.harness/artifacts/stats/daily/YYYY-MM-DD.json
```

## 8. Mobile/narrow mode

- Left sidebar collapses to icon rail.
- Right inspector becomes bottom sheet.
- Stage action buttons move to command palette.
- Candidate diff defaults to unified view.

## 9. Command palette and slash commands

Command palette:

```text
Open file
Run current stage AI
Export web-AI bundle
Import AI result
Create snapshot
Promote asset
Approve proposal
```

Editor slash commands:

```text
/continue
/rewrite-selection
/dialogue-pass
/describe
/run-prose-qa
/open-scene-plan
/link-character
```
