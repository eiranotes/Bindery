# 14. Plot Board, Grid, and Canvas

## 1. 세 가지 플롯 뷰

| View | 목적 |
|---|---|
| Plot Board | 장면 카드 순서와 상태 관리 |
| Plot Grid | 장면 × 플롯라인/캐릭터 아크 매트릭스 |
| Canvas | 사건/캐릭터/설정/떡밥의 관계 그래프 |

## 2. Plot Board

### 2.1 Scene card

```ts
type SceneCard = {
  id: string;
  episode: string;
  title: string;
  summary: string;
  status: "brief" | "draft" | "final" | "cut";
  pov: string;
  location: string;
  characters: string[];
  plotlines: string[];
  tension: "low" | "mid" | "high";
  path: string;
};
```

### 2.2 Features

- drag reorder
- create scene
- split scene
- merge scene
- mark cut
- generate from card
- run QA on scene

## 3. Plot Grid

### 3.1 Data model

```yaml
plotlines:
  - id: main
    label: Main Plot
  - id: eira-arc
    label: Eira Arc
  - id: medical-risk
    label: Medical Risk

rows:
  - scene: scene-01
    main: setup
    eira-arc: observe
    medical-risk: mention
    tension: low
```

### 3.2 UI

- rows are scenes.
- columns are plotlines.
- cell values are beat labels.
- empty cells indicate subplot absence.
- filters by plotline/character.

### 3.3 QA integration

Plot Grid can warn:

- subplot vanished for too many scenes.
- tension flatline.
- character arc repeated same function.
- open thread not touched for N episodes.

## 4. Canvas

### 4.1 Node types

| Type | Example |
|---|---|
| episode | EP012 |
| scene | scene-03 |
| character | Eira |
| location | guild-office |
| thread | medical-risk |
| mystery | past accident |
| canon | guild medical director vacancy |

### 4.2 Edge types

| Type | Meaning |
|---|---|
| cause | A causes B |
| reveal | A reveals B |
| foreshadow | A foreshadows B |
| payoff | B pays off A |
| conflict | A conflicts with B |
| relationship | character relationship |

### 4.3 MVP implementation

Do not build full draggable graph first.

Phase 1:

- generate Mermaid from plot data.
- render Mermaid preview.
- export `.mermaid.md`.

Phase 2:

- store canvas JSON.
- use Svelte Flow/React Flow style component.
- allow node drag.

Phase 3:

- Obsidian Canvas best-effort export.

## 5. Timeline

Timeline is separate from Canvas.

Data:

```yaml
- id: event-001
  title: "길드 인수"
  timeline: arc1-day1
  episode: ep001
  characters: [protagonist]
- id: event-012
  title: "의료 리스크 노출"
  timeline: arc1-day4
  episode: ep012
```

UI:

- chronological list
- episode order view
- in-world time view
- conflicts report

## 6. Templates

Plot templates:

- webnovel-serial-arc
- mystery-setup-payoff
- dungeon-expedition
- character-trust-arc
- tournament-arc

Template apply should create cards, not generate prose directly.
