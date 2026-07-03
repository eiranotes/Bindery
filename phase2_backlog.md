# phase2_backlog.md

## 1. Storage / SQLite
- [x] `SQLITE_SCHEMA`를 실제 migration 파일로 분리.
- style profile/preset/stack/router/classification/report repository 추가.
- project workspace의 `styles/` JSON 저장과 SQLite 저장 간 동기화 규칙 정의.

## 2. Tauri backend
- [x] `classify_style_scene`, `resolve_style_route`, `build_prompt_capsule`, `score_style_match`, `export_style_skill_pack` Tauri commands 추가.
- [x] Rust command가 Python CLI 또는 native TS/Rust port를 호출할지 결정. MVP는 Python `novelctl` style subcommand adapter로 연결한다.

## 3. UI
- Preset Manager: 프리셋 생성/수정/clone/archive.
- Stack Mixer: adapter weight, scope, conflict_policy preview.
- Router Editor: rule CRUD, priority preview, route explanation.
- Scene Classification detail editor: primary/secondary/surface/register manual override.
- Score Lab/Suggestion Lab 별도 화면.

## 4. Korean NLP
- 형태소 분석기 연동.
- 행동 동사, 판단어, 관계 표지, 감정어 사전 확장.
- 화자 식별은 완전 자동화하지 않고 수동 보정 우선.

## 5. LLM structured output
- SceneClassification 보정 schema.
- paragraph function tagging 보정 schema.
- scoring explanation/suggestion schema.
- LLM 단독 총점 산출 금지 guard.

## 6. Scoring 고도화
- rhythm/discourse/dialogue/lexical/fluency의 실제 feature 기반 산출.
- content leakage 후보 탐지와 사용자 확인 workflow.
- overfit penalty: 특정 장면 사물/동선/묘사 순서 반복 검출.

## 7. SkillPack
- SkillPack validator.
- zip exporter.
- few-shot 용량 제한 및 reference loading policy.
- exported skill의 regression fixture.
