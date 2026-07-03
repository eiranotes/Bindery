# PROMPT_CAPSULE.md

## 구현 위치

- TS: `buildPromptCapsule()`
- Python: `build_prompt_capsule()`

## PromptCapsule schema

```json
{
  "active_stack": "stack_dialogue_b",
  "scene_type": "DIA",
  "style_register": "dialogue",
  "secondary_types": ["REL", "INT"],
  "global_rules": [],
  "register_rules": [],
  "overlay_rules": [],
  "character_rules": [],
  "negative_rules": [],
  "fewshot_refs": [],
  "self_checklist": []
}
```

## 생성 절차

1. `ActiveStyleStack.primary_stack_id`와 `overlay_stack_ids`로 stack을 찾는다.
2. 각 stack에 `mergeStyleStack()`을 실행한다.
3. merged buckets를 합친다.
4. global/register/overlay/character rule을 priority 순으로 제한한다.
5. negative rules는 default leakage rules와 stack/preset negative rules를 합쳐 항상 포함한다.
6. few-shot refs는 최대 2개만 포함한다.
7. self checklist에 register, overlay, leakage, content preservation check를 포함한다.

## 길이 제한

- 기본 `max_rules = 18`.
- `token_budget`은 `mergeStyleStack()`에서 active rule 수 제한에 반영된다.
- few-shot 본문은 MVP에서 직접 포함하지 않고 reference id만 넣는다.

## guard

- `secondary_types`는 `overlay_rules`에만 들어간다.
- observation register를 dialogue scene에 자동 주입하지 않는다.
- negative rules는 항상 포함된다.
