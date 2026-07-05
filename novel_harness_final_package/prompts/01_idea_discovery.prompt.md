# Idea Discovery Prompt

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