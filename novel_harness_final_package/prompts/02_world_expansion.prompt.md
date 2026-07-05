# World Expansion Prompt

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