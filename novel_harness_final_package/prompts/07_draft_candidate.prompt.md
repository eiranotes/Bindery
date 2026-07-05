# Draft Candidate Prompt

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