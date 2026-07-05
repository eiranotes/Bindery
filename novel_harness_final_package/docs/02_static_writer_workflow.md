# 02. Static Writer Workflow

This layer must work even when AI is disabled. It is the writer's normal local-first creative workflow.

## 0. Project home

UI:

- Left structure tree.
- Center dashboard.
- Right inspector.

Editable files:

- `status/resume-state.md`
- `status/story-state.md`
- `manifest/project-index.md`
- `ideas/inbox.md`
- `plot/open-threads.md`

Dashboard sections:

```text
Continue writing
Pending decisions
Recent files
Open threads
Character/world changes needing approval
Writing statistics
```

## 1. 소재발굴: Idea Discovery

Purpose: collect raw ideas before they become premise/world/cast.

Primary files:

```text
ideas/inbox.md
ideas/premise-lab.md
ideas/motif-bank.md
ideas/research-questions.md
```

UI:

- Inbox list on left.
- Selected idea editor in center.
- Tags/genre/energy/risks inspector on right.

Editable output template:

```markdown
# Idea Seed: <title>

## Hook

## Emotional engine

## Genre tags

## Reader promise

## Freshness angle

## Risks

## Promotion decision
- [ ] promote to premise
- [ ] merge into another idea
- [ ] discard
```

Promotion action:

```text
idea_seed -> premise candidate -> project premise
```

No canon impact yet.

## 2. 세계관 확장: World Expansion

Purpose: expand the premise into controllable assets, not a monolithic wiki.

Primary files:

```text
world/systems/*.md
world/locations/*.md
world/institutions/*.md
world/history/*.md
world/culture/*.md
characters/*.md
relationships/*.md
plot/story-envelope.md
status/story-license.md
```

UI:

- Sheet table grouped by asset type.
- Canvas view for relationships/conflicts.
- Conflict/contradiction inspector.

Asset sheet sections:

```markdown
# <Asset Name>

## One-line function

## Canon facts

## Unknowns

## Story use

## Constraints

## Related assets

## First appearance plan

## Change log
```

World expansion gate:

- Every new named asset starts as `status: draft`.
- Promotion to `status: canon` is a user action.
- Asset registry updates after promotion.

## 3. 바이블 생성: Bible Assembly

Purpose: assemble a readable project bible from asset files.

Important distinction:

```text
asset files = source of truth
setting-bible.md = synthesized reading surface
```

Primary files:

```text
canon/setting-bible.md
canon/bible-build-report.md
manifest/asset-registry.md
```

UI:

- Bible preview in center.
- Source asset checklist on right.
- Missing/contradiction report below.

Editable output:

- User can edit `canon/setting-bible.md`, but canonical facts should remain in asset files.
- Manual bible edits that conflict with asset files are flagged.

## 4. 플롯 제작: Plot Architecture

Purpose: plan arcs, part structure, episode flow, and scene order.

Primary files:

```text
plot/series-outline.md
plot/parts/part-01.md
plot/plot-board.yaml
plot/timeline.md
plot/open-threads.md
story/chapters/ep001/brief.md
story/chapters/ep001/scene-plan.md
```

UI modes:

| Mode | File | Purpose |
|---|---|---|
| Series outline | `series-outline.md` | whole story direction |
| Part board | `parts/*.md` | arc-level structure |
| Plotboard | `plot-board.yaml` | card/kanban/timeline editing |
| Timeline | `timeline.md` | chronological consistency |
| Open threads | `open-threads.md` | unresolved promises |

Plot card format:

```yaml
- id: card_ep001_sc001
  episode: ep001
  scene: sc001
  title: "보고서 공백"
  function: clue_insert
  characters: [char_eira, char_protagonist]
  location: loc_guild_office
  open_threads_used: [thread_contract_gap]
  new_threads: []
  status: planned
```

## 5. 회차 설계: Episode Brief

Purpose: define what the episode must do before prose is generated.

File:

```text
story/chapters/ep001/brief.md
```

Template:

```markdown
# EP001 Brief

## Episode promise

## Must accomplish
- [ ]

## Must avoid
- [ ]

## POV and knowledge boundary

## Required assets

## Open threads touched

## Target length

## Ending state
```

## 6. 장면 설계: Scene Plan

File:

```text
story/chapters/ep001/scene-plan.md
```

Template:

```markdown
# EP001 Scene Plan

## Scene sc001

- purpose:
- location:
- POV:
- characters:
- required beats:
- blocked reveals:
- target chars:
- entry image:
- exit state:
```

UI:

- Scene cards on plotboard.
- Detail editor opens the corresponding markdown block.
- Drag reorder updates `plot-board.yaml` and scene order.

## 7. 집필: Drafting

Files:

```text
story/chapters/ep001/manuscript.md
story/chapters/ep001/scenes/sc001.md
```

Modes:

| Mode | Meaning |
|---|---|
| Episode manuscript | writer edits whole episode |
| Scene split | writer edits individual scene files |
| Scrivenings-like view | app stitches scenes for reading/editing |

Manual drafting remains the default. AI suggestions enter as candidates.

## 8. 검토와 수정

Static review files:

```text
story/chapters/ep001/revision-notes.md
story/chapters/ep001/qa-notes.md
.harness/snapshots/**
```

User operations:

- add inline note
- create task
- snapshot selection/file
- compare versions
- mark hunk accepted/rejected

## 9. 정사 동기화

Files:

```text
.harness/proposals/*.json
canon/deltas/*.md
canon/summaries/ep001.md
status/resume-state.md
plot/open-threads.md
```

No summary or canon delta becomes durable truth without review.
