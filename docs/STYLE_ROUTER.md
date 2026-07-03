# STYLE_ROUTER.md

## 구현 위치

- TS: `resolveActiveStyleStack()`
- Python: `resolve_active_style_stack()`

## 우선순위

```text
manual_override
> character_dialogue
> dialogue
> scene_id
> style_register
> scene_type
> chapter
> arc
> project_default
```

## StyleRouterRule schema

```json
{
  "rule_id": "route_003",
  "target_type": "character_dialogue",
  "target_value": "eira",
  "stack_id": "stack_eira_voice",
  "priority": 90,
  "enabled": true,
  "overlay": true,
  "compatible_scene_types": ["DIA"],
  "compatible_registers": ["dialogue"]
}
```

## matching

- `character_dialogue`: `classification.primary_type === 'DIA'` 또는 `style_register === 'dialogue'`이고 speaker/character가 맞을 때.
- `dialogue`: 대화 register일 때.
- `scene_id`: scene id 일치.
- `style_register`: register 문자열 일치.
- `scene_type`: primary 또는 secondary tag 일치.
- `chapter`, `arc`, `project_default`: context field 일치.
- `manual_override`: context의 `manual_override_stack_id`가 있으면 즉시 primary로 반환.

## 출력

```json
{
  "primary_stack_id": "stack_eira_voice",
  "overlay_stack_ids": ["stack_dialogue"],
  "matched_rules": [],
  "routing_reason": "character_dialogue matched first; compatible overlays applied"
}
```

## overlay compatibility

Overlay는 다음 조건을 통과해야 한다.

- primary stack과 stack id가 다름.
- `overlay !== false`.
- `compatible_scene_types`가 있으면 현재 primary/secondary tag 중 하나와 일치.
- `compatible_registers`가 있으면 현재 `style_register`와 일치.
