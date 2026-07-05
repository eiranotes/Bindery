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
