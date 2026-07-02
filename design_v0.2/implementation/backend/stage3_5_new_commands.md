# Stage 3.5 — New Tauri Command Interfaces

These commands were added in the Stage 3.5 UI layer. The frontend already calls
them through `$lib/api/commands.ts` using the `getInvoke()` pattern: when the
Tauri runtime is present the real command runs, otherwise a deterministic mock
executes so browser mode exercises the same UI. Only the Rust side remains to be
implemented; the TypeScript signatures below are the source of truth for the
bridge.

## Envelope

Reuse the existing `run_novelctl` JSON envelope where a job is involved.
Pure-data reads may return the payload directly (the frontend wrapper already
unwraps). Keep argument names identical to those below (camelCase in JS →
snake or camel in Rust per your `#[tauri::command]` convention).

## Commands

### run_qa
```ts
invoke<{ report: string }>('run_qa', { projectPath: string, episode: string })
```
Runs the QA agents for an episode and returns the aggregate QA report Markdown
(with the embedded `<!-- novelstudio:qa-json … -->` block). Frontend parses it
via `parseQAReport`. Implementation should shell out to
`novelctl qa <episode> --json` then read the produced `qa.md`.

### generate_revision_plan
```ts
invoke<{ plan: string }>('generate_revision_plan', { projectPath: string, episode: string })
```
Returns the revision-plan Markdown. Frontend parses with `parseRevisionPlan`.
Maps to `novelctl revise <episode>`.

### generate_candidate
```ts
type Candidate = { id: string; label: string; content: string; source: string; createdAt: string };
invoke<Candidate[]>('generate_candidate', {
  projectPath: string, episode: string,
  kind: 'draft' | 'revise' | 'continue' | 'rewrite',
  base: string   // current working document, for diff-based rewrite prompts
})
```
Draft/rewrite agents must write candidate files under
`.novelctl/runs/<run-id>/` (agent_output_contract.md), never overwrite the
draft. This command returns the candidate contents so the GUI can diff them
against the working document. Return ≥1 variant; two enables the A/B apply UI.

### list_codex
```ts
invoke<CodexItem[]>('list_codex', { projectPath: string })
```
Reads `characters/`, `world/`, `relationships/`, `lore/`, `canon/` and returns
`CodexItem[]` (see `$lib/domain/codex.ts` / `codex-item.schema.json`). Alias
`auto_link` / `min_length` come from each item's frontmatter.

### scan_codex_links
```ts
invoke<MentionReport>('scan_codex_links', { projectPath: string, path: string })
```
Runs the Dynamic Link scan against a document and returns the mention report.
The scoring reference implementation lives in `scanDynamicLinks` — the Rust side
should mirror the confidence factors table in `13_codex_dynamic_links.md §4.2`
so decorations stay consistent between mock and native. Note: the mock branch
passes `content` too and scans client-side; the native command only needs
`projectPath` + `path` and reads the file itself.

### get_plot_grid
```ts
invoke<PlotGrid>('get_plot_grid', { projectPath: string })
```
Builds the Plot Grid from scene frontmatter + `plot/*.yaml` (see
`$lib/domain/plot.ts` and `14_plot_canvas.md §3`). Grid warnings are derived
client-side by `analyzePlotGrid`, so the command only returns the raw grid.

## Bridge verification checklist (later, in a Tauri env)

1. `getInvoke()` detects `__TAURI_INTERNALS__` and routes to native.
2. Each command's return shape matches the TS type above (round-trip a real
   episode through run_qa → generate_revision_plan → generate_candidate).
3. Candidate files land under `.novelctl/runs/<run-id>/`, not the draft.
4. `create_snapshot` fires before any candidate apply (already wired in
   `CandidateDiffPanel.applyAll`).
5. Codex scan confidence parity between native and `scanDynamicLinks`.
