# AI Pipeline Observability And UX Cleanup Plan

Date: 2026-07-04
Status: planning only, no implementation yet

## Why This Exists

The current AI pipeline can run, but the author cannot tell enough about what is happening while a CLI-backed step is active. A step can show loading while the CLI is still starting, waiting on model output, writing to a temp file, retrying a schema repair, or already stuck. The same surface also uses too many rounded cards with explanatory text inside them, which makes the AI workspace feel generated instead of like a purposeful writing tool.

This plan covers three related fixes:

- Make CLI execution observable while it is running.
- Persist token, usage, duration, retry, and output metadata after a run.
- Replace card-heavy AI surfaces with dense, stable workbench layouts aligned with `DESIGN.md`.

## Confirmed Problems

### 1. Running State Has No Live Evidence

Current UI state is mostly `running` or `done`. It does not show:

- elapsed time
- last CLI output time
- current command/provider/mode
- stdout/stderr progress
- whether output is streamed or file-backed
- retry/repair state
- cancelability
- token usage, cost, or model usage

Result: loading can look frozen even when the CLI is still doing work.

### 2. Run Records Are Too Thin For Operational Review

`run.json` records the step status, settings snapshot, artifact id, and human decisions. It does not persist enough execution telemetry to answer:

- which exact CLI command was launched
- how long each subprocess took
- whether the subprocess exited, timed out, or produced invalid output
- how many prompt/completion tokens were used
- whether token counts are exact, parsed, estimated, or unavailable
- how many schema repair attempts happened
- which baseline manuscript and planning artifacts fed the draft

### 3. Token And Cost Reporting Needs A Truth Label

Not every local CLI reports token usage in the same way. The UI must not pretend exact accounting exists when the CLI did not provide it.

Required labels:

- `exact`: parsed from provider or CLI usage metadata
- `reported`: CLI reported a total but not a full breakdown
- `estimated`: Bindery estimated from prompt/output text length
- `unavailable`: neither CLI nor estimate is safe enough

The UI should show exact or reported values when available, and otherwise show estimated values with clear labeling.

### 4. Full Pipeline Target Is Ambiguous

The current "전체 실행" means the current episode only. It does not ask for an episode count or range. That makes the wording feel larger than the behavior.

Required target contract:

- selected episode or explicit episode range
- target manuscript path
- baseline manuscript hash
- requested candidate count
- selected plot board revision or outline proposal
- source artifacts used for planning and drafting

### 5. Draft Diff Basis Is Ambiguous

Draft candidates are generated from a base manuscript, but the diff panel compares the candidate against the live editor content. If the manuscript changes after generation, the displayed diff no longer necessarily represents the candidate generation basis.

Required fix:

- store a candidate review session with baseline content or baseline hash
- diff `baseline -> candidate` by default
- warn if live editor content differs from baseline
- provide an explicit "compare against current editor" option

### 6. Bible To Episode Plot Is Missing

Source intake creates an initial plot board, but it does not create a deliberate multi-episode outline from the bible/source material. The pipeline therefore jumps from source/bible to per-episode brief without a required "which episodes exist and what each episode should cover" step.

Required sequence:

1. Source/bible intake
2. Episode outline proposal for N episodes
3. Approved plot board rows per episode
4. EpisodeBrief for selected episode
5. ScenePlan for selected episode
6. Draft candidates

### 7. AI Workspace Feels Card Heavy

Several AI surfaces put narrative explanation text inside rounded panels, then place more controls or status chips inside the same areas. This increases visual noise and reads like generic generated UI.

Anti-slop target:

- no card-inside-card layouts
- no long instructional paragraphs inside compact tool panels
- no decorative pills for core status
- use tables, key-value rows, split panes, logs, side inspectors, and detail rows instead of repeated cards
- keep text dense and scannable, with disclosure for long explanations
- keep all values traceable to `DESIGN.md`

### 8. Pipeline Steps Do Not Show Whether They Use AI

The current step list does not clearly distinguish deterministic local work from CLI-backed model calls. Authors need to know whether a step is using paid/remote model work, local static analysis, local file assembly, or a fallback.

Required step badges:

- `AI`: calls the configured CLI/model and cannot produce high-quality output without it
- `Static`: deterministic local analysis or file operation, no model required
- `Hybrid`: tries AI first, then falls back to local/static output
- `Fallback`: currently using fallback because AI was unavailable, invalid, or skipped

Current classification to make visible:

| Step | Current implementation | Badge |
|---|---|---|
| `회차 브리프` | Agent JSON first, local EpisodeBrief fallback from plot/source/manuscript | Hybrid |
| `장면 계획` | Agent JSON first, local ScenePlan fallback from brief/plot/manuscript | Hybrid |
| `컨텍스트` | Local assembly from artifacts, previous summary, codex hits, open threads | Static |
| `초안 후보` | Agent DraftCandidateEnvelope first, repair via agent, fallback to native/mock candidate path | Hybrid |
| `표현 분석` | Local `analyzeManuscript` repetition/crutch/cliche scan | Static |
| `QA` | Agent QAReportEnvelope first, repair via agent, fallback report, then local banned-term compliance merge | Hybrid |
| `수정 계획` | Agent revision prompt first, native/mock checklist fallback | Hybrid |
| `요약` | Agent summary first, local surface summary fallback | Hybrid |
| `기록` | Local snapshot and journal artifact | Static |

The UI should also show the actual mode used for the latest run, for example `Hybrid -> AI`, `Hybrid -> local fallback`, or `Static`.

### 9. QA Target Is Ambiguous

The current QA action analyzes the live editor content. It does not inspect the active draft candidate unless that candidate has already been applied into the editor. In Candidate Review, pressing QA while `후보 A` or `후보 B` is selected can look like candidate QA, but it is actually current-editor QA.

Required fix:

- Introduce an explicit `QATarget`.
- Show the QA target beside every QA run button.
- Store the target in `run.json`, QA artifacts, and Mission Control.
- In Candidate Review, provide separate actions for `현재 원고 QA` and `선택 후보 QA`.
- When a candidate is QA'd, link the result to `candidateId`, `candidateLabel`, `candidateSessionId`, and content hash.
- When the editor changed after candidate generation, show whether QA targets the baseline, live editor, or candidate content.

Proposed target shape:

```ts
type QATarget = {
  kind: 'current-editor' | 'candidate' | 'baseline' | 'applied-mixed';
  label: string;
  episode: string;
  contentHash: string;
  manuscriptPath?: string;
  candidateId?: string;
  candidateLabel?: string;
  candidateSessionId?: string;
  baselineHash?: string;
};
```

### 10. QA Needs A Two-Layer Logic

The QA prompt currently asks the model to judge plot, brief compliance, scene-plan compliance, continuity, style, voice, lexicon, and scene patterns together. That makes subjective items such as point of view or first-person violations prone to false positives when the model infers a violation without enough textual evidence.

Required QA split:

- Static gates should produce evidence-backed findings only.
- AI gates should interpret evidence and provide editorial judgment.
- Any AI-only issue must be labeled `AI judgment`.
- Any issue without exact line evidence should default to `info` or `review`, not `fail`.
- POV/first-person checks should be deterministic first: read expected POV from frontmatter, scene plan, style guideline, or explicit user setting, then scan only clear pronoun/narration mismatches with line evidence.
- If expected POV is unknown, QA must not fail on first-person/third-person assumptions.

Proposed QA gates:

| Gate | Source | Rule |
|---|---|---|
| Banned terms | Static | Exact banned-term match from style guideline, line evidence required |
| Repetition/crutch | Static | Existing repetition analyzer, line/offset evidence required |
| Candidate identity/baseline | Static | Compare target hash and candidate/session metadata |
| POV consistency | Static first, AI second | Only fail with declared expected POV and repeated line-level evidence |
| Brief compliance | AI with evidence | Compare target text against EpisodeBrief, cite missing beat |
| ScenePlan compliance | AI with evidence | Cite scene card and manuscript evidence |
| Continuity | AI with evidence | Compare previous summary/codex/open threads, mark uncertain claims |
| Style/voice | AI with static evidence | Use style capsule/profile evidence, avoid unsupported POV claims |

### 11. CLI Connection Has No Model Contract

The current AI runner settings choose provider, command path, output mode, timeout, and mock mode. They do not choose or persist a model. Tauri agent execution receives provider/path/output mode, then builds commands without model arguments. This means the actual model is whatever the CLI default happens to be.

Required fix:

- Add a model selector to AI Runner settings.
- Store provider-specific default model and optional per-step overrides.
- Pass the selected model into all agent execution paths.
- Persist model id in run settings, step usage, event logs, and artifacts.
- Show model id in AI 작업, Mission Control, run history, and live log headers.
- Make "CLI default" an explicit option, not an invisible fallback.
- Validate model availability where the provider supports it, and otherwise mark validation as unavailable.

Provider mapping to plan for:

| Provider | Model setting | Command mapping |
|---|---|---|
| Codex CLI | `agentModel` or CLI default | pass model using the supported Codex CLI model flag once confirmed; otherwise record `cli-default` |
| Gemini CLI | `agentModel` or CLI default | pass provider-supported model flag or env option once confirmed |
| Antigravity CLI | `agentModel` or CLI default | support file-output mode and provider-specific model option when available |
| Custom | raw model string plus argument template | user supplies an argument template such as `--model {model}` |

The implementation must not invent provider flags. It should verify the local CLI help/version behavior before wiring each provider's final argument form.

## Proposed Data Model

### AgentModelConfig

```ts
type AgentModelConfig = {
  provider: AgentProvider;
  model: string;
  modelSource: 'explicit' | 'cli-default' | 'step-override';
  customModelArgTemplate?: string;
  stepOverrides?: Partial<Record<PipelineStep, string>>;
};
```

### PipelineTarget

```ts
type PipelineTarget = {
  mode: 'single' | 'range';
  episodeIds: string[];
  manuscriptPathByEpisode: Record<string, string>;
  baselineHashByEpisode: Record<string, string>;
  plotBasisId?: string;
  outlineProposalId?: string;
  createdAt: string;
};
```

### RunEvent

Persist as `.bindery/runs/{runId}/events.ndjson`.

```ts
type RunEvent = {
  at: string;
  step: PipelineStep;
  level: 'debug' | 'info' | 'warn' | 'error';
  kind:
    | 'step_started'
    | 'cli_spawned'
    | 'stdout'
    | 'stderr'
    | 'file_output_poll'
    | 'schema_repair_started'
    | 'usage_reported'
    | 'artifact_written'
    | 'step_finished'
    | 'step_failed'
    | 'heartbeat';
  message: string;
  data?: Record<string, unknown>;
};
```

### StepUsage

Persist inside `run.json` and in `.bindery/runs/{runId}/usage.json`.

```ts
type StepUsage = {
  provider: string;
  model?: string;
  modelSource?: 'explicit' | 'cli-default' | 'step-override' | 'unavailable';
  outputMode: 'stdout' | 'file';
  promptChars: number;
  outputChars: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  tokenSource: 'exact' | 'reported' | 'estimated' | 'unavailable';
  estimatedCostUsd?: number;
  costSource?: 'exact' | 'estimated' | 'unavailable';
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  exitCode?: number;
  timedOut?: boolean;
  repairAttempts: number;
};
```

### CandidateReviewSession

```ts
type CandidateReviewSession = {
  sessionId: string;
  episode: string;
  manuscriptPath: string;
  baselineContent: string;
  baselineHash: string;
  candidateCountRequested: number;
  candidateCountGenerated: number;
  basisArtifactIds: {
    episodeBrief?: string;
    scenePlan?: string;
    context?: string;
    qa?: string;
    revision?: string;
    analyze?: string;
  };
  createdAt: string;
};
```

### QAExecution

```ts
type QAExecution = {
  qaId: string;
  runId?: string;
  target: QATarget;
  gates: Array<{
    name: string;
    source: 'static' | 'ai' | 'hybrid';
    verdict: 'pass' | 'warn' | 'fail' | 'review';
    evidenceCount: number;
  }>;
  createdAt: string;
};
```

## Streaming Plan

### Native/Tauri Bridge

- Add a streaming-capable command path for agent execution.
- Add model-aware command construction, with provider-specific argument mapping and a custom-provider template.
- Emit structured events for stdout, stderr, file polling, timeout, repair retry, and completion.
- Keep the existing final-result command as a compatibility fallback.
- Redact secrets before events are persisted or displayed.
- For file-output CLIs, poll the output file and emit append-only chunks with byte offsets.

### Frontend Stores

- Add a `runEventStore` keyed by `runId`.
- Extend `runStore` with per-step usage, elapsed time, last event time, and current event summary.
- Keep high-volume stdout/stderr in event files and store only recent preview lines in memory.

### Mission Control UI

Replace passive loading with an execution strip:

- current provider and command mode
- selected model or `CLI default`
- elapsed time
- last event age
- current step state
- token usage label and value
- retry/repair count
- cancel/retry controls where safe
- execution source badge: AI, Static, Hybrid, or Fallback

Add a live log tab:

- stdout/stderr/event stream
- filter by step and level
- copy redacted command summary
- jump from event to artifact when a step writes output

### Step Rows

Each step row should show:

- queued/running/done/failed
- elapsed duration after completion
- usage summary after completion
- latest event while running
- artifact link when available

If there has been no event for a threshold, show "CLI 출력 대기" with elapsed time instead of leaving the spinner alone.

## UX Cleanup Plan

### Surface Rules

- Replace repeated cards with workbench bands, tables, split panes, and inspectors.
- Put long explanations into collapsible detail rows or docs links.
- Keep status in table cells or row metadata, not decorative chips.
- Avoid paragraphs inside compact panels unless they are the primary reading artifact.
- Use consistent `DESIGN.md` spacing, radius, color, and typography tokens.
- Remove any remaining purple/glow/default AI decoration.

### AI 작업

- Replace the rail card stack with a target header, step table, and persistent execution summary.
- Make "현재 무엇을 대상으로 실행하는지" the first visible row: episode, manuscript, baseline hash, candidate count, plot basis, provider, and model.
- Add a compact usage footer for the active run.
- Move long guidance text behind "입력 기준 상세".

### Mission Control

- Keep it full-screen, but shift from three card columns to a command-center grid:
  - left: step table and run history
  - center: artifact/prompt/context/review/log viewer
  - right: target, usage, risks, decisions
- Add live log as a first-class tab.
- Show per-step token/duration totals in run history.

### Candidate Review

- Show candidate session metadata above the diff:
  - baseline hash
  - current editor hash
  - basis artifacts
  - requested/generated candidate count
- Default diff is baseline to candidate.
- Warn if current editor no longer matches baseline.
- Add `QA selected candidate` beside `QA current editor`.
- Display the latest QA target and content hash so authors know whether the result belongs to 후보 A, 후보 B, or the live manuscript.

### QA Dashboard

- Replace the single ambiguous `QA 실행` button with target-aware buttons.
- Show `검사 대상: 현재 원고`, `검사 대상: 후보 A`, or `검사 대상: baseline`.
- Split static findings and AI judgment into separate sections.
- Make false-positive actions persist with issue fingerprint, target hash, and gate source.
- For POV/first-person findings, require declared expected POV and line-level evidence before showing severity `fail`.

### Plot Board And Planning

- Add an episode outline generation surface before EpisodeBrief.
- Present outline as an editable table, not cards.
- Columns: episode, logline, required beats, open threads touched, risk, approval state.
- Approved outline rows can write or update `plot/plot-board.json`.

### Preferences Modal

- Keep the fixed frame behavior.
- Reduce explanatory text inside setting groups.
- Use compact rows with label, control, value, and help disclosure.
- Add model selection under AI Runner:
  - provider
  - command path
  - model (`CLI default` or explicit id)
  - custom model argument template for custom providers
  - optional advanced per-step model overrides
  - connection test that reports provider, command, model, and whether model validation is exact or unavailable

## Implementation Phases

### Phase 1: Contracts And Persistence

- Add `PipelineTarget`, `RunEvent`, `StepUsage`, and `CandidateReviewSession` types.
- Add `AgentModelConfig` and migrate settings with `agentModel: 'cli-default'`.
- Persist run events as NDJSON and usage as JSON.
- Add a baseline hash helper for manuscript content.
- Update run hydration to load usage summaries without loading full event logs.

### Phase 2: CLI Streaming And Usage Parsing

- Add streaming native command path.
- Add model-aware CLI execution and record model source in usage.
- Parse provider usage when possible.
- Estimate tokens when exact counts are unavailable.
- Add heartbeat and timeout events.
- Add redaction tests for logged command output.

### Phase 3: Mission Control Streaming UI

- Add live execution strip.
- Add log tab.
- Add per-step duration and usage summaries.
- Add no-output waiting state so loading never looks frozen.
- Add per-step source badges and latest actual mode, such as AI, Static, Hybrid -> AI, or Hybrid -> fallback.
- Show selected model and whether the model came from explicit setting, step override, or CLI default.

### Phase 4: Explicit Pipeline Target And Episode Outline

- Add single/range target selector.
- Rename or clarify "전체 실행" so it cannot imply all episodes unless a range is selected.
- Add bible/source to episode-outline proposal generation.
- Make EpisodeBrief consume approved episode outline or plot rows.

### Phase 5: Candidate Diff Basis Fix

- Store candidate review session baseline.
- Diff baseline to candidate by default.
- Add mismatch warning and compare-current toggle.
- Persist candidate session metadata in draft artifacts or run metadata.
- Add candidate-target QA and persist QA target metadata.

### Phase 5.5: QA Gate Refactor

- Introduce `QATarget` and `QAExecution`.
- Let QA run against current editor, selected candidate, or baseline explicitly.
- Split static findings from AI judgment.
- Add deterministic POV evidence before any first-person/third-person severity.
- Downgrade unsupported AI-only POV claims to review/info.
- Persist false-positive fingerprints per target hash.

### Phase 6: Anti-Slop UI Cleanup

- Audit AI 작업, Mission Control, Candidate Review, Plot Board, Preferences, and Materials.
- Flatten nested cards into tables, rails, detail rows, and inspectors.
- Remove long explanatory blocks from compact panels.
- Verify at 390, 768, and 1280 px.

## Acceptance Criteria

- While a CLI step runs, the author can see elapsed time, latest event, provider/mode, and whether the CLI is still producing output.
- Every completed step shows duration and token usage with a truth label.
- Every AI or Hybrid step shows provider, model, output mode, and whether the model was explicit or CLI default.
- Exact usage is never faked. Estimated usage is visibly marked.
- `run.json` can answer what target, baseline, settings, artifacts, usage, and decisions belonged to the run.
- A draft candidate diff clearly states whether it compares against generation baseline or current editor content.
- Full pipeline execution states whether it targets one episode or a range.
- Bible/source based episode outline exists before per-episode brief generation.
- Every pipeline step visibly declares whether it is Static, AI, Hybrid, or Fallback.
- QA always shows whether it is checking current editor, selected candidate, baseline, or applied mixed content.
- Candidate QA results are linked to candidate id/session/hash.
- POV/first-person QA findings cannot be fail severity without declared expected POV and line-level evidence.
- AI surfaces pass the `DESIGN.md` anti-card-nesting rule and avoid text-heavy generic cards.
- No important Korean labels or long plot/usage text clips at 390, 768, or 1280 px.

## Verification Plan

- `npm --workspace apps/desktop run check`
- `npm run build`
- unit tests for token usage parser and token estimate fallback
- unit tests for settings migration and provider/custom model argument construction
- unit tests for run event persistence and hydration summaries
- unit tests for candidate baseline mismatch behavior
- unit tests for QA target selection and candidate QA artifacts
- unit tests for POV/first-person false-positive guards
- mock streaming test for stdout, stderr, file output, timeout, and no-output heartbeat
- browser visual QA at 390, 768, and 1280 px for AI 작업, Mission Control, Candidate Review, Plot Board, and Preferences
- `git diff --check`

## Risks

- Local CLIs may not expose exact token or cost data. The UI must support exact, reported, estimated, and unavailable states.
- Local CLIs may change model flags or hide model selection behind config files. Provider argument mapping must be verified before implementation and custom providers need an escape hatch.
- Streaming behavior differs by provider and output mode. File-output mode likely needs polling rather than true stdout streaming.
- Full stdout/stderr logs can contain private source text. Redaction and opt-in log retention need to be explicit.
- Too much live log detail can overwhelm the writing flow. The default view should summarize, with the full log one click away.
