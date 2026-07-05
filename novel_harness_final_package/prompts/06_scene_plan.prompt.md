# Scene Plan Prompt

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