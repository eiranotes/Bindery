# 01. Local-first Information Architecture

## 1. Authority hierarchy

| Rank | Path | Meaning | AI write mode |
|---|---|---|---|
| A0 | `status/canon-state.md` | highest canon boundary | proposal only |
| A1 | `characters/`, `world/`, `relationships/` | asset-level truth | proposal only |
| A2 | `plot/story-envelope.md`, `plot/timeline.md`, `plot/open-threads.md` | permitted story space and unresolved plot | proposal only |
| A3 | accepted `story/chapters/**/manuscript.md` | accepted story surface | patch candidate only |
| B1 | `canon/setting-bible.md` | synthesized human-readable bible | generated draft, approve to replace |
| B2 | `canon/summaries/*.md` | reference summaries | approval before overwrite |
| B3 | `status/resume-state.md`, `status/story-state.md` | working position | generated proposal, user editable |
| C1 | `.harness/artifacts/**` | outputs/evidence | generated |
| C2 | `.harness/proposals/**` | pending changes | generated, pending approval |
| C3 | `.harness/indexes/**`, `.harness/cache/**` | rebuildable indexes | generated |

Rules:

- AI cannot directly change A0/A1/A2.
- Prose candidates do not become canon until accepted.
- Summaries are reference, not authority.
- Every canon-changing output becomes a `CanonDeltaProposal` first.
- Branch artifacts cannot enter mainline context unless merged.

## 2. Project skeleton

```text
novel-project/
  project.yaml

  ideas/
    inbox.md
    seeds/
    premise-lab.md
    motif-bank.md
    research-questions.md

  status/
    canon-state.md
    story-state.md
    resume-state.md
    story-license.md
    world-readiness.md
    continuity-risks.md
    project-lineage.md

  manifest/
    project-index.md
    asset-registry.md
    branch-index.md
    update-log.md
    prompt-profiles.yaml
    agent-profiles.yaml

  story/
    chapters/
      ep001/
        index.md
        brief.md
        scene-plan.md
        manuscript.md
        scenes/
          sc001.md
          sc002.md
        accepted.md
    branches/

  canon/
    setting-bible.md
    bible-build-report.md
    summaries/
    deltas/

  characters/
    _template.md

  relationships/
    _template.md

  world/
    locations/
    institutions/
    systems/
    history/
    culture/
    rules/

  plot/
    series-outline.md
    story-envelope.md
    timeline.md
    open-threads.md
    plot-board.yaml
    parts/
      part-01.md

  style/
    style-guide.md
    prose-rules.md
    voice/
      _template.md
    presets/

  research/
    sources.md
    imported/

  .harness/
    runs/
    artifacts/
    proposals/
    snapshots/
    indexes/
    exchanges/
    cache/
    locks/
```

## 3. File frontmatter standards

### Idea seed

```yaml
---
type: idea_seed
status: inbox|candidate|promoted|discarded
genre_tags: []
source: user|ai|research
created_at: 2026-07-05
---
```

### Character sheet

```yaml
---
type: character
id: char_eira
name: 에이라
authority: A1
lineage: main
status: draft|canon|retired
first_appearance: ep001
aliases: []
locked: false
---
```

### Episode file

```yaml
---
type: episode
id: ep001
lineage: main
status: planning|drafting|review|accepted
pov: protagonist
target_chars: 5000
story_license: canon_strict
---
```

## 4. Status files

### `status/story-license.md`

Defines what AI may invent in the current stage.

```markdown
# Story License

## Mode
canon_strict

## Allowed
- Existing character dialogue and behavior extension.
- Descriptive detail inside approved locations.
- Minor clue insertion within approved conflict lanes.

## Blocked
- New major character.
- New institution.
- New world rule.
- Major reveal.
- POV knowledge beyond scene access.

## Approval required
- Any new named entity.
- Any relationship status change.
- Any open-thread closure.
```

### `plot/story-envelope.md`

Defines narrative boundary.

```markdown
# Story Envelope

## Authorized scope
- Part: part-01
- Episodes: ep001..ep020
- Locations: guild-office, lower-market
- POV: protagonist
- Conflict lanes: medical-risk, guild-politics

## Reveal budget
- major_reveal: 0
- medium_reveal: 1
- minor_clue: 3

## Blocked expansions
- Central kingdom politics.
- New magic system.
- Contract mastermind reveal.
```

### `status/resume-state.md`

One-file start point for next session.

```markdown
# Resume State

## Start here
- episode: ep001
- file: story/chapters/ep001/manuscript.md
- cursor_hint: after scene sc001 beat 3

## Safe actions
- continue current scene
- revise selected paragraph
- run prose QA

## Pending decisions
- proposal_canon_delta_ep001_001

## Warnings
- world_readiness: shallow
- open_threads: 3
```
