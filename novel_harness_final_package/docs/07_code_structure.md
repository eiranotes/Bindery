# 07. Code Structure Design

## 1. Recommended monorepo

```text
novelh/
  apps/
    desktop/                 # Tauri + Svelte UI
    cli/                     # thin wrapper around core

  packages/
    core/                    # TypeScript pure domain if staying TS-first
    ui/                      # shared UI components

  crates/
    harness-core/            # Rust domain/runtime if Rust-first
    harness-fs/              # filesystem, snapshots, path safety
    harness-agent/           # CLI/API/web-exchange adapters
    harness-index/           # SQLite FTS/vector cache
    harness-tauri/           # Tauri command bridge

  schemas/
  prompts/
  templates/
```

Either TS-first or Rust-first is possible. For a Tauri desktop app, a strong split is:

- Rust: file safety, snapshots, run ledger, CLI process execution, schema validation, SQLite index.
- TypeScript/Svelte: editor, UI state, panels, command palette, diff rendering.

## 2. Static layer modules

```text
src/lib/static/
  projectTree.ts
  fileTypes.ts
  authority.ts
  markdown.ts
  frontmatter.ts
  plotBoard.ts
  assetRegistry.ts
  snapshots.ts
  stats.ts
```

Responsibilities:

- Read/write local files.
- Render/editor state.
- Update markdown/yaml files.
- Track dirty state.
- No model calls.

## 3. AI layer modules

```text
src/lib/ai/
  profiles.ts
  adapter.ts
  cliAdapter.ts
  apiAdapter.ts
  webExchange.ts
  promptBuilder.ts
  contextComposer.ts
  schemaValidator.ts
  runLedger.ts
  artifactLedger.ts
  proposalLedger.ts
  promptAudit.ts
```

Responsibilities:

- Build prompts.
- Build context manifest.
- Run provider.
- Validate output.
- Write trace/artifacts/proposals.
- Never directly mutate canon/manuscript files.

## 4. Pipeline modules

```text
src/lib/pipeline/
  definitions.ts
  runner.ts
  transitions.ts
  interrupts.ts
  stages/
    ideaDiscovery.ts
    premiseLab.ts
    worldExpansion.ts
    assetDecomposition.ts
    bibleAssembly.ts
    plotArchitecture.ts
    episodeBrief.ts
    scenePlan.ts
    draftCandidate.ts
    proseQA.ts
    fictionQA.ts
    governanceQA.ts
    revisionPlan.ts
    canonDelta.ts
    summaryResume.ts
```

## 5. UI components

```text
src/lib/components/
  shell/
    AppShell.svelte
    Sidebar.svelte
    TopTabs.svelte
    Inspector.svelte
    CommandPalette.svelte
  ideas/
    IdeaBoard.svelte
    PremiseLab.svelte
  world/
    AssetSheetEditor.svelte
    WorldCanvas.svelte
  bible/
    BibleWorkspace.svelte
    SourceCoveragePanel.svelte
  plot/
    PlotBoard.svelte
    TimelineView.svelte
    OpenThreadsPanel.svelte
  write/
    MarkdownEditor.svelte
    SceneNavigator.svelte
    ReferenceSplit.svelte
  review/
    CandidateDiff.svelte
    QAReportPanel.svelte
    RevisionPlanPanel.svelte
  canon/
    ProposalList.svelte
    ProposalDiff.svelte
    CanonDeltaReview.svelte
  ai/
    RunConsole.svelte
    PromptAuditPanel.svelte
    WebExchangePanel.svelte
```

## 6. Core interfaces

### Pipeline stage

```ts
export interface PipelineStage<I, O> {
  id: StageId;
  version: number;
  targetFile?: string;
  buildInput(ctx: StageContext): Promise<I>;
  buildPrompt(input: I): Promise<PromptBundle>;
  run(prompt: PromptBundle, adapter: AgentAdapter): Promise<RawOutput>;
  validate(raw: RawOutput): Promise<O>;
  persist(output: O): Promise<StageArtifacts>;
  next(output: O): StageTransition;
}
```

### Stage transition

```ts
export type StageTransition =
  | { kind: 'continue'; next: StageId }
  | { kind: 'interrupt'; interrupt: HumanInterrupt }
  | { kind: 'stop' }
  | { kind: 'failed'; reason: string };
```

### Human interrupt

```ts
export type HumanInterrupt = {
  id: string;
  reason:
    | 'review_edit_file'
    | 'approve_proposal'
    | 'resolve_conflict'
    | 'choose_candidate'
    | 'confirm_apply';
  payload: unknown;
  resumeSchema: string;
};
```

## 7. Stores

```text
projectStore       # current root, current branch, recent projects
fileStore          # tree, selected file, dirty buffers
workspaceStore     # tabs, splits, inspector state
runStore           # active run, checkpoints, history
artifactStore      # latest artifacts by stage/run
proposalStore      # pending/approved/rejected proposals
aiProfileStore     # current provider profile
promptAuditStore   # latest prompt/source/token audit
```

## 8. Tauri commands

```rust
#[tauri::command]
fn open_project(path: String) -> Result<ProjectInfo>;
#[tauri::command]
fn read_file(project: String, path: String) -> Result<FileContent>;
#[tauri::command]
fn write_file(project: String, path: String, content: String) -> Result<()>;
#[tauri::command]
fn create_snapshot(project: String, path: String, label: String) -> Result<SnapshotInfo>;
#[tauri::command]
fn run_ai_stage(project: String, request: StageRunRequest) -> Result<StageRunResult>;
#[tauri::command]
fn export_web_exchange(project: String, request: ExchangeExportRequest) -> Result<ExchangeInfo>;
#[tauri::command]
fn import_web_exchange_result(project: String, path: String) -> Result<ImportResult>;
#[tauri::command]
fn approve_proposal(project: String, proposal_id: String) -> Result<ApplyResult>;
#[tauri::command]
fn rebuild_index(project: String) -> Result<IndexReport>;
```

## 9. Path safety

- Reject absolute target paths inside project write API.
- Reject `..` traversal.
- Resolve symlinks before write.
- Only `.harness/tmp`, `.harness/exchanges`, `.harness/artifacts` are AI-write targets.
- Canon/manuscript writes happen only through proposal/apply functions.
