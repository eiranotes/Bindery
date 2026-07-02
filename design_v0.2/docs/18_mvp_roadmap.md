# 18. MVP Roadmap

## Phase 0. CLI 안정화

Goal: GUI가 호출할 수 있는 `novelctl` core 준비.

Tasks:

- `--json` output 추가.
- command exit code 표준화.
- repetition/rhythm local analyzer 구현.
- snapshot command 구현.
- status/health check command 구현.
- Gemini CLI path 설정.
- mock mode 유지.

Done when:

```text
novelctl init/context/draft/qa/revise/commit/status/snapshot --json works.
```

## Phase 1. Tauri Shell

Tasks:

- Tauri + SvelteKit project 생성.
- project launcher.
- folder open.
- app settings.
- Tauri command bridge.
- file tree scan.

Done when:

```text
로컬 novelctl 프로젝트를 열고 파일 목록을 볼 수 있다.
```

## Phase 2. Markdown Editor MVP

Tasks:

- CodeMirror editor.
- read/write file.
- autosave.
- split preview.
- word count.
- frontmatter parse.
- dirty state.

Done when:

```text
회차 원고를 GUI에서 편집하고 저장할 수 있다.
```

## Phase 3. Episode Workspace

Tasks:

- episode folder recognition.
- tabs: brief/context/draft/summary/qa/final.
- toolbar actions.
- job console.
- run novelctl commands.

Done when:

```text
GUI 버튼으로 context/draft/summary/qa/revise/commit이 실행된다.
```

## Phase 4. QA Dashboard

Tasks:

- parse QA markdown/json block.
- score cards.
- issue list.
- jump to file/line.
- diagnostics decoration.

Done when:

```text
QA 결과를 GUI 카드와 에디터 하이라이트로 볼 수 있다.
```

## Phase 5. Snapshot and Diff

Tasks:

- create snapshot.
- list snapshots.
- restore snapshot.
- diff viewer.
- pre-apply snapshot before AI edit.

Done when:

```text
AI 수정 전후를 안전하게 비교하고 되돌릴 수 있다.
```

## Phase 6. Analysis Widgets

Tasks:

- repetition map.
- rhythm/density.
- reader review panel.
- episode metadata analysis.

Done when:

```text
뮤블식 반복 표현/단락 분석을 GUI에서 확인할 수 있다.
```

## Phase 7. Codex and Dynamic Links

Tasks:

- codex index.
- alias editor.
- mention scanner.
- hover preview.
- safe link apply.

Done when:

```text
본문 속 인물/설정명을 자동 감지하고 위키와 연결할 수 있다.
```

## Phase 8. Plot Board/Grid/Canvas

Tasks:

- scene cards.
- plot grid.
- Mermaid timeline/canvas export.
- graph view later.

Done when:

```text
회차 장면과 플롯라인을 카드/표/그래프로 관리할 수 있다.
```

## Phase 9. Packaging

Tasks:

- build app.
- settings migration.
- bundled templates.
- backup ZIP export.
- release notes.

Done when:

```text
로컬에서 설치 가능한 앱 패키지를 만들 수 있다.
```

## Recommended first milestone

2주 내 목표로 잡을 수 있는 가장 현실적인 범위:

1. Tauri shell.
2. Project open.
3. File tree.
4. CodeMirror editor.
5. Save/autosave.
6. Run `novelctl status` and `novelctl qa`.
7. Job console.
8. Snapshot create/list.
