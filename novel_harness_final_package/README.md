# Longform AI Novel Harness — Final Design Package

This zip is a ground-up design package for a local-first AI-assisted longform fiction harness. Bindery is treated as a reference implementation, not as the starting architecture.

## Core position

The product is not an AI text generator. It is a **local-first writing workspace** where AI helps the writer move through:

```text
소재발굴 -> 세계관 확장 -> 바이블 생성 -> 플롯 제작 -> 회차 설계 -> 장면 집필 -> QA -> 수정 -> 정사 동기화
```

The harness separates:

1. **Static writing workflow**: markdown files, editable boards, sheets, plotboards, canvas, task/status files.
2. **AI connection workflow**: local CLI adapter by default, optional API integration, optional web-AI file exchange import/export.

The writer must be able to read and edit every major output immediately as a local Markdown/YAML/JSON file.

## Package map

```text
docs/
  00_research_and_bindery_audit.md
  01_information_architecture.md
  02_static_writer_workflow.md
  03_ai_augmented_workflow.md
  04_prompt_blueprints.md
  05_ui_spec_pensiv_benchmark.md
  06_ai_connection_architecture.md
  07_code_structure.md
  08_schemas_and_contracts.md
  09_implementation_roadmap.md
  10_bindery_gap_mapping.md
  sources.md
schemas/
  *.schema.json
prompts/
  *.prompt.md
starter_project/
  local-first starter folder skeleton
```

## Implementation stance

- Markdown/YAML/JSON are the durable source of truth.
- SQLite/vector stores are indexes and caches, not truth.
- AI output is a candidate or proposal until the user approves it.
- A run can pause, resume, or branch.
- Prompt inputs and outputs are archived.
- CLI is default, using a provider profile with `-p` prompt mode where available/configured.
- Web AI is supported by exporting a stage-scoped exchange bundle and importing returned result files.
