# 19. Risk Register

## 1. Technical risks

| Risk | Impact | Mitigation |
|---|---|---|
| Gemini CLI output format changes | Agent pipeline breaks | wrap all calls in novelctl adapter; store raw logs; schema validation |
| CodeMirror decoration performance | slow editor on long files | incremental decorations, worker analysis, viewport-only decorations |
| File watcher conflicts | user loses edits | expected_hash write, conflict dialog, autosave pause |
| Python packaging in Tauri | hard cross-platform distribution | MVP external novelctl, later bundled binary |
| Markdown/WYSIWYG mismatch | data corruption | source editor first, Tiptap optional only |
| Large project indexing slow | poor startup | SQLite cache, incremental indexing, background rebuild |
| AI writes invalid paths | broken reports | path validation and orphan report UI |
| Snapshot storage grows too large | disk bloat | snapshot pruning policy and compression option |

## 2. Product risks

| Risk | Impact | Mitigation |
|---|---|---|
| Too many panels | UI fatigue | progressive disclosure, compact mode, command palette |
| QA becomes oppressive | creativity drops | separate QA/analysis, sliders, procedural suggestions |
| Markdown folder structure too complex | adoption friction | templates, guided new project, hide internals by default |
| Users trust AI final too much | continuity errors | diff-first apply, QA rerun reminders |
| GUI duplicates Obsidian poorly | weak value | focus on AI pipeline, QA, analysis, agent integration |

## 3. Data safety risks

| Risk | Mitigation |
|---|---|
| accidental overwrite | snapshots before destructive actions |
| external editor conflict | file hash conflict detection |
| bad AI rewrite | candidate output + diff apply |
| canon corruption | canon delta review, locked/provisional states |
| private notes sent to AI | input manifest preview, deny patterns |

## 4. Architecture risks

### 4.1 CLI and GUI divergence

If GUI implements its own logic and CLI implements another, results diverge.

Mitigation:

- GUI calls CLI/core for all domain logic.
- Shared schemas.
- Same templates.
- Golden test projects.

### 4.2 Agent prompt sprawl

Too many agents with inconsistent output contracts.

Mitigation:

- agent prompt template.
- output contract validation.
- agent test fixtures.
- prompt versioning.

### 4.3 Analysis overfitting

Repetition/QA metrics may encourage bland prose.

Mitigation:

- mark intentional repetition.
- display distribution, not just count.
- revision suggestions are optional.
- creative draft mode is loose.
