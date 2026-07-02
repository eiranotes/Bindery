# 02. Benchmark to Requirements

## 1. 벤치마크 요약

| 도구/계열 | 참고 기능 | Novel Studio 요구사항 |
|---|---|---|
| Muvel | 에피소드/플롯/위키/메모, 다이나믹 링크, 플롯 캔버스, 반복 표현 지도, AI 분석/리뷰 | 소설 전용 4영역 UX, Dynamic Link, Canvas, Repetition Map, Reader Review |
| Scrivener | Binder, Corkboard, Outliner, Snapshot, Compile | 좌측 Binder, 장면 카드, 전체 Outliner, Snapshot/Diff/Restore, Compile |
| Novelcrafter | Codex, 자동 mention, progression, AI 기반 설정 참조 | Codex DB, mention scanner, progression tracker, context pack injection |
| Sudowrite | Write, Describe, Expand, Rewrite, Feedback | Continue, Expand Scene, Enrich, Rewrite, Feedback/Reader Review |
| Plottr | Timeline, Plotline, Scene Cards, Templates | Plot Board, Plot Grid, Timeline, Template 적용 |
| Campfire | 세계관 모듈, 관계망, 타임라인, 맵 | Codex modules, relationship graph, timeline QA, location metadata |
| Seosa류 AI 파이프라인 | Story Bible 자동 주입, 회차 요약, 품질 평가 | Context Pack, Summary, Canon Delta, QA pipeline |

## 2. Muvel에서 가져올 요구사항

### 2.1 에피소드/플롯/위키/메모 구조

요구사항:

- 메인 네비게이션은 `Episodes`, `Plot`, `Codex/Wiki`, `Notes`를 기본 축으로 둔다.
- 각 영역은 같은 Markdown 파일이라도 용도별 UI가 다르다.
- 에피소드는 회차 목록/본문/요약/태그/상태 중심이다.
- 플롯은 카드/그리드/캔버스 중심이다.
- 위키는 항목/별칭/속성/링크 중심이다.
- 메모는 빠른 캡처/승격/폐기 중심이다.

### 2.2 Dynamic Link

요구사항:

- Codex 항목의 `name`, `aliases`를 색인화한다.
- 에디터 본문에서 일치 항목을 decoration으로 하이라이트한다.
- hover 시 요약 카드가 뜬다.
- 클릭 시 해당 Codex 문서로 이동한다.
- confidence가 낮은 짧은 별칭은 자동 링크하지 않는다.
- 조사 결합형 alias를 지원한다.

### 2.3 Plot Canvas

요구사항:

- 노드 종류: Episode, Scene, Character, Location, Thread, Mystery, Canon Item.
- 엣지 종류: cause, reveal, foreshadow, payoff, conflict, relationship.
- Mermaid export를 MVP로 제공한다.
- JSON canvas export를 v1에서 제공한다.
- Obsidian Canvas 호환은 완전 호환이 아니라 best-effort로 명시한다.

### 2.4 Repetition Map

요구사항:

- 단어, 구절, 문장 끝 패턴을 별도 분석한다.
- count뿐 아니라 분포를 표시한다.
- 항목 클릭 시 에디터 위치로 이동한다.
- “의도된 반복” 마킹을 지원한다.
- 수정 제안은 삭제 명령이 아니라 대체 전략으로 제공한다.

### 2.5 AI Episode Analysis / Review

요구사항:

- episode summary를 생성한다.
- tags, POV, rating, traits, cliffhanger strength를 추출한다.
- reader review는 QA와 분리한다.
- 이전 편 summary가 있으면 reader review context에 포함한다.

## 3. Scrivener에서 가져올 요구사항

### 3.1 Binder

- 좌측 파일 트리는 단순 파일 브라우저가 아니라 소설용 Binder다.
- episode, scene, note, codex, qa report를 타입별 아이콘으로 표시한다.
- 파일 이동은 실제 파일 이동과 frontmatter 갱신을 함께 처리한다.

### 3.2 Corkboard / Scene Cards

- 각 scene은 frontmatter와 summary를 가진다.
- 카드를 drag/drop하면 scene order가 바뀐다.
- 변경 전 snapshot을 남긴다.

### 3.3 Outliner

- 회차/장면의 상태, POV, location, characters, word count, QA status를 표로 본다.
- 필터: character, location, thread, status, QA fail.

### 3.4 Snapshot / Compile

- `snapshot`은 파일 단위 복사 + manifest + hash로 구현한다.
- `compile`은 selected final files를 순서대로 합쳐 Markdown/TXT로 내보낸다.

## 4. Novelcrafter/Campfire 계열 요구사항

### 4.1 Codex

- 캐릭터, 장소, 조직, 제도, 아이템, 용어, 사건을 항목화한다.
- 각 항목은 Markdown 문서 + YAML frontmatter로 구성한다.
- alias, first_appearance, last_updated, related_threads를 기본 필드로 둔다.

### 4.2 Progression

- 캐릭터/관계/장소/플롯라인의 상태 변화 기록을 별도 관리한다.
- 회차 commit 단계에서 summary와 canon delta를 바탕으로 후보 progression을 생성한다.
- 사용자가 승인하면 progression에 반영한다.

## 5. Sudowrite 계열 요구사항

- `continue`: 현재 위치 이후 이어쓰기 후보 생성.
- `expand-scene`: 빠른 장면을 확장.
- `enrich`: 감각/행동/대화/갈등 축으로 보강.
- `rewrite`: 선택 영역 지시 기반 재작성.
- `feedback`: 독자/편집자 관점 피드백.

중요: 결과는 모두 candidate로 표시하고 diff 적용한다.

## 6. 요구사항 우선순위

| Priority | 기능 |
|---:|---|
| P0 | 프로젝트 열기, Markdown 편집, 파일 저장 |
| P0 | Episode Workspace, Gemini CLI 실행, Job Console |
| P0 | Context/Draft/Summary/QA/Revise/Commit 버튼 |
| P0 | Snapshot + Diff |
| P1 | Repetition Map, Rhythm/Density |
| P1 | Dynamic Link |
| P1 | QA Dashboard |
| P1 | Plot Grid |
| P2 | Canvas Graph |
| P2 | Progression UI |
| P2 | Reader Review |
| P3 | WYSIWYG/block editor |
| P3 | 모바일/클라우드 동기화 |
