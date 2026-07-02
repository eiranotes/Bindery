# 03. Technical Stack

## 1. 권장 스택 요약

```text
Desktop Shell: Tauri 2
Frontend: SvelteKit + TypeScript
Editor: CodeMirror 6
Aux Editor: Monaco Editor, optional
Future Rich Editor: Tiptap, optional
Backend Bridge: Rust Tauri commands
Core Runner: Python novelctl CLI
AI Runtime: Gemini CLI subagents
Storage: Markdown/YAML/JSON + SQLite cache
Versioning: Snapshot directory + Git optional
Packaging: Tauri Bundler
```

## 2. Tauri 2

### 선택 이유

- 네이티브 데스크톱 앱으로 배포 가능.
- 웹 프론트엔드를 그대로 활용 가능.
- Rust backend에서 파일시스템, subprocess, OS dialog, Git command를 안전하게 제어 가능.
- Electron보다 앱 크기와 권한 모델 측면에서 유리하다.
- 사용자 맥락상 Tauri/SvelteKit 경험이 이미 있어 연속성이 좋다.

### 역할

Tauri는 다음을 담당한다.

- 프로젝트 폴더 선택
- 파일 읽기/쓰기
- 디렉토리 watch
- Python `novelctl` 실행
- Gemini CLI 실행
- Git command 실행
- Snapshot 파일 복사
- 앱 설정 저장
- OS notification
- crash/log 수집

### Rust Command 예시

```rust
#[tauri::command]
async fn open_project(path: String) -> Result<ProjectManifest, AppError> {
    validate_project_path(&path)?;
    let manifest = scan_project(&path).await?;
    Ok(manifest)
}

#[tauri::command]
async fn run_novelctl(
    project_path: String,
    args: Vec<String>,
) -> Result<JobHandle, AppError> {
    spawn_job("novelctl", args, project_path).await
}
```

## 3. Frontend: SvelteKit + TypeScript

### 선택 이유

- Tauri와 결합하기 쉽다.
- 상태·컴포넌트 구조가 React보다 단순하게 갈 수 있다.
- 사용자의 기존 Tauri/SvelteKit 맥락과 맞다.
- Markdown editor, 패널, job console, tree UI 등 데스크톱형 UI 구현에 충분하다.

### 프로젝트 구조

```text
apps/desktop/src/
  routes/
    +layout.svelte
    +page.svelte
  lib/
    api/
      tauri.ts
      commands.ts
    stores/
      project.ts
      editor.ts
      jobs.ts
      qa.ts
      settings.ts
    components/
      layout/
      binder/
      editor/
      episode/
      qa/
      codex/
      canvas/
      settings/
    workers/
      markdownParse.worker.ts
      repetition.worker.ts
```

## 4. Editor: CodeMirror 6

### 선택 이유

- Markdown source 편집에 최적.
- decoration, lint, autocomplete, fold, hover tooltip, gutter를 확장하기 좋다.
- Dynamic Link, 반복어 하이라이트, QA squiggle, scene folding 구현에 적합하다.
- Markdown 원문 보존에 유리하다.

### 필수 확장

| Extension | 구현 내용 |
|---|---|
| Markdown language | 기본 Markdown syntax |
| YAML frontmatter parser | frontmatter 접기/속성 패널 연동 |
| Wiki link completion | `[[...]]` 자동완성 |
| Dynamic mention decoration | Codex alias 하이라이트 |
| Repetition highlight | 반복 표현 위치 표시 |
| QA diagnostics | 문제 구간 squiggle, gutter marker |
| Scene folding | `## Scene` 또는 frontmatter 기반 fold |
| Word count plugin | 글자 수/문단 수 실시간 계산 |
| Selection command menu | `/rewrite`, `/expand` 등 inline command |

### 구현 전략

- 에디터 값은 Svelte store가 아니라 CodeMirror 내부 state를 source로 둔다.
- 파일 저장 시 현재 document를 읽어 write command 호출.
- 긴 문서에서 분석은 Web Worker로 돌린다.
- Decoration은 incremental update를 우선한다.

## 5. Monaco Editor

### 역할

Monaco는 본문 에디터가 아니라 개발자/설정 편집용 보조 에디터다.

사용처:

- `.novelctl/config.yaml`
- `.gemini/agents/*.md`
- JSON schema
- Canvas JSON
- Diff viewer 후보

Monaco는 VS Code 기반이라 JSON/YAML/코드 편집에 강하지만, 소설 본문 Markdown 편집은 CodeMirror가 더 가볍고 세밀한 decoration 제어에 유리하다.

## 6. Tiptap

### 역할

MVP에서는 사용하지 않는다. v2 이후 다음 기능을 구현할 때 검토한다.

- 블록형 장면 편집
- WYSIWYG 모드
- 카드형 inline story block
- comment/collaboration layer

주의:

- Tiptap/ProseMirror 내부 문서 모델과 Markdown source 간 왕복 변환 문제가 생길 수 있다.
- 이 프로젝트는 Markdown 원본 보존이 우선이므로 Tiptap은 보조 뷰로만 쓴다.

## 7. Python novelctl Core

### 역할

기존 CLI MVP를 GUI backend runner로 유지한다.

담당:

- 프로젝트 init
- context pack 생성
- draft/summarize/canon-delta/qa/revise/commit
- repetition/rhythm 분석
- file scaffold 생성
- schema validation
- snapshot manifest 생성

### GUI 연동 조건

CLI는 반드시 다음을 지원해야 한다.

```bash
novelctl status --json
novelctl context 012 --json
novelctl qa 012 --all --json
novelctl repetition 012 --json
novelctl rhythm 012 --json
novelctl snapshot 012 --json
```

표준 출력은 human-readable이 아니라 machine-readable JSON 모드를 제공해야 한다.

## 8. Gemini CLI Subagents

### 역할

전문 작업을 분리한다.

| Agent | 역할 |
|---|---|
| context-architect | context pack 생성 |
| episode-planner | scene plan 생성 |
| prose-drafter | 초안 작성 |
| canon-extractor | canon delta 추출 |
| plot-qa | 플롯 QA |
| continuity-qa | 설정/타임라인 QA |
| style-qa | 레퍼런스 문체 QA |
| voice-qa | 캐릭터 말투 QA |
| lexicon-qa | 반복 표현/단어 QA |
| reader-reviewer | 독자 리뷰 시뮬레이션 |
| revision-director | 수정 지시서 작성 |
| prose-rewriter | 최종 수정 |
| archivist | 상태 갱신 후보 생성 |

### 실행 방식

GUI는 직접 모델 API를 부르지 않는다. 기본은 Gemini CLI subprocess를 호출한다.

```text
GUI → Tauri command → novelctl → Gemini CLI → .gemini/agents/*.md → output file
```

이렇게 해야 CLI와 GUI가 같은 파이프라인을 공유한다.

## 9. Storage

### 파일 저장소

```text
project/
  story/
  plot/
  canon/
  characters/
  world/
  notes/
  analysis/
  qa/
  snapshots/
  canvas/
```

### SQLite cache

SQLite는 다음만 저장한다.

- file index
- frontmatter index
- aliases index
- mention index
- word frequency cache
- job history
- UI recently opened files

중요 데이터는 반드시 파일에도 존재해야 한다.

## 10. Git

Git은 optional이다. 앱은 Git이 없어도 작동해야 한다.

Git이 있으면:

- current branch 표시
- dirty files 표시
- commit button
- diff viewer
- history view

Git이 없으면:

- snapshots로 대체한다.

## 11. Package Manager

권장:

```text
Node: pnpm
Rust: cargo
Python: uv 또는 pipx
```

개발 명령:

```bash
pnpm install
pnpm tauri dev
pnpm tauri build
uv sync
uv run novelctl status
```

## 12. 선택하지 말아야 할 구조

### Electron-first

가능하지만 앱 크기, 시스템 통합, 보안 모델 측면에서 Tauri보다 우선순위가 낮다.

### DB-first

소설 원고와 설정을 DB에만 저장하면 Obsidian/Git 호환성이 깨진다.

### WYSIWYG-first

Markdown 원문 보존과 AI diff 적용이 어려워진다. Source editor first가 맞다.

### AI API direct-first

Gemini CLI 서브에이전트, 로컬 설정, 사용자 커스터마이징 흐름을 살리려면 CLI-first가 적합하다.
