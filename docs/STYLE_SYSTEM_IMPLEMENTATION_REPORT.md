# STYLE_SYSTEM_IMPLEMENTATION_REPORT.md

## 1. 현재 코드 분석 결과

### 기존 구조
- 기존 문체 분석은 `styleAnalyzer.ts`와 `style.ts`에 집중되어 있었다.
- 기존 UI는 `StyleStudio.svelte` 하나의 단계형 workflow였다.
- 기존 저장은 `styleStore.ts` localStorage와 `writeFile()` 기반 파일 저장이었다.
- SQLite/repository는 코드에 없었다.

### 재사용한 파일
- `styleAnalyzer.ts`: 기존 로컬 분석 유지.
- `style.ts`: 기존 analyzer export 유지, 신규 runtime export만 추가.
- `StyleStudio.svelte`: 기존 단계 UI 유지, SceneClassification 표만 추가.
- `commands.ts`: 기존 mock/Tauri API 구조 유지.
- `cli.py`: 기존 subcommand 구조 유지.

### 새로 추가한 파일
- `apps/desktop/src/lib/domain/styleSystem.ts`
- `packages/novelctl-core/novelctl/style_system.py`
- `tests/test_style_system.py`
- `tests/styleSystem.node.test.mjs`
- `analysis_report.md`
- `phase2_backlog.md`
- `plan.md`
- `state.md`
- `log.md`
- `docs/*.md`

### 수정한 파일
- `apps/desktop/src/lib/domain/style.ts`
- `apps/desktop/src/lib/stores/styleStore.ts`
- `apps/desktop/src/lib/components/style/StyleStudio.svelte`
- `apps/desktop/src/lib/api/commands.ts`
- `packages/novelctl-core/novelctl/cli.py`

## 2. 구현한 기능

### StyleProfile / StylePreset
- TS/Python schema 추가.
- `global_rules`, `register_rules`, `overlay_rules`, `character_rules`, `negative_rules`, `fewshot_refs`, `content_terms`, `metrics_baseline` 포함.

### SceneClassification
- `classifyScene()` / `classify_scene()` 구현.
- `primary_type`, `secondary_types`, `surface_mode`, `narrative_functions`, `style_register`, `confidence`, `scores`, `feature_scores`, `manual_override` 포함.

### StyleRouter
- `resolveActiveStyleStack()` / `resolve_active_style_stack()` 구현.
- 우선순위: `manual_override > character_dialogue > dialogue > scene_id > style_register > scene_type > chapter > arc > project_default`.
- overlay compatibility 검사 구현.

### StyleStack merge
- `mergeStyleStack()` / `merge_style_stack()` 구현.
- base/global, register, secondary overlay, character rule bucket 분리.
- conflict_policy MVP와 max_active_rules/token_budget 제한 구현.

### PromptCapsule
- `buildPromptCapsule()` / `build_prompt_capsule()` 구현.
- active stack, scene_type, style_register, secondary_types, rule buckets, negative_rules, fewshot_refs, self_checklist 구성.

### StyleMatchScorer
- `scoreStyleMatch()` / `score_style_match()` 구현.
- total_score, global_fit, register_fit, scene_classification_fit, leakage_penalty, register_mismatch_penalty, diagnostics 포함.

### SkillPack export
- TS: `buildStyleSkillPackFiles()` virtual files.
- Python: `export_style_skill_pack()` actual file output.
- CLI: `style-export-skill`.

## 3. 테스트 결과

### 추가한 테스트
- SceneClassifier: 5개.
- StyleRouter: 4개.
- PromptCapsule/merge/scoring: 2개.
- SkillPack/CLI: 2개.
- TS smoke: 1개 script.

### 실행 결과

```bash
python3 -m unittest discover -s tests -v
# Ran 13 tests in 1.785s
# OK

node --experimental-strip-types tests/styleSystem.node.test.mjs
# styleSystem TS smoke tests ok

python3 -m compileall -q packages/novelctl-core/novelctl
# OK
```

### 실패 또는 보류
- TypeScript full project build는 업로드본에 `package.json`/`tsconfig.json`이 없어 실행하지 않았다.
- Tauri build는 전체 프로젝트 파일이 없어 실행하지 않았다.

### Bindery 적용 후 추가 검증

- `node --experimental-strip-types tests/styleAnalyzer.node.test.mjs`: OK, sentence-separated sample이 문장 수만큼 scene으로 쪼개지지 않음.
- `npm --workspace apps/desktop run check`: 0 errors, 0 warnings.
- `npm run build`: OK, 기존 main chunk size warning 유지.
- `python3 scripts/verify_static.py`: OK.

## 4. 설계 반영 내용

### 조사 기반 문체 분석 방법론 반영
- feature score를 장면분류의 1차 기준으로 사용.
- SceneClassification이 StyleRouter와 PromptCapsule의 입력으로 연결됨.
- primary/secondary/register를 분리.

### LLM 사용 위치와 규칙 기반 처리 위치
- 구현된 MVP는 규칙 기반.
- LLM은 기존 `runAgentText()` workflow에서 감성·거리감 해석 보강용으로 남김.
- structured output 보정은 Phase 2.

### 과적합 방지 로직
- `content_terms` leakage penalty.
- default negative rules.
- local/surface over-transfer 금지 문구 SkillPack export.

### content leakage 방지 로직
- `scoreStyleMatch()`에서 content term hit 감점.
- PromptCapsule negative rules 항상 포함.
- SkillPack `references/leakage-rules.md` 생성.

## 5. 남은 작업

- SQLite repository sync between project `styles/` JSON and SQLite.
- Preset Manager/Stack Mixer/Router Editor UI.
- 한국어 형태소 분석기.
- LLM structured correction.
- 고급 scoring.
- SkillPack validator/zip exporter.

## 7. Phase 2 시작 반영

- Tauri style commands were added as Python `novelctl` runtime adapters: `classify_style_scene`, `resolve_style_route`, `build_prompt_capsule`, `score_style_match`, `export_style_skill_pack`.
- The MVP SQLite schema now lives in `packages/novelctl-core/novelctl/migrations/001_style_system.sql`; `SQLITE_SCHEMA` and `novelctl style-sql` read that migration-backed content.

## 6. 사용법

### CLI 장면분류

```bash
novelctl style-classify . --text "“아직은요.” 그 호칭은 조금 가까워져 있었다." --scene-id S001 --json
```

### CLI router

```bash
novelctl style-route . --context-json context.json --router-json router.json --json
```

### CLI PromptCapsule

```bash
novelctl style-capsule . --payload-json capsule_payload.json --max-rules 18 --json
```

### CLI score

```bash
novelctl style-score . --text "..." --style-json stack.json --classification-json classification.json --json
```

### CLI SkillPack export

```bash
novelctl style-export-skill . --style-json style_payload.json --output-dir exports --project-id proj --json
```
