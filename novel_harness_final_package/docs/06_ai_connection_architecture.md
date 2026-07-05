# 06. AI Connection Architecture

## 1. Separation of concerns

```text
Static layer
  Local files, editor, plotboard, sheets, snapshots, proposals.

AI layer
  Prompt builder, context pack, provider adapter, output validator, run trace.
```

The static layer must never depend on a working AI provider.

## 2. Agent profiles

File: `manifest/agent-profiles.yaml`

```yaml
version: 1
default_profile: local_cli_default

profiles:
  local_cli_default:
    kind: cli
    command: ai
    prompt_arg: "-p"
    model_arg: "--model"
    default_model: ""
    output_mode: stdout
    extra_args: []
    timeout_sec: 240
    cwd: project_root

  codex_cli:
    kind: cli
    command: codex
    prompt_arg: "-p"
    model_arg: "--model"
    default_model: ""
    output_mode: file
    extra_args: []
    timeout_sec: 240

  gemini_cli:
    kind: cli
    command: gemini
    prompt_arg: "-p"
    model_arg: "--model"
    default_model: ""
    output_mode: stdout
    extra_args: []
    timeout_sec: 240

  custom_web_exchange:
    kind: web_exchange
    export_dir: .harness/exchanges
    result_import_patterns:
      - result.json
      - result.md
      - result.zip
```

The app should not hard-code exact provider flags beyond the profile. Default assumption is:

```bash
{command} {model_arg} {model} {extra_args...} {prompt_arg} <prompt>
```

If a provider requires file output, the profile sets:

```yaml
output_mode: file
output_instruction: "Write the final result to {output_path}. Do not modify other files."
```

## 3. CLI execution modes

### stdout mode

```text
prompt.md -> command -p prompt -> stdout -> raw-output.txt -> validator -> artifact/proposal
```

### file mode

```text
prompt.md -> command -p wrapped_prompt_with_output_path -> output file -> raw-output.* -> validator
```

### structured mode

```text
prompt.md + schema.json -> command -> result.json -> JSON Schema validation -> typed object
```

### dry-run mode

Builds prompt/context/output paths without calling AI.

## 4. Adapter interface

```ts
export type AgentProfile = {
  id: string;
  kind: 'cli' | 'api' | 'web_exchange' | 'mock';
  command?: string;
  promptArg?: string;
  modelArg?: string;
  model?: string;
  extraArgs?: string[];
  outputMode: 'stdout' | 'file' | 'structured';
  timeoutSec: number;
};

export interface AgentAdapter {
  id: string;
  healthCheck(): Promise<AgentHealth>;
  runText(req: AgentTextRequest): Promise<AgentRunResult>;
  runStructured<T>(req: AgentStructuredRequest<T>): Promise<AgentStructuredResult<T>>;
}
```

## 5. Run trace

Every AI call writes:

```json
{
  "run_id": "run_20260705_ep001_001",
  "stage": "draft_candidate",
  "profile": "codex_cli",
  "command": "codex",
  "model": "user_configured_model",
  "prompt_path": ".harness/runs/.../prompt.md",
  "context_manifest": ".harness/runs/.../context-manifest.json",
  "schema_path": "schemas/DraftCandidateEnvelope.v1.schema.json",
  "raw_output_path": ".harness/runs/.../raw-output.txt",
  "validated_output_path": ".harness/runs/.../validated-output.json",
  "exit_code": 0,
  "started_at": "...",
  "finished_at": "...",
  "fallback": false
}
```

## 6. Web-AI exchange mode

Some users will use web AI manually. The app should support that without pretending to automate the website.

### Export bundle

Command:

```bash
novelh exchange export ep001 --stage scene-plan
```

Bundle:

```text
.harness/exchanges/exchange_ep001_scene-plan_001.zip
  instructions.md
  prompt.md
  context-manifest.json
  schemas/output.schema.json
  context/
    canon-state.md
    story-license.md
    story-envelope.md
    characters_eira.md
    previous-summary.md
  target/
    brief.md
    scene-plan.md
  return-format.md
```

### User flow

```text
Export web-AI bundle
-> user uploads zip or selected files to ChatGPT/Gemini/Claude web UI
-> user asks model to return result.json/result.md
-> user downloads result or copies output
-> app imports result
-> schema validation
-> preview diff/proposal
-> user accepts/rejects
```

### Import rules

- Accept `result.json`, `result.md`, or `result.zip`.
- Validate against the expected schema.
- Never apply directly.
- Store raw imported file in `.harness/exchanges/{exchange_id}/imported/`.
- Create a proposal or artifact after validation.

## 7. API integration path

Optional later path:

- OpenAI Responses API with Structured Outputs for schema-constrained results.
- File search/vector store for hosted retrieval if the user opts in.
- Local FTS/vector index remains default for local-first mode.

## 8. Security and locality posture

- Default: local files + user-configured CLI.
- API: opt-in.
- Web exchange: explicit export/upload/import controlled by user.
- Do not silently upload project files.
- Every upload bundle has a manifest showing included files.
- Sensitive paths can be excluded through `.harnessignore`.

Example `.harnessignore`:

```text
research/private/**
notes/personal/**
*.secret.md
```
