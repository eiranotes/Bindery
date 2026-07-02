# 05. Data Model and File Structure

## 1. Project root

```text
my-novel/
  guide.md
  .novelctl/
    config.yaml
    app-state.json
    indexes/
    runs/
    cache/
  .gemini/
    agents/
    settings.json
  story/
    chapters/
      ep001/
      ep002/
  plot/
  canon/
  characters/
  world/
  relationships/
  notes/
  analysis/
  qa/
  snapshots/
  canvas/
  exports/
```

## 2. Episode directory

```text
story/chapters/ep012/
  index.md
  00_brief.md
  01_context-pack.md
  02_scene-plan.md
  03_draft.md
  04_summary.md
  05_canon-delta.md
  06_plot-qa.md
  07_continuity-qa.md
  08_style-qa.md
  09_voice-qa.md
  10_lexicon-qa.md
  11_scene-pattern-qa.md
  12_revision-plan.md
  13_final.md
  scenes/
    scene-01.md
    scene-02.md
    scene-03.md
```

## 3. Episode index frontmatter

```yaml
episode: 12
title: "의료 리스크"
status: draft
arc: arc1
timeline: arc1-day4-evening
pov: protagonist-close-third
word_count_target: 9000
current_word_count: 0
tags:
  - guild-rebuild
  - medical-risk
characters:
  - protagonist
  - eira
locations:
  - guild-office
threads:
  - medical-risk
  - candidate-selection
qa:
  plot: pending
  continuity: pending
  style: pending
  voice: pending
  lexicon: pending
```

## 4. Scene frontmatter

```yaml
scene: 3
episode: 12
title: "후보자의 부상 이력"
status: draft
pov: protagonist
location: training-yard
timeline: arc1-day4-evening
characters:
  - protagonist
  - eira
plotlines:
  - medical-risk
tension: high
purpose:
  - expose-risk
  - shift-eira-role
summary: "후보자 검증 중 의료 공백이 실제 리스크로 드러난다."
```

## 5. Codex item

```yaml
type: character
id: eira
name: "에이라"
aliases:
  - "에이라"
  - "에이라가"
  - "에이라는"
status: active
first_appearance: ep001
last_seen: ep012
related_threads:
  - guild-rebuild
  - medical-risk
auto_link: true
min_alias_length: 2
```

문서 본문:

```md
# 에이라

## Core Role
...

## Current State
...

## Speech Rules
...

## Forbidden-by-Pattern
...

## Progression
- ep001: ...
- ep012: ...
```

## 6. QA report structure

Markdown 파일에 사람이 읽는 리포트를 두고, 맨 아래 structured block을 둔다.

```md
# EP012 Plot QA

## Verdict
WARN

## Issues
...

<!-- novelstudio:qa-json
{
  "episode": "012",
  "type": "plot",
  "score": 82,
  "verdict": "warn",
  "issues": [
    {
      "severity": "warn",
      "message": "Scene 2 repeats meeting-analysis structure",
      "file": "story/chapters/ep012/scenes/scene-02.md",
      "lineStart": 30,
      "lineEnd": 54
    }
  ]
}
-->
```

이렇게 하면 Markdown으로 읽히고 GUI는 JSON block만 파싱할 수 있다.

## 7. Analysis report structure

### Repetition JSON

```json
{
  "episode": "012",
  "mode": "word",
  "items": [
    {
      "term": "시선",
      "count": 17,
      "locations": [
        {"file": "13_final.md", "line": 21, "scene": "scene-01"}
      ],
      "distribution": [1, 5, 8, 3],
      "judgment": "review",
      "intentional": false
    }
  ]
}
```

### Rhythm JSON

```json
{
  "episode": "012",
  "totalChars": 9100,
  "dialogueRatio": 0.42,
  "descriptionRatio": 0.38,
  "innerMonologueRatio": 0.20,
  "scenes": [
    {
      "scene": "scene-01",
      "dialogueRatio": 0.35,
      "avgParagraphChars": 84
    }
  ]
}
```

## 8. Snapshot manifest

```json
{
  "snapshotId": "ep012_20260701_120000_before_rewrite",
  "episode": "012",
  "createdAt": "2026-07-01T12:00:00+09:00",
  "reason": "before-style-rewrite",
  "files": [
    {
      "path": "story/chapters/ep012/13_final.md",
      "sha256": "...",
      "size": 18731
    }
  ]
}
```

## 9. Canvas data model

```json
{
  "id": "arc1",
  "nodes": [
    {
      "id": "ep012",
      "type": "episode",
      "label": "EP012 의료 리스크",
      "path": "story/chapters/ep012/index.md",
      "x": 100,
      "y": 200
    }
  ],
  "edges": [
    {
      "id": "edge1",
      "from": "ep011",
      "to": "ep012",
      "type": "cause",
      "label": "후보군 검증 심화"
    }
  ]
}
```

## 10. SQLite schema draft

```sql
CREATE TABLE files (
  path TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  mtime INTEGER NOT NULL,
  sha256 TEXT,
  title TEXT,
  frontmatter_json TEXT
);

CREATE TABLE codex_aliases (
  alias TEXT NOT NULL,
  target_path TEXT NOT NULL,
  target_id TEXT NOT NULL,
  min_length INTEGER DEFAULT 2,
  auto_link INTEGER DEFAULT 1,
  PRIMARY KEY(alias, target_path)
);

CREATE TABLE episode_index (
  episode TEXT PRIMARY KEY,
  title TEXT,
  status TEXT,
  arc TEXT,
  timeline TEXT,
  summary TEXT,
  tags_json TEXT,
  qa_json TEXT
);

CREATE TABLE job_history (
  job_id TEXT PRIMARY KEY,
  type TEXT,
  status TEXT,
  started_at TEXT,
  ended_at TEXT,
  input_json TEXT,
  output_json TEXT,
  log_path TEXT
);
```
