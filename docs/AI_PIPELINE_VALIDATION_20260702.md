# AI Pipeline Validation - 2026-07-02

## Goal

Verify whether Bindery can use a real local AI CLI for the writing candidate path, not only browser mock or native fallback candidates.

## Findings

Installed commands:

- `codex`: available, `codex-cli 0.133.0`
- `gemini`: available, `0.44.1`
- `claude`: available, `2.1.150`
- `agy`: not found

Connection results:

| Provider | Result | Notes |
|---|---|---|
| Codex CLI | pass | `codex exec --skip-git-repo-check --ephemeral -s read-only -o <file>` returned the expected final message. |
| Gemini CLI | blocked | Headless prompt failed with `IneligibleTierError` and trust-folder warning. |
| Claude CLI | blocked | Prompt failed with `401 Invalid authentication credentials`. |
| Antigravity CLI | unavailable | `agy` is not installed on this Mac. |

## Code Changes

- Default provider changed to Codex CLI.
- Native `generate_candidate` now routes `codex` through `codex exec` and reads `--output-last-message` from a temp file, avoiding noisy stdout logs.
- Gemini remains available as an option, but is not the default because this environment blocks headless execution.
- Antigravity remains available as an option for machines with `agy` installed.

## Verification Command

```bash
bash scripts/verify_ai_pipeline.sh
```

Expected output:

```text
AI pipeline adapter smoke: PASS (codex)
```

## Remaining Validation

- Packaged Tauri app launch smoke passed with `Bindery.app`.
- Browser Playwright flow confirmed `AI 작업` creates candidates and QA output after `선택 실행`.
- Native Codex adapter smoke passed with `AI pipeline adapter smoke: PASS (codex)`.
- Full click-through automation inside the packaged `.app` is still pending.
- Validate Antigravity separately on a machine where `agy` is installed.
