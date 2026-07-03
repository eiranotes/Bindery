# STYLE_SKILL_EXPORT.md

## 구현 위치

- TS virtual file generator: `buildStyleSkillPackFiles()`
- Python actual exporter: `export_style_skill_pack()`
- Python validator: `validate_style_skill_pack()`
- Python zip exporter: `zip_style_skill_pack()`
- CLI: `novelctl style-export-skill`, `novelctl style-validate-skill`

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
│  ├─ reference-policy.md
│  ├─ regression-fixture.json
│  ├─ structured-output-schemas.json
│  ├─ korean-nlp-markers.json
│  ├─ presets/
│  ├─ stacks/
│  └─ fewshots/
├─ scripts/
│  └─ validate_skill_pack.py
└─ validation-report.json
```

## 생성 파일

- `SKILL.md`: 짧은 runtime 개요와 workflow.
- `references/preset-index.md`: preset 목록.
- `references/scene-classification.md`: tag, feature, primary/secondary 규칙.
- `references/style-router.md`: router priority와 rules.
- `references/writing-workflow.md`: capsule 생성 후 작성/검수 절차.
- `references/scoring-rubric.md`: StyleMatchScore 수식.
- `references/leakage-rules.md`: content leakage 금지 규칙.
- `references/reference-policy.md`: few-shot/reference loading limits and score authority guard.
- `references/regression-fixture.json`: exported skill regression checks.
- `references/structured-output-schemas.json`: SceneClassification/function/scoring/suggestion schemas.
- `references/korean-nlp-markers.json`: deterministic Korean marker dictionaries and speaker policy.
- `references/presets/<preset-id>.md`: preset detail.
- `references/stacks/<stack-id>.md`: stack detail.
- `scripts/validate_skill_pack.py`: standalone validation helper.
- `validation-report.json`: export-time validation summary.

## CLI 예시

```bash
novelctl style-export-skill sample-project \
  --style-json style_payload.json \
  --output-dir exports \
  --project-id my_project \
  --zip-path exports/bindery-style-runtime.zip \
  --json
```

```bash
novelctl style-validate-skill sample-project \
  --skill-dir exports/bindery-style-runtime \
  --zip-path exports/bindery-style-runtime.zip \
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

## Phase 2 정책

- Few-shot reference files are capped at 12 files and 120,000 bytes total.
- Prompt capsules load at most two few-shot references.
- Source names, proper nouns, object lists, choreography, and event order are content, not style.
- LLM explanations and suggestions cannot set the authoritative `StyleMatchScore`.
