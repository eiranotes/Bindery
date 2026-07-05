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
