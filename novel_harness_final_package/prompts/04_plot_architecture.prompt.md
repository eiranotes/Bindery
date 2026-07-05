# Plot Architecture Prompt

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