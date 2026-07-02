# Bindery Studio Concept

## 0. Direction

Bindery는 단순한 Markdown 에디터가 아니다. 목표는 **장편/연재 소설을 플랜에서 원고까지 일관된 하네스로 진행하는 로컬 우선 Book Studio**다.

핵심 구조는 다음 순서로 고정한다.

```text
Import Bible
→ Brief
→ Foundations
→ Spine
→ Chapters
→ Beats
→ Prose
→ Read / Revise
→ Publish
```

AI CLI는 채팅창이 아니라 **작업자 Agent**다. Agent는 파일을 직접 확정하지 않고, 정규화안·후보·리포트를 만든다. 사용자는 diff와 evidence를 보고 적용한다.

---

## 1. Primary Workflow

### 1.1 Import Bible

사용자는 기존 자료를 넣는다.

```text
synopsis.md
world.md
characters.md
plot.md
episode_plan.md
style_sample.md
random_notes.md
```

Agent CLI는 이를 바로 원고로 쓰지 않는다. 먼저 Bindery 양식으로 정규화한다.

```text
.bindery/
  project.json
  bible/
    brief.md
    foundations.md
    spine.md
    cast.yml
    factions.yml
    locations.yml
    rules.yml
    timeline.yml
    plot_threads.yml
    style_guide.md
    unresolved_questions.md
  outline/
    chapters.yml
    beats.yml
  harness/
  candidates/
  tmp/
```

### 1.2 Approve Foundation

정규화 결과는 Import Report로 표시한다.

```text
✓ characters extracted
✓ plot threads extracted
⚠ contradiction: protagonist motivation differs between synopsis and notes
⚠ ep004 lacks clear conflict
```

승인된 항목만 다음 단계의 입력으로 들어간다.

### 1.3 Episode Harness

각 회차는 전체 바이블을 통째로 넣지 않고, 필요한 정보만 묶은 harness로 실행한다.

```yaml
episode: ep012
task: draft
beat:
  purpose: "주인공이 길드 정치의 실제 가격을 체감한다"
  conflict: "후보 영입 조건과 기존 파벌의 압박이 충돌한다"
  turn: "에이라가 관찰자에서 이해관계자로 움직인다"
required_refs:
  characters: [protagonist, eira]
  plot_threads: [guild_politics, injured_candidates]
constraints:
  - "새 설정 추가 금지"
  - "미승인 캐릭터 등장 금지"
  - "과장된 티키타카 금지"
```

### 1.4 Candidate, Diff, Apply

Agent 출력은 항상 candidate가 된다.

```text
Agent output
→ Candidate card
→ Diff view
→ Apply all / Apply hunk
→ Auto snapshot before first apply
```

---

## 2. UI Model

### 2.1 My Books

프로젝트가 없으면 바로 편집 화면으로 들어가지 않는다. 첫 화면은 책 목록과 import/open 진입점이다.

```text
My Books
- Open Book
- Recent books
- Sample book
- Agent status
```

### 2.2 Book Studio

프로젝트가 열리면 화면은 세 영역으로 고정된다.

```text
┌──────────────────────────────────────────────┐
│ TopBar: Book / Step / Agent / Theme          │
├────────────┬────────────────────┬────────────┤
│ Navigator  │ Studio Surface     │ AI Editor  │
│            │                    │            │
│ Book map   │ Build ladder       │ Proposals  │
│ Files      │ Step editor        │ Evidence   │
│ Bible      │ Prose / Beats      │ Settings   │
└────────────┴────────────────────┴────────────┘
```

### 2.3 Build Ladder

상단 ladder는 Pensive식 제작 단계를 따른다.

| Step | Role |
|---|---|
| Brief | 작품 약속, 독자 경험, 하드 리밋 |
| Foundations | 캐릭터, 세계관, 문체, 금지 패턴 |
| Spine | 작품 전체 줄기 |
| Chapters | 회차 구조 |
| Beats | 장면/회차별 목적·갈등·전환 |
| Prose | 원고 작성 |
| Read / Revise | QA, 반복 분석, 후보 diff |
| Publish | 검증된 산출물 export |

### 2.4 Navigator

좌측은 파일트리가 아니라 책 지도다. 파일트리는 보조 탭으로 남긴다.

```text
Book
  Map 62%
  Build ladder
  Episodes
Files
  raw project tree
Bible
  character / location / thread cards
```

### 2.5 AI Editor Rail

오른쪽은 탭 더미가 아니라 Agent rail이다.

```text
AI Editor
- current step
- provider
- output mode
- evidence summary
- pipeline actions
- candidate hints
- versions
- run log
- settings
```

---

## 3. Agent CLI Policy

### 3.1 Provider

Bindery는 특정 CLI에 종속되지 않는다.

```text
provider = antigravity | gemini | custom
command  = agy | gemini | absolute path
mode     = file | stdout
```

### 3.2 Antigravity Default

Antigravity CLI는 기본값을 `file` 출력으로 둔다.

```text
agy -p "Write the result to .bindery/tmp/candidates/<id>.md"
```

이유는 GUI subprocess에서 stdout 캡처가 비어도, 파일 출력은 후보 회수 경로로 쓸 수 있기 때문이다.

### 3.3 Gemini / Custom

Gemini 또는 stdout이 안정적인 custom CLI는 `stdout` 모드로 쓸 수 있다.

```text
gemini -p "Return only revised manuscript markdown"
```

---

## 4. Versioning Rule

수동 snapshot은 도구다. 자동 snapshot은 규칙이다.

```text
Before first candidate apply in a session:
  create snapshot
  then apply candidate/hunk
```

Publish 단계에서는 원고와 함께 QA report, snapshot manifest, run log를 묶는다.

---

## 5. Implementation Status in stage315

Implemented:

- My Books landing screen
- Pensive-style Book Studio shell
- Build ladder store and UI
- Book Navigator / Files / Bible tabs
- AI Editor rail without right-tab clutter
- Agent CLI settings: Antigravity, Gemini, Custom
- Antigravity file-output candidate path
- macOS scripts, workflow, and `icon.icns`

Not fully implemented yet:

- Real Import Bible normalization command
- Persistent `.bindery/project.json` ladder state
- Full chapter/beats YAML parser
- Publish/export bundle command
