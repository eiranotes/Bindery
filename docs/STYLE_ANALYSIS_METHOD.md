# STYLE_ANALYSIS_METHOD.md

## 구현된 분석 계층

기존 `styleAnalyzer.ts`는 다음 로컬 분석을 이미 수행한다.

- 입력 정규화
- 명시 구분자 기반 scene 후보 분할과 짧은 문장/문단 블록 묶기
- pacing, transition, dialogue, surface feature coding
- evidence rule 후보 생성
- globality 판정
- local PromptCapsuleV3 생성

이번 패치는 별도의 runtime classifier를 추가했다.

- `computeSceneFeatureScores()` / `compute_scene_feature_scores()`
- `classifyScene()` / `classify_scene()`

## 규칙 기반 처리

아래 항목은 LLM 없이 처리한다.

- 문장 분할
- scene 후보 grouping: `***`, `---`, heading은 hard boundary로 보고, 짧은 문장형 블록은 최소 장면 단위가 될 때까지 병합
- 대화 비율
- keyword density 기반 feature score
- `primary_type` 결정
- `secondary_types` 결정
- `style_register` 매핑
- StyleRouter rule matching
- StyleStack rule selection
- PromptCapsule rule bucket 구성
- StyleMatchScore MVP 계산
- SkillPack Markdown 생성

## LLM 보조 예정 위치

이번 패치에는 실제 provider 호출을 넣지 않았다. Phase 2에서 structured output으로 연결할 위치는 다음이다.

- SceneClassification 보정
- 담화 feature 설명
- narrative pacing 해석
- score explanation
- suggestion 문장화

## 과적합 방지

- `content_terms`가 target text에 등장하면 `leakage_penalty`를 부여한다.
- default negative rules에 원문 고유명사, 사건 구조, 특정 장면 사물/동선 전이 금지를 포함한다.
- SkillPack `leakage-rules.md`에 동일한 금지 규칙을 내보낸다.
- `secondary_types`는 register를 바꾸지 않고 overlay bucket으로만 반영한다.
