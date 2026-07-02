# Source Register

이 설계안은 기존 대화에서 정리한 `novelctl` CLI MVP, Character-World-IP-Orchestrator 레퍼런스, 그리고 공개 문서 조사를 기반으로 한다.

## 현재 확인한 주요 공개 문서

| 항목 | URL | 설계에 반영한 부분 |
|---|---|---|
| Tauri | https://tauri.app/ | Rust backend + web frontend, desktop shell, cross-platform packaging |
| CodeMirror | https://codemirror.net/ | Markdown source editor, extension/decorations/lint architecture |
| Monaco Editor | https://microsoft.github.io/monaco-editor/ | 설정/YAML/JSON/diff 개발자 모드용 보조 에디터 후보 |
| Tiptap | https://tiptap.dev/docs | 향후 WYSIWYG/block editor 확장 후보 |
| Gemini CLI Subagents | https://github.com/google-gemini/gemini-cli/blob/main/docs/core/subagents.md | `.gemini/agents/*.md`, specialized agent, isolated context concept |
| Google Developers Blog: Gemini CLI Subagents | https://developers.googleblog.com/en/subagents-have-arrived-in-gemini-cli/ | Markdown + YAML frontmatter agent definition, project/global agent location |
| Muvel Guide | https://guide.muvel.app/ | 소설 프로젝트 구성: 에피소드/플롯/위키/메모 |
| Muvel Dynamic Link | https://guide.muvel.app/editor-functions/dynamic-link | 위키 제목/별칭 자동 하이라이트, hover preview, 링크 이동 |
| Muvel Plot Canvas | https://guide.muvel.app/episode/plot-canvas | JSON 기반 캔버스, Obsidian Canvas 일부 호환, PNG/JPG/SVG/JSON export |
| Muvel AI Episode Analysis | https://guide.muvel.app/ai-features/ai-episode-analysis | 요약, 태그, 수위, 시점, 회차 특성 자동 분석 |
| Muvel AI Episode Review | https://guide.muvel.app/ai-features/ai-episode-review | 분야별 점수, 댓글형 피드백, 이전 편 요약 필요성 |
| Muvel Repetition Map | https://guide.muvel.app/widgets/repetition-map | 반복 단어/표현/문장 끝 패턴, 분포, 위치 이동 |

## 설계상 해석 원칙

- 공개 도구의 기능은 복제 목적이 아니라 벤치마크·요구사항 도출 목적이다.
- `Novel Studio`의 source of truth는 GUI 내부 DB가 아니라 로컬 Markdown/YAML/JSON 파일이다.
- SQLite는 검색색인, 캐시, 작업 로그, 빠른 조회용으로만 사용한다.
- AI 결과는 기본적으로 candidate이며, 사용자가 diff 확인 후 적용한다.
