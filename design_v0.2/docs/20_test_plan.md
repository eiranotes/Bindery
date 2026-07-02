# 20. Test Plan

## 1. Test layers

| Layer | Tool | Scope |
|---|---|---|
| Python unit | pytest | novelctl core, analyzers, schemas |
| Rust unit | cargo test | path validation, process runner, snapshot |
| Frontend unit | vitest | stores, parsers, components |
| Component | Playwright component or Testing Library | UI components |
| E2E | Playwright + Tauri driver | app workflows |
| Golden project | fixtures | end-to-end file outputs |

## 2. Golden project

Create a small test novel project:

```text
test-novel/
  story/chapters/ep001/
  story/chapters/ep002/
  characters/core/eira.md
  plot/open-threads.md
  style/reference-profile.md
```

Golden scenarios:

1. Open project.
2. Edit final.md.
3. Run repetition.
4. Run QA in mock mode.
5. Generate revision plan.
6. Create snapshot.
7. Restore snapshot.
8. Scan mentions.

## 3. Backend tests

### 3.1 Path sandbox

- reject absolute path.
- reject `../`.
- reject symlink outside project.
- allow normal project file.

### 3.2 Snapshot

- snapshot creates manifest.
- manifest hash matches files.
- restore creates pre-restore snapshot.
- restore updates files correctly.

### 3.3 Process runner

- command success.
- command failure.
- timeout.
- cancellation.
- stdout/stderr streaming.

## 4. Frontend tests

### 4.1 Editor

- load file.
- modify content.
- save.
- dirty indicator.
- frontmatter parse.
- QA diagnostic decoration.
- mention decoration.

### 4.2 Binder

- render tree.
- open file.
- filter by section.
- drag scene reorder.

### 4.3 QA Dashboard

- parse structured JSON block.
- show score cards.
- click issue opens file.
- malformed JSON fallback.

## 5. E2E flows

### Flow A: First project

```text
create project
→ open project
→ open ep001 brief
→ edit
→ save
→ run context in mock mode
→ verify context file appears
```

### Flow B: QA and revise

```text
open ep001 final
→ run qa all mock
→ dashboard appears
→ create revision plan
→ apply candidate diff
→ snapshot created
```

### Flow C: Dynamic Link

```text
create codex item Eira
→ write Eira in final
→ scan mentions
→ hover preview shown
→ apply link
```

## 6. Performance tests

Fixtures:

- 10 episodes
- 100 episodes
- 300 episodes
- 20k char episode
- 1000 codex aliases

Metrics:

- project open time.
- editor load time.
- mention scan time.
- repetition analysis time.
- QA dashboard parse time.

## 7. Manual QA checklist

- macOS file dialog works.
- Korean input in editor stable.
- IME composition not broken by decorations.
- autosave does not interrupt Korean typing.
- dark mode readable.
- large file scroll smooth.
- Gemini CLI missing error clear.
- external Obsidian edit conflict handled.
