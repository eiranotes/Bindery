# 08. 작업 티켓 (GitHub Issues)

> 형식: Title / Goal / Scope / Implementation Notes / Acceptance Criteria / Tests / Dependencies.
> MVP(Phase 0~5) 기준 34개. 라벨 규칙: `phase:N`, `area:{cli,rust,frontend,editor,qa,pipeline}`, `type:{feat,test,chore}`.

---

## NS-001 · monorepo scaffold 구성
### Goal
pnpm workspace + uv 기반 모노레포 골격 구성.
### Scope
`package.json`, `pnpm-workspace.yaml`, `packages/novelctl-core/pyproject.toml`, `packages/shared-schemas/`, `apps/desktop/`(빈), `scripts/dev.sh`.
### Implementation Notes
- workspace: `apps/*`, `packages/*`. Python은 uv, Node는 pnpm.
- `scripts/gen-types.mjs` 자리만 생성(내용 NS-004).
### Acceptance Criteria
- `pnpm install`·`uv sync` 성공. `pnpm -r list` 워크스페이스 인식.
### Tests
- CI: install 스텝 green.
### Dependencies
- 없음. `phase:0 area:chore type:chore`

---

## NS-002 · novelctl 응답 envelope + 에러 코드
### Goal
GUI가 파싱할 공통 `--json` 응답/에러 계약 확립.
### Scope
`novelctl/contracts/response.py`, `contracts/errors.py`, `shared-schemas/json/app-error.schema.json`.
### Implementation Notes
- envelope: `{ok:bool, command:str, data?, error?}`.
- exit code: 0 ok / 2 usage / 3 domain / 4 gemini-missing.
- `AppError{code,message,recoverable,details?}`.
### Acceptance Criteria
- 성공/실패 모두 동일 envelope로 직렬화. exit code 규약 준수.
### Tests
- pytest `test_envelope.py`.
### Dependencies
- NS-001. `phase:0 area:cli type:feat`

---

## NS-003 · novelctl status --json
### Goal
프로젝트 상태(회차 수, health 요약, pipeline stage)를 JSON으로 반환.
### Scope
`novelctl/cli.py`(status), `novelctl/project.py`(scan).
### Implementation Notes
- `.novelctl/config.yaml` 파싱, story/canon 스캔, index.md `pipeline` 읽기.
- 도메인 로직은 전부 여기(=GUI로 이관 금지).
### Acceptance Criteria
- golden project에서 `novelctl status --json`이 회차/스테이지/health 반환.
### Tests
- pytest `test_status.py`(golden).
### Dependencies
- NS-002. `phase:0 area:cli type:feat`

---

## NS-004 · shared-schemas 타입 생성 파이프라인
### Goal
JSON schema 단일 진실원 → ts/py 타입 자동 생성.
### Scope
`scripts/gen-types.mjs`, `shared-schemas/package.json`(gen 스크립트), 초기 schema 5종 이관.
### Implementation Notes
- json-schema-to-typescript(→ts), datamodel-code-generator(→pydantic).
- `pnpm gen:types` CI 선행.
### Acceptance Criteria
- `pnpm gen:types` 실행 시 `shared-schemas/ts/*.d.ts`·`py/*.py` 생성.
### Tests
- CI: 생성 diff 없음(커밋된 산출물과 일치).
### Dependencies
- NS-001. `phase:0 area:chore type:chore`

---

## NS-005 · 로컬 분석기: repetition
### Goal
회차 반복 표현을 AI 없이 로컬 계산.
### Scope
`analysis/repetition.py`(word/phrase/sentence-ending/description).
### Implementation Notes
- 한글: kiwipiepy optional + regex fallback + stopword.
- frontmatter/code block 제외, distribution buckets(기본 20), judgment(intentional/catchphrase/refrain/review/overused).
### Acceptance Criteria
- `novelctl analyze <ep> --repetition --json`이 term/count/locations/distribution/judgment 반환.
### Tests
- pytest golden(count·조사 처리·distribution).
### Dependencies
- NS-002. `phase:0 area:cli type:feat`

---

## NS-006 · 로컬 분석기: rhythm/density
### Goal
대사/묘사/독백 비율·문단 밀도 로컬 계산.
### Scope
`analysis/rhythm.py`.
### Implementation Notes
- 대사 감지(`“ " 「 『`, 옵션 `- `), scene 있으면 scene별, 없으면 heading/청크 fallback.
- baseline 필드 자리 마련(NS-030에서 채움).
### Acceptance Criteria
- `--rhythm --json`이 ratio·scene별 avgParagraphChars 반환.
### Tests
- pytest golden.
### Dependencies
- NS-002. `phase:0 area:cli type:feat`

---

## NS-007 · 로컬 분석기: mention scan (alias trie)
### Goal
codex alias를 본문에서 스캔, confidence 부여.
### Scope
`analysis/mention.py`.
### Implementation Notes
- alias trie/Aho-Corasick, 조사 결합, min_length, confidence factor(13.4.2), frontmatter/code/quote 제외.
### Acceptance Criteria
- `novelctl mentions <file> --json`이 from/to/confidence/status(safe/review/ambiguous/skip).
### Tests
- pytest golden(조사·짧은 alias·ambiguous).
### Dependencies
- NS-002. `phase:0 area:cli type:feat`

---

## NS-008 · 파이프라인 골격 + mock mode
### Goal
context/draft/summary/qa/revise/commit을 mock으로 실행, candidate만 생성.
### Scope
`pipeline/*.py`, `agents/runner.py`.
### Implementation Notes
- candidate는 `.novelctl/runs/<run-id>/`에만. **원본 파일 미수정**.
- mock: gemini 없이 고정 텍스트.
### Acceptance Criteria
- 각 단계 `--json`이 candidate 경로 반환, 원본 해시 불변.
### Tests
- pytest `test_pipeline_mock.py`(원본 미수정 assert).
### Dependencies
- NS-005, NS-006. `phase:0 area:pipeline type:feat`

---

## NS-009 · manuscript.md + pipeline manifest 규약
### Goal
단일 현재본 + 단계↔경로 매니페스트로 파일명 결합 제거.
### Scope
`project.py`(manifest r/w), `project-template/.../ep001/{index.md,manuscript.md,stages/}`.
### Implementation Notes
- `index.md` frontmatter `pipeline{manuscript,stages,current_stage}`.
- 단계 추가 시 리넘버링 없이 키만 추가.
### Acceptance Criteria
- 새 stage 추가해도 기존 파일명/wikilink 불변. manuscript 포인터 유효.
### Tests
- pytest `test_manifest.py`.
### Dependencies
- NS-003. `phase:0 area:pipeline type:feat`

---

## NS-010 · Tauri + SvelteKit scaffold
### Goal
빈 데스크톱 앱 실행.
### Scope
`apps/desktop/{package.json,svelte.config.js,vite.config.ts,src-tauri/*,tauri.conf.json}`.
### Implementation Notes
- adapter-static, Svelte 5. `lib/api/commands.ts` 빈 래퍼.
### Acceptance Criteria
- `pnpm --filter desktop tauri dev`로 창 뜸.
### Tests
- 수동 smoke.
### Dependencies
- NS-001. `phase:1 area:rust type:feat`

---

## NS-011 · path sandbox (Rust)
### Goal
project root 밖 접근 원천 차단(MVP부터 강제).
### Scope
`src-tauri/src/fs/sandbox.rs`, `error.rs`.
### Implementation Notes
- relative-only, `..`·absolute·root밖 symlink 거부, deny_patterns(.env/.git/.ssh/*.pem/*.key).
### Acceptance Criteria
- absolute/`../`/symlink 요청 시 `PERMISSION_DENIED`.
### Tests
- cargo `sandbox_tests`.
### Dependencies
- NS-010. `phase:1 area:rust type:feat`

---

## NS-012 · open_project / create_project / list_tree
### Goal
프로젝트 열기·생성·트리 스캔.
### Scope
`commands/project.rs`, `lib/api/commands.ts`.
### Implementation Notes
- create는 project-template 복사. 트리 타입 분류(episode/scene/codex/qa/note).
### Acceptance Criteria
- 폴더 열기→`ProjectManifest`, 트리 반환. 신규 생성 시 스캐폴드 존재.
### Tests
- cargo + playwright(open→tree).
### Dependencies
- NS-011. `phase:1 area:rust type:feat`

---

## NS-013 · ProjectLauncher + 최근 프로젝트 + env check
### Goal
런처 UI와 환경(gemini/novelctl/git) 점검.
### Scope
`components/settings/{ProjectLauncher,EnvironmentCheck}.svelte`, `stores/{project,settings}.svelte.ts`, `commands: read/write_app_settings, test_gemini_cli, test_novelctl`.
### Implementation Notes
- 최근 프로젝트 app data persist. env 배지.
### Acceptance Criteria
- 런처에서 열기/생성, 최근목록 유지, env 상태 표시.
### Tests
- playwright(open→env badge).
### Dependencies
- NS-012. `phase:1 area:frontend type:feat`

---

## NS-014 · read_file / write_file (expected_hash, atomic)
### Goal
충돌 감지·원자 쓰기 파일 IO.
### Scope
`commands/files.rs`, `lib/api/commands.ts`.
### Implementation Notes
- sha256, tmp→rename, `expected_hash` 불일치 시 `FILE_CONFLICT`.
### Acceptance Criteria
- 정상 저장 시 새 해시 반환, 해시 불일치 시 충돌 에러.
### Tests
- cargo(conflict), vitest(wrapper).
### Dependencies
- NS-012. `phase:1 area:rust type:feat`

---

## NS-015 · CodeMirror MarkdownEditor 마운트
### Goal
`manuscript.md`를 편집·저장하는 에디터.
### Scope
`components/editor/MarkdownEditor.svelte`, `lib/editor/setup.ts`, `stores/editor.svelte.ts`.
### Implementation Notes
- CM6 doc이 source, store는 dirty/cursor만. 저장 시 현재 doc→write_file.
### Acceptance Criteria
- 열기→편집→저장, dirty 표시/해제.
### Tests
- playwright(편집→저장).
### Dependencies
- NS-014. `phase:2 area:editor type:feat`

---

## NS-016 · frontmatter fold + wiki link highlight + word count
### Goal
소설 편집 필수 데코 3종.
### Scope
`lib/editor/extensions/{frontmatter,wikilink,wordcount}.ts`, `workers/markdownParse.worker.ts`.
### Implementation Notes
- frontmatter range fold, `[[..]]` 하이라이트, 자수는 worker(viewport 무관 전체).
### Acceptance Criteria
- frontmatter 접힘, wikilink 강조, 실시간 자수.
### Tests
- vitest(parse), playwright(word count 갱신).
### Dependencies
- NS-015. `phase:2 area:editor type:feat`

---

## NS-017 · autosave + Split/Preview + snapshot 버튼
### Goal
자동저장·미리보기·수동 스냅샷.
### Scope
`components/editor/{EditorToolbar,PreviewPane}.svelte`, `commands: create_snapshot`.
### Implementation Notes
- 2s debounce, AI 실행 전 강제 저장, markdown-it preview(raw HTML off).
### Acceptance Criteria
- idle 저장, split/preview 전환, snapshot 생성.
### Tests
- playwright(dirty→autosave→clean, snapshot).
### Dependencies
- NS-016. `phase:2 area:editor type:feat`

---

## NS-018 · 한글 IME 안정화
### Goal
조합 중 데코/필터가 입력을 깨지 않게.
### Scope
`lib/editor/ime.ts`, `tests/ime.spec.ts`.
### Implementation Notes
- compositionstart~end 동안 transaction filter/데코 재계산 보류.
### Acceptance Criteria
- macOS 한글 조합 중 커서/글자 깨짐 없음.
### Tests
- playwright(한글 연속 입력).
### Dependencies
- NS-016. `phase:2 area:editor type:test`

---

## NS-019 · watch_project + 외부 변경 충돌 다이얼로그
### Goal
Obsidian 등 외부 편집 감지·충돌 처리.
### Scope
`src-tauri/src/fs/watcher.rs`, `components/editor/ConflictDialog.svelte`.
### Implementation Notes
- notify watcher, self-write 무시(내부 쓰기 마킹), external+dirty→conflict.
### Acceptance Criteria
- 외부 변경 시 clean은 자동 reload, dirty는 [View Diff][Keep Mine][Use External][Save Copy].
### Tests
- cargo(watcher event), playwright(충돌 다이얼로그).
### Dependencies
- NS-014. `phase:3 area:rust type:feat`

---

## NS-020 · run_novelctl job + JobConsole 스트리밍
### Goal
novelctl subprocess 실행·로그 스트림·취소.
### Scope
`src-tauri/src/proc/runner.rs`, `commands/jobs.rs`, `components/jobs/JobConsole.svelte`, `stores/jobs.svelte.ts`.
### Implementation Notes
- spawn, `job:stdout/stderr/completed/failed` emit, `cancel_job`=kill+partial.
- 같은 output file job 동시 실행 잠금.
### Acceptance Criteria
- 콘솔에 실시간 로그, 취소 동작, 실패 시 로그 표시.
### Tests
- cargo(spawn/cancel/stream), playwright(콘솔).
### Dependencies
- NS-012. `phase:3 area:rust type:feat`

---

## NS-021 · EpisodeWorkspace 탭 + 상태기반 Primary CTA
### Goal
회차 작업공간과 단일 CTA.
### Scope
`components/episode/{EpisodeWorkspace,EpisodeTabs,EpisodeToolbar,EpisodeDashboard}.svelte`, `stores/episode.svelte.ts`.
### Implementation Notes
- pipeline manifest로 탭/CTA 결정(context없음→Build Context ... qa fail→Revise ... →Commit).
- 기본 모드는 Draft/QA/Final 3탭.
### Acceptance Criteria
- 스테이지 전이에 따라 CTA 변경, 탭 이동.
### Tests
- playwright(CTA 상태 전이).
### Dependencies
- NS-020, NS-009. `phase:3 area:frontend type:feat`

---

## NS-022 · high-level 파이프라인 command + OutputFileViewer + 입력 패키지 보기
### Goal
버튼으로 파이프라인 실행, candidate·전송파일 확인.
### Scope
`commands: run_episode_{context,draft,summary,qa,revise,commit}, view_prompt_package`, `components/episode/OutputFileViewer.svelte`.
### Implementation Notes
- Rust는 novelctl 경유만. candidate viewer, 전송 파일 목록 미리보기(투명성).
### Acceptance Criteria
- mock draft 실행→viewer 표시, 입력 패키지 목록 노출.
### Tests
- playwright(mock draft→viewer).
### Dependencies
- NS-021, NS-008. `phase:3 area:pipeline type:feat`

---

## NS-023 · commit journal (원자성)
### Goal
다중파일 커밋의 crash-safety.
### Scope
`novelctl/commit_journal.py`, `pipeline/commit.py`, `.novelctl/commits/`.
### Implementation Notes
- before-snapshot→`staged/`→verify(schema/hash)→atomic move→journal done.
- crash 시 재개/롤백. locked fact 미변경 보장.
### Acceptance Criteria
- 커밋 중 강제종료 후 재실행 시 재개 또는 롤백. 부분반영 없음.
### Tests
- pytest(중단복구, locked fact assert).
### Dependencies
- NS-008, NS-009. `phase:3 area:pipeline type:feat`

---

## NS-024 · context/ tier scaffold + ContextPack frontmatter
### Goal
장기기억 tier·토큰예산·source_hash 확립.
### Scope
`project-template/context/*`, `pipeline/context.py`, `shared-schemas/json/context-pack.schema.json`.
### Implementation Notes
- tier(hot-canon/recent-summaries/active-threads/character-states/style), budget, source_hashes, delta_since_last.
### Acceptance Criteria
- `context <ep> --json`이 예산 내 tier pack + source_hashes 생성.
### Tests
- pytest(예산 내 선택, 필수 tier 누락 0).
### Dependencies
- NS-008. `phase:4 area:pipeline type:feat`

---

## NS-025 · context stale 감지 + 예산 강등
### Goal
소스 변경 감지·초과 시 tier 강등.
### Scope
`pipeline/context.py`, `integrity.py`.
### Implementation Notes
- 현재 파일 해시 vs source_hashes, 초과 시 verbatim→요약 강등.
### Acceptance Criteria
- 소스 변경 시 stale=true, 예산 초과 시 저우선 tier 요약화.
### Tests
- pytest(stale, 강등).
### Dependencies
- NS-024. `phase:4 area:pipeline type:feat`

---

## NS-026 · Agent Center (목록/편집/복원/실행/로그)
### Goal
`.gemini/agents/*.md` 관리와 실행.
### Scope
`components/agents/{AgentList,AgentEditor,AgentRunner,CreativityParams}.svelte`, `stores/agent.svelte.ts`, `commands: run_agent`.
### Implementation Notes
- prompt 편집/기본 복원/enable 토글, run+log, creativity→config 저장(GUI 전용 저장 금지).
- agent read/write scope는 novelctl에서 검증.
### Acceptance Criteria
- agent 편집→실행→로그, scope 밖 write 거부.
### Tests
- playwright(편집→실행), pytest(scope 검증).
### Dependencies
- NS-022, NS-020. `phase:4 area:frontend type:feat`

---

## NS-027 · qa-json parse + QADashboard (verdict 우선)
### Goal
QA 결과를 verdict 중심으로 표시.
### Scope
`components/qa/{QADashboard,QAScoreCard,QAIssueList}.svelte`, `stores/qa.svelte.ts`.
### Implementation Notes
- `novelstudio:qa-json` 파싱, verdict 카드(점수 회색 보조), malformed 시 Markdown만.
### Acceptance Criteria
- 대시보드에 verdict/issue 표시, JSON 깨져도 fallback.
### Tests
- vitest(parse/fallback), playwright(대시보드).
### Dependencies
- NS-022. `phase:5 area:qa type:feat`

---

## NS-028 · QA issue jump + diagnostics decoration
### Goal
이슈를 에디터 위치로 연결.
### Scope
`lib/editor/extensions/qaDiagnostics.ts`, `QAIssueList` 연동.
### Implementation Notes
- lineStart/End→CM range, warn/fail/info squiggle + gutter, hover에 메시지/report 열기.
### Acceptance Criteria
- 이슈 클릭→해당 line 스크롤·강조.
### Tests
- playwright(issue→line).
### Dependencies
- NS-027, NS-015. `phase:5 area:editor type:feat`

---

## NS-029 · issue→revision task + 증분 QA + 자동 close
### Goal
QA를 작업 큐로 전환하고 재실행 비용 절감.
### Scope
`pipeline/qa.py`, `pipeline/revise.py`, `components/qa/RevisionPlan.svelte`, `qa/tasks/`, `qa/cache.json`.
### Implementation Notes
- issue→task 파일(state machine), scene input_hash 캐시로 변경 scene만 재QA, 재검출 안 되면 fixed.
### Acceptance Criteria
- 변경 scene만 재QA, 해결 이슈 자동 close, task status 갱신.
### Tests
- pytest(증분·auto close), playwright(task 흐름).
### Dependencies
- NS-027. `phase:5 area:pipeline type:feat`

---

## NS-030 · candidate→diff→hunk apply + pre-apply snapshot
### Goal
AI 수정을 구간 단위로 안전 적용.
### Scope
`components/editor/DiffPane.svelte`, `lib/editor/merge.ts`(CodeMirror Merge), `stores/editor(diffSession)`, `commands: create_snapshot`.
### Implementation Notes
- 좌 현재본/우 candidate, hunk 수락/거부, stale candidate(원본 해시 변경) 차단, 적용 전 자동 snapshot.
### Acceptance Criteria
- revise candidate를 hunk별 수락, 적용 시 snapshot 생성, stale 차단.
### Tests
- playwright(revise→diff→hunk apply→snapshot).
### Dependencies
- NS-029, NS-017. `phase:5 area:editor type:feat`

---

## NS-031 · MVP E2E golden flow
### Goal
전체 MVP 흐름 회귀 테스트.
### Scope
`tests/e2e/mvp_flow.spec.ts`, `packages/project-template`(golden novel).
### Implementation Notes
- open→edit manuscript→context→draft(mock)→qa→task→revise→hunk apply→commit.
### Acceptance Criteria
- 전 흐름 green, 산출물 전부 파일 존재, 원본 무단 변경 0.
### Tests
- playwright 전 흐름.
### Dependencies
- NS-023, NS-026, NS-030. `phase:5 area:test type:test`

---

## NS-032 · integrity_check MVP 규칙
### Goal
장기연재 무결성 조기 감지(핵심 규칙).
### Scope
`novelctl/integrity.py`, `components/snapshots/IntegrityPanel.svelte`, `commands: integrity_check`.
### Implementation Notes
- MVP 규칙: stale summary/QA/context, broken wikilink, commit journal 미완료, locked fact 변경.
### Acceptance Criteria
- 각 규칙 위반 시 verdict/target/fixAction 반환, 패널 표시.
### Tests
- pytest(규칙별 fixture).
### Dependencies
- NS-023, NS-025. `phase:5 area:cli type:feat`

---

## NS-033 · scan_mentions 프론트 연동 + hover preview (MVP 링크)
### Goal
본문 설정명 감지·미리보기(안전 apply는 Phase 7 확장).
### Scope
`commands: scan_mentions`, `lib/editor/extensions/dynamicMention.ts`, `components/codex/MentionPanel.svelte`, `stores/codex.svelte.ts`.
### Implementation Notes
- 명령 실행 시 scan, confidence 실선/점선 데코, hover 카드([열기][삽입][무시]). 자동 대량 링크는 확인 후.
### Acceptance Criteria
- Eira 등 alias 감지·hover, ambiguous 점선.
### Tests
- vitest(데코), playwright(hover).
### Dependencies
- NS-007, NS-015. `phase:5 area:editor type:feat`

---

## NS-034 · 문서화: CLI JSON Contract + 개발 가이드
### Goal
계약·실행법 문서화(온보딩).
### Scope
`docs/cli-json-contract.md`, `README` dev 섹션, `scripts/dev.sh`.
### Implementation Notes
- 모든 `--json` 예시·에러 코드·mock mode·env 설정.
### Acceptance Criteria
- 신규 개발자가 문서만으로 `dev.sh` 실행·mock draft 확인 가능.
### Tests
- 수동 온보딩 체크.
### Dependencies
- NS-008, NS-013. `phase:5 area:chore type:chore`

---

## 티켓 요약(마일스톤 매핑)

| 마일스톤 | 티켓 |
|---|---|
| M0 CLI Contract | NS-001~009 |
| M1 Shell | NS-010~013 |
| M2 Editor | NS-014~018 |
| M3 Episode+Commit | NS-019~023 |
| M4 Context+Agents | NS-024~026 |
| M5 QA+Diff (MVP 완성) | NS-027~034 |

> **첫 2주 스프린트 권장 순서**: NS-001 → 002 → 003 → 010 → 011 → 012 → 014 → 015 → 016 → 017 → 020 → 021 → 022(mock). 이후 스프린트에서 NS-023(commit journal)·NS-024/025(context)·NS-029/030(QA 폐루프·diff) 최우선.
