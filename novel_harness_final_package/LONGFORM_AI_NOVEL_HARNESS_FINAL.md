# Longform AI Novel Harness — Final Design Package

This zip is a ground-up design package for a local-first AI-assisted longform fiction harness. Bindery is treated as a reference implementation, not as the starting architecture.

## Core position

The product is not an AI text generator. It is a **local-first writing workspace** where AI helps the writer move through:

```text
소재발굴 -> 세계관 확장 -> 바이블 생성 -> 플롯 제작 -> 회차 설계 -> 장면 집필 -> QA -> 수정 -> 정사 동기화
```

The harness separates:

1. **Static writing workflow**: markdown files, editable boards, sheets, plotboards, canvas, task/status files.
2. **AI connection workflow**: local CLI adapter by default, optional API integration, optional web-AI file exchange import/export.

The writer must be able to read and edit every major output immediately as a local Markdown/YAML/JSON file.

## Package map

```text
docs/
  00_research_and_bindery_audit.md
  01_information_architecture.md
  02_static_writer_workflow.md
  03_ai_augmented_workflow.md
  04_prompt_blueprints.md
  05_ui_spec_pensiv_benchmark.md
  06_ai_connection_architecture.md
  07_code_structure.md
  08_schemas_and_contracts.md
  09_implementation_roadmap.md
  10_bindery_gap_mapping.md
  sources.md
schemas/
  *.schema.json
prompts/
  *.prompt.md
starter_project/
  local-first starter folder skeleton
```

## Implementation stance

- Markdown/YAML/JSON are the durable source of truth.
- SQLite/vector stores are indexes and caches, not truth.
- AI output is a candidate or proposal until the user approves it.
- A run can pause, resume, or branch.
- Prompt inputs and outputs are archived.
- CLI is default, using a provider profile with `-p` prompt mode where available/configured.
- Web AI is supported by exporting a stage-scoped exchange bundle and importing returned result files.


---

# 00. Research and Bindery Audit

## 1. External UI and workflow findings

### Pensiv benchmark

Pensiv’s documentation frames the app as a project workspace rather than a single document editor. Its layout model is: left sidebar for structure, top tabs for current context, center for active work, and expandable panels for split/multi-view work. The key takeaway is that the UI should communicate “which layer of thought am I editing?” rather than simply “which screen am I on?”

Pensiv’s file-type model is directly useful for this harness:

| Pensiv concept | Harness equivalent | Role |
|---|---|---|
| Document | manuscript, scene, episode brief | flowing prose or prose-adjacent planning |
| Sheet | character/place/system/relationship sheet | stable reference information |
| Plotboard | act/arc/episode/scene board | ordered structural planning |
| Canvas | relationship/world/causality graph | exploratory connections |
| Notes | idea inbox, scratch notes | pre-structured thinking |

Recent Pensiv changelog items also point to practical writer needs: global writing statistics, PDF export for documents/sheets/plotboards/canvases, version history beyond documents, keyboard navigation in the project tree, canvas connection handles, templates for reusable structure, and a writing agent beta that works inside the writing flow rather than as a detached chatbot.

### Scrivener benchmark

Scrivener’s durable lessons for a longform harness:

- Break long writing into sections/scenes.
- Keep research beside the manuscript.
- Let card/outliner rearrangement map back to manuscript order.
- Support snapshots and compare before large revisions.
- Track metadata, labels, status, keywords, writing targets, and export compilation.

The AI harness should not replace these writing-tool primitives. It should add AI-run traceability, candidate/proposal review, and canon synchronization around them.

### Workflow runtime benchmark

Long-running AI workflow systems emphasize:

- Durable execution.
- Checkpoints.
- Thread/run IDs for resume.
- Human-in-the-loop interrupts.
- Short-term run state separate from long-term memory/store.
- State visibility and traceability.

For fiction writing, this maps to:

```text
run checkpoint        -> .harness/runs/{run_id}/state.json
long-term story truth -> status/, characters/, world/, plot/, canon/
pending decisions     -> .harness/proposals/*.json
resume pointer        -> status/resume-state.md
```

### Structured output benchmark

Any AI output that updates state should be schema-constrained or at least schema-validated after generation. Markdown-only outputs are acceptable for prose candidates, but planning, QA, plot cards, asset sheets, canon deltas, and run manifests need JSON/YAML contracts.

## 2. Bindery audit

### What to keep

Bindery already contains several correct instincts:

- Local-first project folders.
- Candidate-first AI output.
- Diff/apply review instead of direct overwrite.
- Snapshot before candidate apply.
- Run/artifact logs under `.bindery`.
- Prompt preview and context guidance display.
- Style analysis and prompt capsule concept.
- QA/repetition/revision panels.
- Tauri native bridge plus browser/mock fallback.

### What is not enough for the requested end-to-end flow

The current Bindery AI flow starts too close to “current manuscript -> context -> draft -> analyze -> QA -> revision -> summary”. It does not yet cover the full creative pipeline:

```text
소재발굴 -> 세계관 확장 -> 바이블 생성 -> 플롯 제작 -> 집필
```

Major gaps:

1. **Idea discovery is not a first-class workflow**. Notes exist, but no structured idea inbox, premise matrix, trope/motif exploration, or concept promotion path.
2. **World expansion is not controlled by Story License**. AI can suggest world details, but no explicit allowed/blocked expansion boundary exists.
3. **Bible generation is a flat file template**. The current project seed creates `canon/setting-bible.md`, but it does not decompose assets into character/place/system/relationship sheets.
4. **EpisodeBrief and ScenePlan are still backlog items**. Draft generation currently occurs before a strong episode/scene planning layer.
5. **Canon Delta approval is missing**. Summary writes can feed later context, but AI-proposed canon changes are not forced through approval.
6. **Branch/lineage is not explicit**. Experiments and rewrites can contaminate mainline context.
7. **Prompt audit is underdeveloped**. The app can preview prompts, but does not fully audit included/excluded sources, authority levels, token budgets, stale sources, or branch contamination.
8. **Provider defaults are too mixed**. CLI settings exist, but provider-specific fallbacks and model options need one adapter profile contract.
9. **Web-AI roundtrip is absent**. Some users will want to upload a stage bundle to a web AI and import returned files.
10. **UI should shift from “AI stage rail” to “editable output surfaces”**. Every stage output should be a local file opened in the center editor or panel for immediate correction.

## 3. Design correction

The ground-up architecture must split the product into two layers:

```text
A. Static local writing system
   Files, sheets, plotboards, tasks, status, snapshots, outliner, canvas.

B. AI execution system
   Prompts, context packs, CLI/API/web exchange, validation, proposals, run trace.
```

The static layer must remain useful with AI disabled. The AI layer must produce editable files, not opaque app state.


---

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


---

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


---

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


---

# 04. Prompt Blueprints

## 1. Common prompt envelope

All AI calls should use the same envelope structure. The concrete stage prompt fills the `TASK`, `INPUTS`, and `OUTPUT CONTRACT` sections.

```text
# SYSTEM ROLE
You are a longform Korean fiction development assistant. You do not decide canon. You produce candidates, analyses, or proposals for the human author.

# PROJECT AUTHORITY
- Canon authority order: {authority_order}
- Story License mode: {story_license_mode}
- Current lineage: {lineage}
- Current episode: {episode_id}

# HARD RULES
- Do not create new canon facts unless the task explicitly asks for a proposal.
- Do not overwrite source text.
- Respect blocked expansions and reveal budget.
- When uncertain, mark as assumption or question.
- Output only the requested format.

# TASK
{stage_task}

# INPUT MANIFEST
{context_manifest_summary}

# HARD CONTEXT
{hard_context}

# SOFT CONTEXT
{soft_context}

# REFERENCE CONTEXT
{reference_context}

# USER DIRECTIVES
{user_directives}

# OUTPUT CONTRACT
{schema_or_markdown_contract}
```

## 2. Stage prompt injection rules

| Section | Injects | Notes |
|---|---|---|
| HARD CONTEXT | canon-state, story-license, story-envelope, approved asset sheets | model must obey |
| SOFT CONTEXT | style guide, genre target, pacing preference | model can bend if stated |
| REFERENCE CONTEXT | summaries, research, notes | model may use but not create facts from it |
| CANDIDATE CONTEXT | unapproved proposals | clearly label as not canon |
| USER DIRECTIVES | current form controls, selected text, task notes | highest local instruction if not conflicting with hard rules |

## 3. 소재발굴 prompt

File: `prompts/01_idea_discovery.prompt.md`

```text
# TASK
Generate 10 idea seeds for a Korean longform/webnovel project.

# INPUTS
- Genre preference: {genre_tags}
- Emotional target: {emotional_target}
- Avoid list: {avoid_list}
- Existing motif bank: {motif_bank}
- User free notes: {user_notes}

# REQUIREMENTS
For each seed, provide:
1. title
2. one-line hook
3. emotional engine
4. reader promise
5. world/cast implication
6. longform potential
7. risk of becoming generic
8. first-scene image

# OUTPUT
Return markdown with exactly 10 sections.
Do not create canon files.
```

## 4. 소재 정제 / Premise selection prompt

```text
# TASK
Evaluate and refine selected idea seeds into premise candidates.

# INPUTS
{selected_idea_seeds}
{genre_constraints}
{target_platform_style}

# EVALUATION AXES
- serial durability
- conflict engine
- character pressure
- world expansion potential
- early hook strength
- risk of lore overload
- title/logline clarity

# OUTPUT JSON
{
  "schema": "PremiseOptions.v1",
  "options": [
    {
      "id": "premise_a",
      "logline": "",
      "core_conflict": "",
      "reader_promise": "",
      "longform_engine": "",
      "first_5_episode_direction": "",
      "risks": [],
      "recommended_next_step": ""
    }
  ]
}
```

## 5. 세계관 확장 prompt

```text
# TASK
Expand the approved premise into a controlled world asset map.

# HARD CONTEXT
{story_license}
{story_envelope_if_any}

# INPUTS
{approved_premise}
{blocked_expansions}
{genre_expectations}

# REQUIREMENTS
- Separate assets into characters, locations, institutions, systems, history, culture, conflicts.
- Mark every proposed asset as draft.
- Do not overbuild. Prioritize assets needed for the first 10 episodes.
- Identify unknowns rather than filling everything.

# OUTPUT JSON
WorldExpansionProposal.v1
```

## 6. Asset decomposition prompt

```text
# TASK
Decompose the supplied raw bible/notes into local-first asset sheets.

# INPUTS
{raw_bible_or_notes}
{existing_asset_registry}

# RULES
- If a fact belongs to one character, put it in that character sheet.
- If a fact governs the world, put it under world/systems.
- If a fact describes a place, put it under world/locations.
- If a fact describes an organization, put it under world/institutions.
- If two assets conflict, do not resolve silently. Create a conflict note.

# OUTPUT
Return:
1. AssetDecompositionProposal JSON
2. Markdown file bodies keyed by path
```

## 7. Bible assembly prompt

```text
# TASK
Assemble a readable setting bible from approved asset files.

# INPUTS
{asset_registry}
{approved_asset_summaries}
{story_envelope}
{open_threads}

# RULES
- The bible is a synthesized reading surface, not the source of truth.
- Include source path references for each major fact.
- Mark unresolved gaps.
- Do not invent missing facts.

# OUTPUT MARKDOWN
# Setting Bible
## Project premise
## Core cast
## World rules
## Places
## Institutions
## Timeline
## Open threads
## Unknowns and decisions needed
```

## 8. Plot architecture prompt

```text
# TASK
Create a longform plot architecture from premise and bible.

# INPUTS
{premise}
{setting_bible}
{story_envelope}
{open_threads}
{target_episode_count}

# REQUIREMENTS
- Separate series arc, part arc, episode arc.
- Keep reveal budget explicit.
- Maintain open thread lifecycle.
- Produce cards that can be edited independently.

# OUTPUT
1. series-outline.md candidate
2. plot-board.yaml candidate
3. open-thread changes as proposals only
```

## 9. Episode brief prompt

```text
# TASK
Create or revise an Episode Brief for {episode_id}.

# HARD CONTEXT
{canon_state}
{story_license}
{story_envelope}

# INPUTS
{plot_cards_for_episode}
{previous_episode_summary}
{open_threads}
{character_states}

# OUTPUT MARKDOWN
# {episode_id} Brief
## Episode promise
## Must accomplish
## Must avoid
## POV and knowledge boundary
## Required assets
## Open threads touched
## Target length
## Ending state
## Questions for human author
```

## 10. Scene plan prompt

```text
# TASK
Create a scene-by-scene plan for {episode_id}.

# INPUTS
{episode_brief}
{required_assets}
{location_constraints}
{voice_constraints}
{plot_board_context}

# RULES
- Every scene must have a purpose.
- Every scene must have an entry image and exit state.
- List blocked reveals per scene.
- Do not add new named assets unless marked as proposal.

# OUTPUT JSON
ScenePlan.v1
```

## 11. Draft candidate prompt

```text
# TASK
Write a prose candidate for the selected scope.

# SCOPE
- episode: {episode_id}
- scene: {scene_id_or_all}
- operation: draft|continue|rewrite
- target length: {target_chars}

# HARD CONTEXT
{canon_state}
{story_license}
{story_envelope}
{approved_asset_sheets}
{scene_plan}

# SOFT CONTEXT
{style_guide}
{voice_guides}
{pacing_preferences}

# REFERENCE CONTEXT
{previous_summaries}
{open_threads}
{research_notes}

# CURRENT TEXT
{base_manuscript_or_selected_text}

# REQUIREMENTS
- Return manuscript markdown only in the candidate body.
- Preserve frontmatter unless asked otherwise.
- Do not explain outside the required envelope.
- If you introduce a possible new fact, add it to `canon_risk_flags`.

# OUTPUT JSON
DraftCandidateEnvelope.v1
```

## 12. Prose QA prompt

```text
# TASK
Analyze prose quality without changing the manuscript.

# CHECKS
- repetition
- sentence ending pattern
- dialogue tag repetition
- cliche reaction gestures
- style-guide compliance
- voice drift
- scene rhythm

# OUTPUT JSON
QAReportEnvelope.v1 with qa_type="prose"
Every warn/block issue must include evidence.
```

## 13. Fiction QA prompt

```text
# TASK
Analyze the episode as fiction.

# CHECKS
- episode promise fulfilled
- scene purpose fulfilled
- character motivation legible
- reader question maintained
- pacing and escalation
- ending hook
- plot card consistency

# OUTPUT JSON
QAReportEnvelope.v1 with qa_type="fiction"
```

## 14. Governance QA prompt

```text
# TASK
Check canon, license, story-envelope, and branch safety.

# HARD CONTEXT
{authority_order}
{canon_state}
{story_license}
{story_envelope}
{branch_index}
{approved_assets}

# CHECKS
- new named entities
- unauthorized world expansion
- blocked reveal
- POV knowledge violation
- canon contradiction
- branch contamination
- unapproved proposal leakage

# OUTPUT JSON
QAReportEnvelope.v1 with qa_type="governance"
```

## 15. Revision plan prompt

```text
# TASK
Convert QA issues into a concrete revision plan.

# INPUTS
{qa_reports}
{current_manuscript}
{episode_brief}

# OUTPUT MARKDOWN
# Revision Plan
## Blocking fixes
- [ ] ...
## Style/prose improvements
- [ ] ...
## Optional improvements
- [ ] ...
## Suggested candidate generation scopes
```

## 16. Canon Delta prompt

```text
# TASK
Extract possible canon changes from the accepted manuscript.

# INPUTS
{accepted_manuscript}
{current_asset_sheets}
{open_threads}
{canon_state}

# RULES
- Do not apply changes.
- Create patch proposals only.
- Mark risk and target path for every change.
- If a change is implied but not explicit, mark as assumption.

# OUTPUT JSON
CanonDeltaProposal.v1
```

## 17. Summary and resume prompt

```text
# TASK
Create a reference summary and next-session resume state.

# INPUTS
{accepted_manuscript}
{episode_brief}
{approved_canon_delta_summary}
{open_threads_after_episode}

# OUTPUT
1. EpisodeSummary.v1 JSON
2. resume-state.md candidate
3. story-state.md candidate
```

## 18. Web-AI exchange prompt

This prompt is packaged in an exchange bundle when the user wants to upload files to a web AI.

```text
You are processing an exported local-first fiction harness exchange bundle.

Read:
- instructions.md
- context-manifest.json
- prompt.md
- schemas/output.schema.json
- context/*.md
- target/*.md

Return:
- result.json that matches the schema
- result.md when markdown output is requested
- notes.md for assumptions/questions

Do not modify source files directly. If you propose file changes, return patches in result.json.
```


---

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


---

# 06. AI Connection Architecture

## 1. Separation of concerns

```text
Static layer
  Local files, editor, plotboard, sheets, snapshots, proposals.

AI layer
  Prompt builder, context pack, provider adapter, output validator, run trace.
```

The static layer must never depend on a working AI provider.

## 2. Agent profiles

File: `manifest/agent-profiles.yaml`

```yaml
version: 1
default_profile: local_cli_default

profiles:
  local_cli_default:
    kind: cli
    command: ai
    prompt_arg: "-p"
    model_arg: "--model"
    default_model: ""
    output_mode: stdout
    extra_args: []
    timeout_sec: 240
    cwd: project_root

  codex_cli:
    kind: cli
    command: codex
    prompt_arg: "-p"
    model_arg: "--model"
    default_model: ""
    output_mode: file
    extra_args: []
    timeout_sec: 240

  gemini_cli:
    kind: cli
    command: gemini
    prompt_arg: "-p"
    model_arg: "--model"
    default_model: ""
    output_mode: stdout
    extra_args: []
    timeout_sec: 240

  custom_web_exchange:
    kind: web_exchange
    export_dir: .harness/exchanges
    result_import_patterns:
      - result.json
      - result.md
      - result.zip
```

The app should not hard-code exact provider flags beyond the profile. Default assumption is:

```bash
{command} {model_arg} {model} {extra_args...} {prompt_arg} <prompt>
```

If a provider requires file output, the profile sets:

```yaml
output_mode: file
output_instruction: "Write the final result to {output_path}. Do not modify other files."
```

## 3. CLI execution modes

### stdout mode

```text
prompt.md -> command -p prompt -> stdout -> raw-output.txt -> validator -> artifact/proposal
```

### file mode

```text
prompt.md -> command -p wrapped_prompt_with_output_path -> output file -> raw-output.* -> validator
```

### structured mode

```text
prompt.md + schema.json -> command -> result.json -> JSON Schema validation -> typed object
```

### dry-run mode

Builds prompt/context/output paths without calling AI.

## 4. Adapter interface

```ts
export type AgentProfile = {
  id: string;
  kind: 'cli' | 'api' | 'web_exchange' | 'mock';
  command?: string;
  promptArg?: string;
  modelArg?: string;
  model?: string;
  extraArgs?: string[];
  outputMode: 'stdout' | 'file' | 'structured';
  timeoutSec: number;
};

export interface AgentAdapter {
  id: string;
  healthCheck(): Promise<AgentHealth>;
  runText(req: AgentTextRequest): Promise<AgentRunResult>;
  runStructured<T>(req: AgentStructuredRequest<T>): Promise<AgentStructuredResult<T>>;
}
```

## 5. Run trace

Every AI call writes:

```json
{
  "run_id": "run_20260705_ep001_001",
  "stage": "draft_candidate",
  "profile": "codex_cli",
  "command": "codex",
  "model": "user_configured_model",
  "prompt_path": ".harness/runs/.../prompt.md",
  "context_manifest": ".harness/runs/.../context-manifest.json",
  "schema_path": "schemas/DraftCandidateEnvelope.v1.schema.json",
  "raw_output_path": ".harness/runs/.../raw-output.txt",
  "validated_output_path": ".harness/runs/.../validated-output.json",
  "exit_code": 0,
  "started_at": "...",
  "finished_at": "...",
  "fallback": false
}
```

## 6. Web-AI exchange mode

Some users will use web AI manually. The app should support that without pretending to automate the website.

### Export bundle

Command:

```bash
novelh exchange export ep001 --stage scene-plan
```

Bundle:

```text
.harness/exchanges/exchange_ep001_scene-plan_001.zip
  instructions.md
  prompt.md
  context-manifest.json
  schemas/output.schema.json
  context/
    canon-state.md
    story-license.md
    story-envelope.md
    characters_eira.md
    previous-summary.md
  target/
    brief.md
    scene-plan.md
  return-format.md
```

### User flow

```text
Export web-AI bundle
-> user uploads zip or selected files to ChatGPT/Gemini/Claude web UI
-> user asks model to return result.json/result.md
-> user downloads result or copies output
-> app imports result
-> schema validation
-> preview diff/proposal
-> user accepts/rejects
```

### Import rules

- Accept `result.json`, `result.md`, or `result.zip`.
- Validate against the expected schema.
- Never apply directly.
- Store raw imported file in `.harness/exchanges/{exchange_id}/imported/`.
- Create a proposal or artifact after validation.

## 7. API integration path

Optional later path:

- OpenAI Responses API with Structured Outputs for schema-constrained results.
- File search/vector store for hosted retrieval if the user opts in.
- Local FTS/vector index remains default for local-first mode.

## 8. Security and locality posture

- Default: local files + user-configured CLI.
- API: opt-in.
- Web exchange: explicit export/upload/import controlled by user.
- Do not silently upload project files.
- Every upload bundle has a manifest showing included files.
- Sensitive paths can be excluded through `.harnessignore`.

Example `.harnessignore`:

```text
research/private/**
notes/personal/**
*.secret.md
```


---

# 07. Code Structure Design

## 1. Recommended monorepo

```text
novelh/
  apps/
    desktop/                 # Tauri + Svelte UI
    cli/                     # thin wrapper around core

  packages/
    core/                    # TypeScript pure domain if staying TS-first
    ui/                      # shared UI components

  crates/
    harness-core/            # Rust domain/runtime if Rust-first
    harness-fs/              # filesystem, snapshots, path safety
    harness-agent/           # CLI/API/web-exchange adapters
    harness-index/           # SQLite FTS/vector cache
    harness-tauri/           # Tauri command bridge

  schemas/
  prompts/
  templates/
```

Either TS-first or Rust-first is possible. For a Tauri desktop app, a strong split is:

- Rust: file safety, snapshots, run ledger, CLI process execution, schema validation, SQLite index.
- TypeScript/Svelte: editor, UI state, panels, command palette, diff rendering.

## 2. Static layer modules

```text
src/lib/static/
  projectTree.ts
  fileTypes.ts
  authority.ts
  markdown.ts
  frontmatter.ts
  plotBoard.ts
  assetRegistry.ts
  snapshots.ts
  stats.ts
```

Responsibilities:

- Read/write local files.
- Render/editor state.
- Update markdown/yaml files.
- Track dirty state.
- No model calls.

## 3. AI layer modules

```text
src/lib/ai/
  profiles.ts
  adapter.ts
  cliAdapter.ts
  apiAdapter.ts
  webExchange.ts
  promptBuilder.ts
  contextComposer.ts
  schemaValidator.ts
  runLedger.ts
  artifactLedger.ts
  proposalLedger.ts
  promptAudit.ts
```

Responsibilities:

- Build prompts.
- Build context manifest.
- Run provider.
- Validate output.
- Write trace/artifacts/proposals.
- Never directly mutate canon/manuscript files.

## 4. Pipeline modules

```text
src/lib/pipeline/
  definitions.ts
  runner.ts
  transitions.ts
  interrupts.ts
  stages/
    ideaDiscovery.ts
    premiseLab.ts
    worldExpansion.ts
    assetDecomposition.ts
    bibleAssembly.ts
    plotArchitecture.ts
    episodeBrief.ts
    scenePlan.ts
    draftCandidate.ts
    proseQA.ts
    fictionQA.ts
    governanceQA.ts
    revisionPlan.ts
    canonDelta.ts
    summaryResume.ts
```

## 5. UI components

```text
src/lib/components/
  shell/
    AppShell.svelte
    Sidebar.svelte
    TopTabs.svelte
    Inspector.svelte
    CommandPalette.svelte
  ideas/
    IdeaBoard.svelte
    PremiseLab.svelte
  world/
    AssetSheetEditor.svelte
    WorldCanvas.svelte
  bible/
    BibleWorkspace.svelte
    SourceCoveragePanel.svelte
  plot/
    PlotBoard.svelte
    TimelineView.svelte
    OpenThreadsPanel.svelte
  write/
    MarkdownEditor.svelte
    SceneNavigator.svelte
    ReferenceSplit.svelte
  review/
    CandidateDiff.svelte
    QAReportPanel.svelte
    RevisionPlanPanel.svelte
  canon/
    ProposalList.svelte
    ProposalDiff.svelte
    CanonDeltaReview.svelte
  ai/
    RunConsole.svelte
    PromptAuditPanel.svelte
    WebExchangePanel.svelte
```

## 6. Core interfaces

### Pipeline stage

```ts
export interface PipelineStage<I, O> {
  id: StageId;
  version: number;
  targetFile?: string;
  buildInput(ctx: StageContext): Promise<I>;
  buildPrompt(input: I): Promise<PromptBundle>;
  run(prompt: PromptBundle, adapter: AgentAdapter): Promise<RawOutput>;
  validate(raw: RawOutput): Promise<O>;
  persist(output: O): Promise<StageArtifacts>;
  next(output: O): StageTransition;
}
```

### Stage transition

```ts
export type StageTransition =
  | { kind: 'continue'; next: StageId }
  | { kind: 'interrupt'; interrupt: HumanInterrupt }
  | { kind: 'stop' }
  | { kind: 'failed'; reason: string };
```

### Human interrupt

```ts
export type HumanInterrupt = {
  id: string;
  reason:
    | 'review_edit_file'
    | 'approve_proposal'
    | 'resolve_conflict'
    | 'choose_candidate'
    | 'confirm_apply';
  payload: unknown;
  resumeSchema: string;
};
```

## 7. Stores

```text
projectStore       # current root, current branch, recent projects
fileStore          # tree, selected file, dirty buffers
workspaceStore     # tabs, splits, inspector state
runStore           # active run, checkpoints, history
artifactStore      # latest artifacts by stage/run
proposalStore      # pending/approved/rejected proposals
aiProfileStore     # current provider profile
promptAuditStore   # latest prompt/source/token audit
```

## 8. Tauri commands

```rust
#[tauri::command]
fn open_project(path: String) -> Result<ProjectInfo>;
#[tauri::command]
fn read_file(project: String, path: String) -> Result<FileContent>;
#[tauri::command]
fn write_file(project: String, path: String, content: String) -> Result<()>;
#[tauri::command]
fn create_snapshot(project: String, path: String, label: String) -> Result<SnapshotInfo>;
#[tauri::command]
fn run_ai_stage(project: String, request: StageRunRequest) -> Result<StageRunResult>;
#[tauri::command]
fn export_web_exchange(project: String, request: ExchangeExportRequest) -> Result<ExchangeInfo>;
#[tauri::command]
fn import_web_exchange_result(project: String, path: String) -> Result<ImportResult>;
#[tauri::command]
fn approve_proposal(project: String, proposal_id: String) -> Result<ApplyResult>;
#[tauri::command]
fn rebuild_index(project: String) -> Result<IndexReport>;
```

## 9. Path safety

- Reject absolute target paths inside project write API.
- Reject `..` traversal.
- Resolve symlinks before write.
- Only `.harness/tmp`, `.harness/exchanges`, `.harness/artifacts` are AI-write targets.
- Canon/manuscript writes happen only through proposal/apply functions.


---

# 08. Schemas and Contracts

The `schemas/` directory contains starter JSON Schemas. The important design rules are:

- Every state-changing AI output is schema validated.
- Markdown prose candidates can be wrapped in JSON envelopes.
- `additionalProperties: false` is used where strictness is needed.
- Every issue/proposal must contain evidence or target path.

## Core contracts

| Schema | Used by |
|---|---|
| `IdeaSeed.v1.schema.json` | idea discovery |
| `WorldExpansionProposal.v1.schema.json` | world expansion |
| `ScenePlan.v1.schema.json` | scene planning |
| `DraftCandidateEnvelope.v1.schema.json` | draft/continue/rewrite |
| `QAReportEnvelope.v1.schema.json` | prose/fiction/governance QA |
| `CanonDeltaProposal.v1.schema.json` | canon sync |
| `WebExchangeManifest.v1.schema.json` | web-AI export/import |

## Validation flow

```text
raw output
-> parse
-> schema validation
-> repair loop if allowed
-> typed object
-> artifact/proposal
-> human review
-> apply
```

Repair loop is allowed only for format errors, not for canon conflicts. Canon conflicts require human review.


---

# 09. Implementation Roadmap

## Phase 0 — Static local workspace

Build without AI first:

- Project skeleton.
- Sidebar/tree/tabs/editor.
- Idea inbox.
- Asset sheet editor.
- Plotboard YAML editor.
- Episode brief and scene plan files.
- Snapshot/compare.
- Proposal folder and manual proposal review.

Exit criteria:

- A writer can move from idea to brief to scene plan to manuscript manually.

## Phase 1 — Prompt/context infrastructure

- ContextManifest builder.
- Prompt builder.
- Prompt Audit panel.
- Run/artifact ledger.
- Schema validator.
- Agent profiles.

Exit criteria:

- User can preview exactly what will be sent to AI.
- User can run dry-run prompt exports.

## Phase 2 — Local CLI AI

- CLI adapter with `-p` prompt arg profile.
- stdout/file mode.
- model/extra args in profile.
- stage outputs for idea, world, bible, plot, brief, scene plan, draft.

Exit criteria:

- AI output always lands in editable file/candidate/proposal.

## Phase 3 — Review and governance

- Candidate diff/apply.
- Prose/Fiction/Governance QA split.
- CanonDeltaProposal.
- Story License and Story Envelope gates.

Exit criteria:

- Governance block prevents unsafe apply.

## Phase 4 — Web-AI exchange

- Export exchange bundle.
- Import result.json/result.md/result.zip.
- Validate imported output.
- Create artifacts/proposals from import.

Exit criteria:

- User can use ChatGPT/Gemini/Claude web UI manually while preserving local audit trail.

## Phase 5 — Retrieval and index

- SQLite FTS.
- Asset/source metadata.
- Branch/authority filters.
- Optional vector index.
- Prompt source selection UI.

## Phase 6 — Branch/lineage and advanced planning

- Branch index.
- Branch-scoped context.
- Branch merge proposals.
- Graph/canvas relationship editing.
- Long-range arc QA.


---

# 10. Bindery Gap Mapping

## What Bindery already covers

| Area | Current Bindery asset | Keep? |
|---|---|---|
| Local-first project | project folder with `story/`, `canon/`, `plot/`, `notes/` | yes |
| AI connection | CLI settings, test command, native bridge | yes, but profile-unify |
| Candidate review | candidateStore, CandidateDiffPanel, hunk apply | yes |
| Snapshot safety | snapshot before apply | yes |
| Artifacts | `.bindery/artifacts` and index | yes |
| Run persistence | `.bindery/runs` run history | yes |
| Prompt preview | `assemblePrompt`, guidance sections | yes |
| Style system | style profiles, prompt capsule, score | yes |
| QA/revision | QA dashboard, revision panel | yes |

## What must be added or redesigned

| Missing/weak area | Replacement design |
|---|---|
| Idea discovery | `ideas/` workspace + idea seed prompts |
| World expansion | asset sheets + Story License + expansion proposal |
| Bible generation | asset-source assembly, not a flat template |
| Plot before draft | plot architecture, episode brief, scene plan before prose |
| Canon control | CanonDeltaProposal + approval UI |
| Branch safety | branch-index + lineage-aware context |
| Prompt audit | included/excluded source, authority, token, stale/branch warnings |
| Provider consistency | `agent-profiles.yaml` and adapter interface |
| Web AI usage | exchange bundle export/import |
| UI mental model | editable output surfaces, not isolated AI rail |
| Static-vs-AI split | static files remain useful without AI |

## Practical migration path from Bindery

1. Keep existing editor, file tree, snapshot, candidate diff, style system.
2. Add `ideas/`, `status/`, `manifest/`, expanded `world/` folders to project creation.
3. Add static UI surfaces for Ideas, World, Bible, Plot.
4. Move AI actions into each surface.
5. Introduce `agent-profiles.yaml` without removing current settings UI.
6. Add prompt audit and context manifest.
7. Add EpisodeBrief/ScenePlan stages before draft.
8. Add CanonDeltaProposal and approval desk.
9. Add web-AI exchange export/import.
10. Split QA into prose/fiction/governance.


---

# Sources and research notes

This package uses the following public references as design inputs.

## Pensiv / 펜시브

- Pensiv documentation index and UI model: https://docs.pensiv.so/
- Pensiv overall structure: https://docs.pensiv.so/en/guide/basic-ui-and-navigation/structure
- Pensiv file types: https://docs.pensiv.so/en/guide/file-types
- Pensiv changelog: https://pensiv.so/ko/changelog
- Pensiv writing tool comparison: https://pensiv.so/ko/blog/writing-program-comparison
- Pensiv Scrivener alternative article: https://pensiv.so/ko/blog/scrivener-alternative

Extracted UI principles:

- Left sidebar is a structure map, not just navigation.
- Top tabs hold current working context.
- Center panel is the active focus surface.
- Panels can split, lock, move, and grow.
- File types are roles of thought: document, sheet, plotboard, canvas, note.
- Recent Pensiv updates emphasize writing statistics, PDF export, version history across item types, keyboard tree navigation, canvas interactions, templates, and a writing agent beta.

## Scrivener

- Scrivener overview: https://www.literatureandlatte.com/scrivener/overview

Extracted principles:

- Long manuscripts should be broken into sections/scenes.
- Research should be visible beside the manuscript.
- Corkboard/outliner operations should affect manuscript order.
- Snapshot/compare is central for major rewrites.
- Metadata, labels, status, writing targets, and compilation/export matter in long-form writing.

## Long-running AI workflow references

- LangGraph overview: https://docs.langchain.com/oss/python/langgraph/overview
- LangGraph persistence: https://docs.langchain.com/oss/python/langgraph/persistence
- LangGraph interrupts: https://docs.langchain.com/oss/python/langgraph/interrupts

Extracted runtime principles:

- Long-running stateful workflows need durable execution, persistence, checkpointing, human-in-the-loop, and memory separation.
- Short-term thread/checkpoint state and long-term store/memory should be separate.
- Human approval and review points should be explicit interrupts with JSON-serializable payloads.
- Resume uses the same thread/run pointer.

## OpenAI references for optional API/web integration

- Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- File search: https://developers.openai.com/api/docs/guides/tools-file-search
- ChatGPT file upload FAQ: https://help.openai.com/en/articles/8555545-file-uploads-with-gpts-and-advanced-data-analysis-in-chatgpt

Extracted AI integration principles:

- Structured output should prefer schema-constrained outputs over loose JSON mode.
- File search can be used as an optional hosted retrieval path when using API integration.
- ChatGPT file upload limits imply that a web-AI roundtrip bundle should be compact, stage-scoped, and validated on import.

## Bindery repository review basis

Repository: eiranotes/Bindery

Reviewed areas:

- AI flow documentation: docs/AI_WRITING_PIPELINE_FLOW_20260703.md
- Task backlog: docs/TASKS.md
- AIStudio and Mission Control UI components
- Pipeline action layer and prompt/guidance code
- Run/artifact stores
- Candidate diff/apply implementation
- Tauri project seed and native command bridge

Extracted observations:

- Valuable: local-first files, candidate-first diff/apply, snapshot before apply, run/artifact logs, prompt preview, style system.
- Missing for a ground-up longform harness: idea discovery, world expansion, bible generation, dedicated plot/episode/scene planning before draft, canon authority, Story License, Story Envelope, Canon Delta approval, branch/lineage, web-AI exchange, prompt audit, provider-neutral adapter contracts, and a clear static-vs-AI separation.
