# Stage 3 전체 개선 의견 및 반영 내역

## 1. 기존 설계에서 유지한 원칙

- Markdown/YAML/JSON source of truth.
- Gemini/novelctl 결과는 candidate이며 원본을 자동 덮어쓰지 않음.
- 회차는 `manuscript.md` + `index.md` manifest 중심으로 단순화.
- QA는 점수표가 아니라 revision task로 이어져야 함.
- Snapshot과 build/report evidence를 남김.

## 2. 개선 의견

| 영역 | 의견 | 반영 |
|---|---|---|
| UI 구조 | 기능이 많아질수록 복잡하므로 Superloopy식 lane/evidence 구조로 압축해야 함 | 좌측 Binder, 중앙 Editor, 우측 Evidence Gates/Agent Crew로 배치 |
| 검증 | “됐다”는 설명보다 산출물 기반 검증이 필요 | `BUILD_REPORT.md`, `browser-smoke.png`, `plan/state/log` 추가 |
| 코드 경계 | Tauri와 브라우저 mock이 섞이면 테스트가 어려움 | `src/lib/api/commands.ts`에서 Tauri invoke와 mock fallback 분리 |
| 에디터 | CodeMirror 6 wrapping API 오해 가능 | 실제 build 후 `EditorView.lineWrapping`으로 수정 |
| 접근성 | file tree 클릭 div는 a11y warning 발생 | `FileTreeNode`를 button으로 리팩토링 |
| 반복 분석 | QA와 분석을 분리해야 함 | `RepetitionPanel`과 Tauri/Python analyzer 분리 |
| 배포 | 단독 exe 요구를 초기에 막히지 않게 해야 함 | Tauri NSIS target, PowerShell build script, Windows GitHub Action 추가 |
| 이어받기 | 장기 작업은 handoff 파일이 필요 | `plan.md`, `state.md`, `log.md` 추가 |

## 3. 벤치마크 반영 강화

- Muvel: 에피소드/플롯/위키/메모, 플롯 캔버스, 반복 표현 지도 → Binder/Right widgets/prototype에 반영.
- Scrivener: Binder/Corkboard/Outliner → Binder + Episode Tabs + future Plot Grid.
- Novelcrafter: Codex source of truth → sample `canon/`, `.gemini/agents` 구조.
- Dabble/Plottr/Campfire: scene metadata 기반 board/grid/canvas는 다음 구현 대상으로 유지.
- Sudowrite: Continue/Expand/Rewrite류는 pipeline/inline command 후보로 남김.

## 4. Stage 3에서 실제 반영한 코드 레벨 개선

1. `npm install`과 `npm run build`를 실제 수행.
2. CodeMirror import 오류 수정.
3. Svelte 접근성 warning 제거.
4. Browser smoke를 Playwright set-content 방식으로 안정화.
5. Tauri static validation script 추가.
6. Python snapshot UTC deprecation warning 제거.
7. Windows installer workflow 추가.

## 5. 다음 리팩토링 권장

1. Tauri command 경로를 프로젝트 root + relative path 방식으로 통일.
2. `read_file/write_file`에 project root authority boundary 추가.
3. `MarkdownPreview`에 HTML sanitize 적용.
4. CodeMirror decorations를 별도 extension 파일로 분리.
5. Repetition analyzer 결과를 CodeMirror line/offset decoration으로 연결.
6. `JobConsole`에 streamed subprocess log를 연결.
7. `candidate/diff/apply`를 Monaco Diff 또는 CodeMirror Merge로 구현.
8. Windows CI에서 실제 `.exe`/NSIS artifact 생성 확인.
