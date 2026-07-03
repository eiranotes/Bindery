# SCENE_CLASSIFICATION.md

## 구현 위치

- TS: `styleSystem.ts`의 `classifyScene()`
- Python: `style_system.py`의 `classify_scene()`

## SceneClassification schema

```ts
type SceneClassification = {
  scene_id: string;
  chapter_id?: string;
  primary_type: 'OBS'|'DIA'|'ACT'|'INF'|'CON'|'MOV'|'AFT'|'TRN'|'INT'|'REL';
  secondary_types: SceneTag[];
  surface_mode: 'dialogue-heavy'|'description-heavy'|'action-heavy'|'exposition-heavy'|'internal-heavy'|'mixed';
  narrative_functions: NarrativeFunction[];
  style_register: StyleRegister;
  confidence: number;
  scores: Record<SceneTag, number>;
  feature_scores: SceneFeatureScores;
  manual_override: boolean;
}
```

## 지원 태그

| tag | 의미 | register |
|---|---|---|
| OBS | observation | observation |
| DIA | dialogue | dialogue |
| ACT | action | action |
| INF | information | exposition |
| CON | conflict | conflict |
| MOV | movement | movement |
| AFT | aftermath | aftermath |
| TRN | transition | quiet_transition |
| INT | internal | internal_overlay |
| REL | relationship | relationship_overlay |

## Feature score

- `dialogue_ratio`
- `observation_density`
- `action_verb_density`
- `exposition_marker_density`
- `conflict_intensity`
- `movement_marker_density`
- `aftermath_marker_density`
- `transition_marker_density`
- `internal_judgment_density`
- `relationship_shift_density`

## 판정 방식

1. 문장과 대화 quote/line을 계산한다.
2. marker density를 0~1 score로 정규화한다.
3. core tag(`OBS/DIA/ACT/INF/CON/MOV/AFT/TRN`) 중 최고 score를 우선 primary 후보로 본다.
4. `REL/INT`는 core score가 충분히 낮고 overlay score가 압도적일 때만 primary가 된다.
5. threshold 이상인 나머지 tag를 `secondary_types`에 넣는다.
6. `primary_type`을 `style_register`로 매핑한다.
7. confidence는 primary score와 2위 score 간 차이를 반영한다.

## 테스트 항목

- 대화 비율이 높은 장면은 `DIA` primary.
- 관계 변화 신호가 있어도 대화가 중심이면 `REL`은 secondary.
- 관찰 묘사가 많으면 `OBS` primary.
- 위기 신호가 강하면 `CON` primary 또는 secondary.
- `secondary_types`가 `primary_type`을 덮어쓰지 않음.
