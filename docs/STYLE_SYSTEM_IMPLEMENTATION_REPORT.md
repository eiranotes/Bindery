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
- `apps/desktop/src/lib/components/style/StyleSystemPanel.svelte`
- `packages/novelctl-core/novelctl/style_system.py`
- `packages/novelctl-core/novelctl/migrations/001_style_system.sql`
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
- total_score, global_fit, register_fit, scene_classification_fit, rhythm_fit, discourse_fit, dialogue_fit, lexical_fit, fluency, leakage_penalty, register_mismatch_penalty, overfit_penalty, diagnostics 포함.
- Phase 2에서 discourse/dialogue/lexical/fluency가 상수값이 아니라 scene feature, baseline, rule word contact, repetition signal로 계산된다.

### SkillPack export
- TS: `buildStyleSkillPackFiles()` virtual files.
- Python: `export_style_skill_pack()` actual file output.
- CLI: `style-export-skill`, `style-validate-skill`.
- Validator, zip exporter, reference loading policy, regression fixture, structured-output schema manifest, Korean marker manifest를 포함한다.

### Repository sync
- `novelctl style-sync` 구현.
- `styles/profiles`, `styles/presets`, `styles/stacks`, `styles/routers`, `styles/classifications`, `styles/reports` JSON을 `.bindery/style-system.sqlite3`로 upsert한다.
- `styles/style-repository.json`에 sync policy와 count를 기록한다.

### Korean NLP / surface analysis
- 외부 형태소 의존성 없이 deterministic MVP로 eojeol, 어미, 조사, 존대, 행동 동사, 판단어, 관계 표지, 감정어를 카운트한다.
- 화자 식별은 자동 확정하지 않고 후보와 `manual_speaker_correction_first` 정책으로 노출한다.

### Phase 2 UI
- `문체 시스템` stage 추가.
- Preset Manager, Stack Mixer, Router Editor, Scene Override, Score Lab, Suggestion Lab, SkillPack export preview 구현.

## 3. 테스트 결과

### 추가한 테스트
- SceneClassifier: 5개.
- StyleRouter: 4개.
- PromptCapsule/merge/scoring: 2개.
- Repository/NLP: 2개.
- SkillPack/CLI: 4개.
- TS smoke: 1개 script.

### 실행 결과

```bash
python3 -m unittest discover -s tests -v
# Ran 18 tests
# OK

node --experimental-strip-types tests/styleSystem.node.test.mjs
# styleSystem TS smoke tests ok

python3 -m compileall -q packages/novelctl-core/novelctl
# OK
```

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
- structured output 보정 schema는 Phase 2에서 추가했지만 총점 산출 권한은 로컬 scorer에 남김.

### 과적합 방지 로직
- `content_terms` leakage penalty.
- default negative rules.
- local/surface over-transfer 금지 문구 SkillPack export.

### content leakage 방지 로직
- `scoreStyleMatch()`에서 content term hit 감점.
- PromptCapsule negative rules 항상 포함.
- SkillPack `references/leakage-rules.md` 생성.

## 5. 남은 작업

- 외부 형태소기 연동은 아직 하지 않았다. 현재는 dependency-free deterministic surface analyzer다.
- Windows runner와 packaged `.app` click-through는 별도 검증 항목으로 남아 있다.

## 7. Phase 2 시작 반영

- Tauri style commands were added as Python `novelctl` runtime adapters: `classify_style_scene`, `resolve_style_route`, `build_prompt_capsule`, `score_style_match`, `export_style_skill_pack`.
- The MVP SQLite schema now lives in `packages/novelctl-core/novelctl/migrations/001_style_system.sql`; `SQLITE_SCHEMA` and `novelctl style-sql` read that migration-backed content.

## 8. Phase 2 완료 반영

- `style-sync`, `style-structured-schemas`, `style-korean-nlp`, `style-validate-skill` CLI 추가.
- `StyleSystemPanel.svelte`로 Phase 2 관리 UI 추가.
- Score Lab과 Suggestion Lab은 로컬 scorer와 Korean surface report를 사용한다.
- SkillPack export는 validation report와 zip path를 지원한다.

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

### CLI repository sync

```bash
novelctl style-sync . --json
```

### CLI structured schema / Korean surface / validation

```bash
novelctl style-structured-schemas . --json
novelctl style-korean-nlp . --text "..." --speaker "에이라" --json
novelctl style-validate-skill . --skill-dir exports/bindery-style-runtime --zip-path exports/bindery-style-runtime.zip --json
```
