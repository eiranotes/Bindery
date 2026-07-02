# Agent Output Contract

## QA agents

All QA agents must output Markdown and include structured JSON block.

```md
# EP012 Style QA

## Verdict
WARN

## Findings
...

<!-- novelstudio:qa-json
{
  "episode": "012",
  "type": "style",
  "score": 78,
  "verdict": "warn",
  "issues": []
}
-->
```

## Draft agents

Draft agents output candidate files under `.novelctl/runs/<run-id>/` first.

The GUI then lets user apply to draft/final.

## Archivist

Archivist should never directly overwrite locked canon. It outputs update candidates.
