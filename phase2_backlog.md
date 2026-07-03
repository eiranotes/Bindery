# phase2_backlog.md

## 1. Storage / SQLite
- [x] `SQLITE_SCHEMA`를 실제 migration 파일로 분리.
- [x] style profile/preset/stack/router/classification/report repository 추가.
- [x] project workspace의 `styles/` JSON 저장과 SQLite 저장 간 동기화 규칙 정의.

## 2. Tauri backend
- [x] `classify_style_scene`, `resolve_style_route`, `build_prompt_capsule`, `score_style_match`, `export_style_skill_pack` Tauri commands 추가.
- [x] Rust command가 Python CLI 또는 native TS/Rust port를 호출할지 결정. MVP는 Python `novelctl` style subcommand adapter로 연결한다.

## 3. UI
- [x] Preset Manager: 프리셋 생성/수정/clone/archive.
- [x] Stack Mixer: adapter weight, scope, conflict_policy preview.
- [x] Router Editor: rule CRUD, priority preview, route explanation.
- [x] Scene Classification detail editor: primary/secondary/surface/register manual override.
- [x] Score Lab/Suggestion Lab 별도 화면.

## 4. Korean NLP
- [x] 형태소 수준 표층 카운트 추가(외부 형태소기 없이 deterministic MVP).
- [x] 행동 동사, 판단어, 관계 표지, 감정어 사전 확장.
- [x] 화자 식별은 완전 자동화하지 않고 수동 보정 우선.

## 5. LLM structured output
- [x] SceneClassification 보정 schema.
- [x] paragraph function tagging 보정 schema.
- [x] scoring explanation/suggestion schema.
- [x] LLM 단독 총점 산출 금지 guard.

## 6. Scoring 고도화
- [x] rhythm/discourse/dialogue/lexical/fluency의 실제 feature 기반 산출.
- [x] content leakage 후보 탐지와 사용자 확인 workflow.
- [x] overfit penalty: 특정 장면 사물/동선/묘사 순서 반복 검출.

## 7. SkillPack
- [x] SkillPack validator.
- [x] zip exporter.
- [x] few-shot 용량 제한 및 reference loading policy.
- [x] exported skill의 regression fixture.
