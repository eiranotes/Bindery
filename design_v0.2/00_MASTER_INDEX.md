# Master Index

## 설계 핵심

- GUI는 Tauri/SvelteKit 기반 데스크톱 앱이다.
- Markdown 파일이 source of truth다.
- 기존 `novelctl` CLI는 domain core이자 작업 러너다.
- Gemini CLI subagents는 AI 실행 엔진이다.
- GUI는 파일, 에디터, 에이전트, QA, 분석, 스냅샷, Git을 통합한다.

## 가장 먼저 구현할 순서

1. `novelctl --json` 안정화.
2. Tauri shell 생성.
3. 프로젝트 열기/파일 트리.
4. CodeMirror Markdown editor.
5. Episode Workspace 탭.
6. Job console에서 `novelctl` 실행.
7. QA Dashboard.
8. Snapshot/Diff.
9. Repetition/Rhythm widgets.
10. Dynamic Link/Codex.

## 결정된 기술스택

- Tauri 2
- SvelteKit + TypeScript
- CodeMirror 6
- Python novelctl core
- Gemini CLI subagents
- SQLite cache
- Markdown/YAML/JSON files
- Git optional


## v0.2 문서

- `docs/22_design_review.md` — 설계 리뷰 및 강화안
- `implementation_plan/` — 구현 태스크 분해(모노레포/Phase/Command/컴포넌트/Store/스키마/커밋순서/티켓)
