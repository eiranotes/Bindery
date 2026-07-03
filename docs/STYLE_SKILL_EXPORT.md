# STYLE_SKILL_EXPORT.md

## 구현 위치

- TS virtual file generator: `buildStyleSkillPackFiles()`
- Python actual exporter: `export_style_skill_pack()`
- CLI: `novelctl style-export-skill`

## 출력 구조

```text
bindery-style-runtime/
├─ SKILL.md
├─ agents/
│  └─ openai.yaml
├─ references/
│  ├─ preset-index.md
│  ├─ scene-classification.md
│  ├─ style-router.md
│  ├─ writing-workflow.md
│  ├─ scoring-rubric.md
│  ├─ leakage-rules.md
│  ├─ presets/
│  ├─ stacks/
│  └─ fewshots/
```

## 생성 파일

- `SKILL.md`: 짧은 runtime 개요와 workflow.
- `references/preset-index.md`: preset 목록.
- `references/scene-classification.md`: tag, feature, primary/secondary 규칙.
- `references/style-router.md`: router priority와 rules.
- `references/writing-workflow.md`: capsule 생성 후 작성/검수 절차.
- `references/scoring-rubric.md`: StyleMatchScore 수식.
- `references/leakage-rules.md`: content leakage 금지 규칙.
- `references/presets/<preset-id>.md`: preset detail.
- `references/stacks/<stack-id>.md`: stack detail.

## CLI 예시

```bash
novelctl style-export-skill sample-project \
  --style-json style_payload.json \
  --output-dir exports \
  --project-id my_project \
  --json
```

`style_payload.json` 형식:

```json
{
  "presets": [],
  "stacks": [],
  "router": { "router_id": "router_default", "rules": [] }
}
```

## MVP 제한

- Markdown-only export.
- scripts directory와 validator는 Phase 2.
- zip export는 Phase 2.
