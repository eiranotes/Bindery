# 04. Architecture

## 1. 전체 계층

```text
┌─────────────────────────────────────────────────────┐
│                    Tauri Desktop UI                 │
│ SvelteKit + CodeMirror + Panels + Stores            │
└───────────────┬─────────────────────────────────────┘
                │ invoke()
┌───────────────▼─────────────────────────────────────┐
│                 Rust Tauri Backend                  │
│ file IO / process runner / watcher / snapshot / git │
└───────────────┬─────────────────────────────────────┘
                │ subprocess
┌───────────────▼─────────────────────────────────────┐
│                  novelctl Python Core               │
│ project ops / analysis / schema / pipeline          │
└───────────────┬─────────────────────────────────────┘
                │ subprocess
┌───────────────▼─────────────────────────────────────┐
│                    Gemini CLI                       │
│ .gemini/agents/*.md subagents                       │
└───────────────┬─────────────────────────────────────┘
                │ read/write files
┌───────────────▼─────────────────────────────────────┐
│               Markdown Project Workspace            │
│ story / plot / canon / characters / qa / analysis   │
└─────────────────────────────────────────────────────┘
```

## 2. Source of Truth

| 데이터 | Source of Truth | Cache |
|---|---|---|
| 원고 | Markdown files | editor state, SQLite file index |
| 회차 요약 | Markdown + JSON frontmatter | SQLite episode index |
| 설정 | Markdown/YAML | SQLite codex index |
| alias/mention | Codex frontmatter | SQLite mention index |
| QA 결과 | Markdown + structured JSON block | SQLite QA score index |
| 분석 결과 | Markdown/JSON | SQLite analysis index |
| 스냅샷 | snapshots directory | SQLite snapshot index |
| Job history | log files | SQLite job table |

## 3. 주요 프로세스

### 3.1 프로젝트 열기

```text
User selects folder
→ Tauri validates project
→ scan .novelctl/config.yaml
→ scan story/plot/canon files
→ build in-memory tree
→ optionally rebuild SQLite index
→ UI loads Binder + Dashboard
```

### 3.2 파일 편집

```text
User edits Markdown
→ CodeMirror state updated
→ dirty flag set
→ debounced analysis worker updates word count
→ autosave or manual save
→ Tauri write_file
→ file watcher event ignored if self-originated
→ SQLite index update queued
```

### 3.3 AI 단계 실행

```text
User clicks Draft
→ UI creates Job record
→ Tauri spawn novelctl draft 012 --json
→ novelctl builds prompt/context
→ novelctl calls Gemini CLI @prose-drafter
→ Gemini writes candidate file
→ novelctl returns JSON result
→ UI displays result and diff
```

### 3.4 QA 실행

```text
User clicks QA All
→ run plot-qa, continuity-qa, style-qa, voice-qa, lexicon-qa
→ each agent writes report
→ local analyzers write repetition/rhythm JSON
→ GUI parses reports
→ QA Dashboard updates cards
→ diagnostics mapped to editor positions when possible
```

### 3.5 Commit State

```text
Final approved
→ snapshot current project state
→ summarize final
→ canon-delta candidate generated
→ user reviews canon changes
→ archivist updates story-state, resume-state, open-threads
→ update-log appended
→ optional git commit
```

## 4. Job System

### 4.1 Job states

```text
queued → running → awaiting_review → applied → failed → cancelled
```

### 4.2 Job payload

```json
{
  "id": "job_20260701_120000_ep012_qa",
  "type": "qa",
  "episode": "012",
  "agent": "plot-qa",
  "status": "running",
  "inputFiles": ["story/chapters/ep012/13_final.md"],
  "outputFiles": ["story/chapters/ep012/06_plot-qa.md"],
  "startedAt": "2026-07-01T12:00:00+09:00"
}
```

### 4.3 Job 실행 정책

- 같은 파일에 쓰는 job은 동시 실행 금지.
- 읽기 전용 QA job은 병렬 가능.
- Draft/Rewriter는 같은 episode에 대해 하나만 실행.
- 긴 job은 cancel 가능해야 한다.
- cancel은 subprocess kill + partial output 표시.

## 5. Event Bus

Tauri backend는 프론트에 event를 보낸다.

```text
job:started
job:stdout
job:stderr
job:progress
job:completed
job:failed
file:changed
index:updated
snapshot:created
qa:updated
```

Svelte stores는 이벤트를 구독해 화면을 갱신한다.

## 6. File Watcher

목표:

- 외부 에디터/Obsidian에서 파일을 바꿔도 GUI가 감지.
- 현재 편집 중인 dirty file과 충돌하면 merge dialog 표시.

정책:

| 상황 | 처리 |
|---|---|
| GUI 저장 직후 watcher 발생 | self-originated write로 무시 |
| 외부 변경 + editor clean | 자동 reload |
| 외부 변경 + editor dirty | conflict dialog |
| 파일 삭제 | Binder에서 removed 표시, 열린 탭 경고 |
| 파일 이동 | path mapping 재스캔 |

## 7. Indexer

### 7.1 Index 대상

- episode frontmatter
- scene frontmatter
- codex aliases
- wiki links
- mention candidates
- word frequency
- QA scores
- tags

### 7.2 Rebuild 전략

- 초기 열기: full scan
- 파일 저장: targeted update
- 외부 대량 변경: debounce 후 partial scan
- schema 변경: full rebuild

## 8. Candidate/Diff 적용 구조

AI output은 원본에 바로 쓰지 않는다.

```text
candidate file:
  .novelctl/runs/<run-id>/candidate.md

apply methods:
  replace_selection
  insert_below
  replace_scene
  create_new_scene
  create_final
```

적용 전 snapshot:

```text
snapshots/ep012/20260701-120000-before-ai-apply/
```

## 9. 장애 처리

| 장애 | 대응 |
|---|---|
| Gemini CLI 없음 | mock mode, 설치 가이드 표시 |
| novelctl 없음 | bundled Python core 또는 path 설정 |
| agent prompt 없음 | template restore |
| JSON parsing 실패 | raw markdown output 표시 |
| 파일 권한 오류 | readable error + retry |
| 외부 파일 충돌 | compare/keep mine/keep external |
| AI가 빈 출력 | retry with shorter context, save logs |
