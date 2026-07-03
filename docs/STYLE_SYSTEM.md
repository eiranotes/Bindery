# STYLE_SYSTEM.md

## 구현 위치

- TypeScript: `apps/desktop/src/lib/domain/styleSystem.ts`
- Python: `packages/novelctl-core/novelctl/style_system.py`
- SQLite migration: `packages/novelctl-core/novelctl/migrations/001_style_system.sql`
- Frontend export: `apps/desktop/src/lib/domain/style.ts`
- API entrypoint: `apps/desktop/src/lib/api/commands.ts`
- Tauri native commands: `apps/desktop/src-tauri/src/commands/style.rs`
- CLI entrypoint: `packages/novelctl-core/novelctl/cli.py`

## 핵심 흐름

```text
Scene text
→ classifyScene / classify_scene
→ SceneClassification
→ resolveActiveStyleStack / resolve_active_style_stack
→ mergeStyleStack / merge_style_stack
→ buildPromptCapsule / build_prompt_capsule
→ scoreStyleMatch / score_style_match
→ buildStyleSkillPackFiles / export_style_skill_pack
```

## 구현된 schema

- `StyleProfile`
- `StylePreset`
- `StyleStackAdapter`
- `StyleStack`
- `SceneClassification`
- `StyleRouterRule`
- `StyleRouter`
- `StyleRouteContext`
- `ActiveStyleStack`
- `MergedStyleRules`
- `PromptCapsule`
- `StyleMatchReport`

## 설계 원칙 반영

- 문체는 단일 프롬프트가 아니라 schema와 rule bucket으로 관리한다.
- `primary_type`은 `style_register`를 결정한다.
- `secondary_types`는 `overlay_rules`로만 들어간다.
- 실제 LoRA/fine-tuning은 없다. preset/adapter weight를 rule priority와 selection으로 변환한다.
- AI 호출 없이 동작하는 deterministic MVP를 먼저 둔다.

## CLI

```bash
novelctl style-classify <project> --text "..." --scene-id S001 --json
novelctl style-route <project> --context-json context.json --router-json router.json --json
novelctl style-capsule <project> --payload-json capsule_payload.json --json
novelctl style-score <project> --text "..." --style-json style.json --classification-json classification.json --json
novelctl style-export-skill <project> --style-json style_payload.json --output-dir out --project-id proj --json
novelctl style-sql <project> --json
```

## Frontend API

```ts
classifyStyleSceneText(sceneText, metadata, projectPath?)
resolveStyleRouteLocal(context, router, projectPath?)
buildPromptCapsuleLocal(context, activeStack, maxRules, tokenBudget, projectPath?)
scoreStyleMatchLocal(text, styleProfile, sceneClassification, projectPath?)
buildStyleSkillPackLocal(projectId, presets, stacks, router)
exportStyleSkillPack(projectPath, projectId, presets, stacks, router, outputDir)
```

In a Tauri runtime, wrappers with `projectPath` call native commands first. Browser/mock mode falls back to the deterministic TypeScript runtime.

## Tauri Commands

```text
classify_style_scene
resolve_style_route
build_prompt_capsule
score_style_match
export_style_skill_pack
```

The native commands are Python `novelctl` adapters for Phase 2. They use the configured `novelctlPath`, fall back to the repo-local CLI in development, and return the JSON `data` payload from the CLI envelope.

## 테스트

```bash
python3 -m unittest discover -s tests -v
node --experimental-strip-types tests/styleSystem.node.test.mjs
node --experimental-strip-types tests/styleAnalyzer.node.test.mjs
python3 -m compileall -q packages/novelctl-core/novelctl
cargo check
```
