# novelctl JSON Mode Requirements

Every command used by GUI should support `--json`.

## Example

```bash
novelctl qa 012 --all --json
```

Output:

```json
{
  "ok": true,
  "command": "qa",
  "episode": "012",
  "outputs": [
    "story/chapters/ep012/06_plot-qa.md"
  ],
  "summary": {
    "overall": "revise_required",
    "scores": {
      "plot": 86,
      "continuity": 91
    }
  }
}
```

Failure:

```json
{
  "ok": false,
  "error": {
    "code": "GEMINI_NOT_FOUND",
    "message": "Gemini CLI executable was not found.",
    "recoverable": true
  }
}
```
