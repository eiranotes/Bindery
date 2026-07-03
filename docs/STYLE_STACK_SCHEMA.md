# STYLE_STACK_SCHEMA.md

## 구현 위치

- TS: `StyleStack`, `StyleStackAdapter`, `mergeStyleStack()`
- Python: `StyleStack`, `StyleStackAdapter`, `merge_style_stack()`

## StylePreset

프리셋은 적용 가능한 rule bucket을 가진다.

- `global_rules`
- `register_rules`
- `overlay_rules`
- `character_rules`
- `negative_rules`
- `fewshot_refs`
- `content_terms`
- `metrics_baseline`

## StyleStack

StyleStack은 preset adapter를 weight와 scope로 조합한다.

```json
{
  "stack_id": "stack_001",
  "name": "기본 서술 + 대화 overlay",
  "adapters": [
    { "preset_id": "preset_001", "role": "base", "weight": 0.7, "scope": "global" },
    { "preset_id": "preset_002", "role": "dialogue_overlay", "weight": 0.45, "scope": "dialogue" }
  ],
  "conflict_policy": "scope_priority",
  "normalization": "weighted_average",
  "max_active_rules": 18
}
```

## merge 규칙

`mergeStyleStack(stack, scene_classification, character_id, token_budget)`는 다음 순서로 rule을 모은다.

1. stack-level global rules.
2. 현재 `style_register`에 맞는 register rules.
3. `secondary_types`에 맞는 overlay rules.
4. `character_id`에 맞는 character rules.
5. adapter가 scope/compatibility에 맞으면 preset rules 추가.
6. `conflict_policy`에 따라 instruction 중복 제거.
7. `max_active_rules`와 `token_budget`으로 bucket을 제한.

## conflict_policy MVP

- `scope_priority`: character/register/overlay/global bucket priority를 유지.
- `higher_weight`: 동일 instruction은 높은 weight 우선.
- `base_preserve`, `axis_merge`, `manual_lock`: 현재 schema에 존재하나 고급 merge는 Phase 2.
