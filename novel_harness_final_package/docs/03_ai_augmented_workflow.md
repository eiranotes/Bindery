# 03. AI-Augmented Workflow

AI is optional at every stage. Each AI stage writes a local output file that the user can inspect and edit.

## AI output types

| Output type | Directly editable? | Canon impact |
|---|---:|---|
| Idea suggestion | yes | none |
| Asset draft | yes | none until promoted |
| Bible draft | yes | none if conflicts with assets |
| Plot proposal | yes | none until applied |
| Episode brief draft | yes | planning state only |
| Scene plan draft | yes | planning state only |
| Prose candidate | via diff/apply | none until accepted |
| QA report | yes as notes | no direct change |
| Revision plan | yes | no direct change |
| Canon delta proposal | yes | canon only after approval |
| Summary candidate | yes | reference only after approval |

## Stage 1. AI 소재발굴

Input files:

```text
ideas/inbox.md
ideas/motif-bank.md
manifest/project-index.md (optional)
```

AI output:

```text
.harness/artifacts/{run}/idea-seeds.md
ideas/seeds/{seed_id}.md
```

User action:

- edit seed
- promote to premise
- merge/discard

## Stage 2. AI 소재 정제 / Premise Lab

Input:

- selected idea seed
- genre targets
- reader promise
- blocked preferences

Output:

```text
ideas/premise-lab.md
.harness/artifacts/{run}/premise-options.json
```

User selects one or hybridizes several.

## Stage 3. AI 세계관 확장

Input:

- chosen premise
- Story License mode
- genre convention
- blocked expansion list

Output:

```text
.harness/proposals/world-expansion-{run}.json
world/** draft sheets
characters/** draft sheets
relationships/** draft sheets
plot/story-envelope.md draft patch
```

User promotes selected assets.

## Stage 4. AI Asset Decomposition

Purpose: split raw setting/bible text into individual sheets.

Input:

- `canon/setting-bible.md` or raw notes
- existing asset registry

Output:

```text
.harness/proposals/asset-decomposition-{run}.json
characters/*.md draft
world/**/*.md draft
relationships/*.md draft
manifest/asset-registry.md patch
```

Rule: generated asset files are `status: draft` until promoted.

## Stage 5. AI Bible Assembly

Input:

- promoted assets
- story envelope
- plot outline
- style guide

Output:

```text
canon/setting-bible.md.candidate
canon/bible-build-report.md
.harness/proposals/bible-update-{run}.json
```

User can accept whole bible, apply sections, or edit manually.

## Stage 6. AI Plot Architecture

Input:

- project premise
- story bible
- story envelope
- open threads
- target length/episode count

Output:

```text
plot/series-outline.md.candidate
plot/parts/part-01.md.candidate
plot/plot-board.yaml.candidate
```

User applies cards/acts/threads.

## Stage 7. AI Episode Brief

Input:

- current plot card(s)
- open threads
- story license
- previous summaries
- character states

Output:

```text
story/chapters/ep001/brief.md.candidate
```

User edits before scene plan.

## Stage 8. AI Scene Plan

Input:

- episode brief
- required assets
- plot board
- location sheets
- character voice sheets

Output:

```text
story/chapters/ep001/scene-plan.md.candidate
plot/plot-board.yaml patch proposal
```

User applies/reorders.

## Stage 9. AI Draft Candidate

Input:

- scene plan
- context pack
- style/voice guide
- selected target scene or episode

Output:

```text
.harness/artifacts/{run}/draft-candidates/{candidate_id}.md
.harness/artifacts/{run}/draft-candidates/{candidate_id}.json
```

User applies by diff/hunk.

## Stage 10. AI QA

Three separate QA passes:

```text
prose QA       -> rhythm/style/repetition
fiction QA     -> plot/character/scene/reader promise
governance QA  -> canon/story-envelope/license/branch contamination
```

Output:

```text
.harness/artifacts/{run}/qa-prose.json
.harness/artifacts/{run}/qa-fiction.json
.harness/artifacts/{run}/qa-governance.json
story/chapters/ep001/qa-notes.md
```

## Stage 11. AI Revision Plan and Revised Candidate

Output:

```text
story/chapters/ep001/revision-plan.md.candidate
.harness/artifacts/{run}/revision-candidates/*.md
```

## Stage 12. AI Canon Delta

Input:

- accepted manuscript
- previous canon state
- asset registry
- open threads

Output:

```text
.harness/proposals/canon-delta-{episode}-{run}.json
canon/deltas/{episode}.candidate.md
```

User approves/edits/rejects.

## Stage 13. AI Summary and Resume State

Output:

```text
canon/summaries/ep001.md.candidate
status/resume-state.md.candidate
status/story-state.md.candidate
```

User approval updates reference files.

## AI execution posture

Every AI stage creates:

```text
.harness/runs/{run_id}/input-manifest.json
.harness/runs/{run_id}/prompt.md
.harness/runs/{run_id}/raw-output.*
.harness/runs/{run_id}/validated-output.json
.harness/runs/{run_id}/trace.json
```

Every stage also has a “no AI” fallback: user creates/edits the same target file manually.
