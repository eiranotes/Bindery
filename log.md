# log.md — 작업 로그

## 2026-07-10 — 초기 프롬프트 재작성 흐름과 우상단 5h·1주 한도

1. 홈의 초기 기획 입력을 실행 후 지우던 흐름을 바꿨다. 사용자 작성 원문을
   `.bindery/initial-planning-prompt.md`에 저장하고, 기획 후보 아래에서 다시 확인·편집하게 했다.
2. 프롬프트를 고친 채 예전 기획안을 채택하는 계보 혼선을 막기 위해 채택 버튼을 잠그고,
   [수정한 프롬프트로 다시 만들기]를 거치도록 했다. 채택된 프롬프트는 세계관·플롯까지 전달된다.
3. 집필 초안 후보 위에 같은 프롬프트 편집면을 추가했다. 수정본으로 다시 쓰면 브리프, 장면 계획,
   초안 후보를 새로 만들며 현재 원고는 그대로 둔다. 재작성 전에는 이전 후보 적용이 잠긴다.
4. agy 상단 표시는 5시간 한 개에서 `5h`와 `1주` 두 값으로 바꿨다. 조회 전에도 두 위치를 유지하고,
   여러 모델 그룹 중 각각 가장 낮은 잔여율을 표시한다.

검증: `npm run check` 0/0, 핵심 테스트 27/27, 전체 테스트 85/85,
`npm run qa:ui-contract` 버튼 178개 무동작 0, production build 성공, DESIGN.md compliance 위반 0.
실브라우저 390/768/1280px에서 이중 한도 표시, 프롬프트 원문 복원, 편집 후 재작성 CTA와 이전
후보 잠금, 수평 overflow 0을 확인했다.

## 2026-07-10 — reference-driven 작업실 UI와 전수 CTA/성능 QA

1. 첨부 `reference-driven-ui-builder` 스킬과 기존 `DESIGN.md`를 결합해 dense analytical workbench를
   주 모드로 확정했다. 생성 시각 타깃과 토큰 delta는 Superloopy evidence에 남겼다.
2. `AppShell.svelte`를 208px 작업 레일/문맥 헤더/작업면으로 재구성하고 진행/설계/프로젝트 그룹,
   간단/설계자 즉시 전환, 로딩/오류 상태, 980px 이하 가로 작업 스트립을 추가했다.
3. Home 외 모든 surface를 dynamic import하고 CodeMirror/Lezer를 manual chunk로 분리했다. 초기 JS
   883.40kB → 234.06kB(73.5% 감소), 모든 청크 205kB 이하, 500kB 경고 제거.
4. 홈을 다음 행동 + 프로젝트 상태 원장 2열로, 시작 화면을 제품 맥락/최근 작품/새 작품 3영역으로
   개편했다. 포커스, control height, reduced-motion도 전역 토큰으로 고정했다.
5. `scripts/audit-ui-contract.mjs`/`npm run qa:ui-contract` 추가: 22 Svelte 파일, 버튼 175개,
   onclick 174, submit 1, 무동작 0.
6. dev 클릭스루: 13개 화면, 현재 노출 CTA 86개, 이름 없는 버튼 0, 콘솔 오류 0.
   390/768/1280px 전체 화면 overflow 0.
7. agy 재검증: 직접 호출 exit 0(8.46초, 지정 JSON), Bindery [연결 테스트] exit 0
   (7.525초, BINDERY-OK).
8. 최종 standalone을 재빌드·설치하고 실제 앱에서 시작 화면 → 로컬 프로젝트 → 홈 → 설정을
   클릭스루했다. 설치 앱 agy 연결도 exit 0(9.394초, BINDERY-OK)으로 통과했다.
9. 설치 앱에서 Medallion 열기 중 프리즈를 재현하고 sample로 Tauri 메인 스레드의 동기 파일 open을
   특정했다. `fs_op`/`scaffold`를 async `spawn_blocking`으로 격리해 같은 지연에서도 UI가 반응하고
   15초 뒤 시작 화면으로 복귀하도록 했다.

검증 중간값: `npm run check` 0/0, `npm test` 73/73, `npm run build` OK(대형 청크 경고 제거),
Rust test 3/3, standalone build/설치/codesign/실앱 클릭스루 OK, DESIGN.md compliance 위반 0.
상세는 `docs/UI_CTA_PERFORMANCE_REVIEW_20260710.md`.

## 2026-07-10 — 생성 지연 축소와 전체 파이프라인 제품화 보강

1. **후보 1개**: 간단 모드의 기획/집필 기본 후보를 `집필안` 1개로 축소했다. 한 회차에서
   같은 긴 프롬프트를 3번 실행하던 비용·대기를 없앴고 설계자 모드의 수동 후보 수 조절은 유지했다.
2. **병렬 QA와 안전한 기록**: 문체/연속성/정사 QA를 병렬 실행하고 run index/usage 원장 저장만
   큐로 직렬화했다. 병렬 3건이 모두 남는 회귀 테스트와 동시성 3 관측을 추가했다.
3. **패키지 스트리밍**: Tauri에 비동기 `run_agent_stream` + `Channel<Value>`을 추가했다.
   stdout/stderr pipe를 별도 thread로 동시에 비우고 status/stdout/stderr/done event를 내보낸다.
   다중 실행 패널, 실제 경과 시간, 전체 취소, 프로젝트별 실행 key를 함께 반영했다.
4. **실 AI**: 테스트 실행기는 `agy`, 모델은 `gemini-3.5-flash`를 사용했다. 아이디어 blueprint에
   `count=1`을 넣어 13.7초에 정확히 한 후보를 받았고 status 1/stdout 6/done 1을 확인했다.
   Codex 프리셋에는 비-Git 작품 폴더용 `--skip-git-repo-check`를 추가했다.
5. **ZIP과 기획 연결**: 읽기 진행률/취소/이벤트 루프 양보, 압축·엔트리·해제 총량·전체 원문
   안전 한도를 추가했다. canon/world/plot 구조가 있는 ZIP은 역할을 인식해 snapshot을 남기고
   설정 바이블·인물/세계관·플롯·resume 문서로 가져온 뒤 플롯 준비에 연결한다.
6. **프로젝트 열기**: Tauri 네이티브 폴더 선택, 최근 프로젝트 삭제, 일반 폴더 확인,
   stale timeout 결과 무시, 새로고침 오류 재시도 배너, 비어 있지 않은 폴더 scaffold 거부를 추가했다.
7. **UI 정리**: 실행 패널/ZIP 진행 카드/구조화 패키지 카드/열기 오류 배너를 추가하고 이번에
   수정한 화면들의 여백을 DESIGN.md 4px 스케일에 맞췄다.

검증: `npm run check` 0 errors/0 warnings, `npm test` 73/73, Rust stream/PATH test 2/2,
`npm run build` OK(기존 500KB chunk warning), standalone app build + ad-hoc codesign strict verify OK,
새 앱 launch process 확인. 앱 내 브라우저 대상이 없고 Mac이 잠겨 신규 시각 캡처는 미완료로 기록했다.

## 2026-07-07 — 프로젝트 열기 성능 패치와 standalone 재빌드

증상: 빌드된 `Bindery.app`에서 프로젝트를 여는 동안 전체 파일 해시 계산과 홈 workflow 계산이 겹쳐
작은 `~/Documents/Bindery/*` 작품도 첫 접근 시 수 초 이상 멈춘 것처럼 보였다. 저장소 루트를 작품으로
열면 `src-tauri/target` 빌드 산출물까지 tree walk 대상이 되어 비용이 더 커질 수 있었다.

조치:
1. `openProjectByPath`/`createProjectAt`는 프로젝트 메타·설정을 먼저 set하고 즉시 홈 셸로 진입한다.
   초기 `refreshAll`은 후행 작업으로 실행한다.
2. `refreshAll({ deferDigest: true })`를 추가해 UI 데이터 로딩과 외부 변경 감지 digest 기준선 계산을
   분리했다. 포커스 복귀 새로고침은 기존처럼 digest 비교를 수행한다.
3. `listIdeas`/`listEpisodes`가 이미 읽은 tree를 재사용하게 해 초기 refresh의 중복 tree walk를 줄였다.
4. `loadProjectFileDigest`는 파일-provider/TCC 지연을 줄이기 위해 한 번에 4개 파일만 읽는다.
5. Rust Tauri walker와 Vite dev bridge walker가 `target`, `dist`, `build`, `.superloopy`, `.svelte-kit`,
   `.bindery` 변동성 출력, `exports`를 제외한다. `projectChanges` 필터도 같은 빌드 산출물 경로를 추적하지 않는다.

검증: projectChanges 3/3, `npm run check` 0 오류, `cargo check` OK, `npm test` 67/67,
`npm run tauri:build:mac:standalone` OK, `codesign --verify --deep --strict` OK, 새 standalone 앱 launch
process 확인 후 종료.

## 2026-07-05 — AI 장기 집필 하네스 신규 구축 세션

1. **레거시 감사**: HermesWorkspace/project/Bindery 코드·문서·파이프라인 정밀 감사
   → docs/research/current_structure_audit.md. 초기에 레거시 확장 방향으로 착수했다가
   사용자 지시로 방향 전환(작업 트리 신규 구축, UI 신규). 레거시에 넣었던 수정은 전량 원복.
2. **조사**: 펜시브(pensiv.so) 웹 재조사 → docs/research/pensiv_ui_benchmark.md.
   Open Design MCP로 와이어프레임 생성(bindery-harness-ui).
3. **스캐폴드**: Vite+Svelte5+TS, git init, dev 브리지(server/bridge.ts: fs 앵커·경로 탈출 거부·
   CLI spawn·trace 저장·timeout), memory 브리지.
4. **코어**: layout/text/diff/blueprint 유틸 → 프롬프트 blueprint 초기 16종(현재 18종) → contracts 검증기 →
   runner(단일 경로) → artifacts/snapshots/proposals → ideas/world/bible/plot/episode/closeout/
   exchange 서비스. 커밋 `00e17c6`.
5. **검증 우선**: UI 전에 지시서 §11 전체 루프를 vitest E2E로 작성해 통과시킴 (12/12).
6. **UI**: 셸(상단 탭/좌측 탐색/우측 인스펙터/하단 run 도크) + 8개 작업면 + DiffView.
   svelte-check 0 오류, 빌드 OK. 커밋 (feat(ui)).
7. **정리**: JSON Schema 흡수(7)+신규(3), 세계관 웹 교환 왕복 추가, proposal 타입 내로잉 수정,
   CanonSurface 일괄 결정 stale 버그 수정.
8. **실검증**: dev 서버 기동, 브리지 curl 왕복, claude CLI 실행(BINDERY-OK), 실제 소재 발굴
   1회(blueprint→CLI→스키마 통과). codex는 머신 인증 만료 확인.
9. **문서**: architecture/workflows(정적·AI)/prompt overview/roadmap/acceptance_criteria/
   decisions(D1~D12)/README/state/log.

검증 명령: `npm test` · `npm run check` · `npm run build` · dev 브리지 curl · claude CLI 스모크.

## 2026-07-05 — Phase 1/패키징 후속 진행

1. **UI 재정렬**: 우측 고정 인스펙터 제거. AppShell을 좌측 구조 탐색 + 중앙 작업면 2단 구조로 변경.
   최하단 1줄 상태바 추가(실행 stage/stdout tail/취소, 제안 수, 최근 스냅샷, 실행기 상태) 및 설정 토글 추가.
2. **실행 스트리밍/취소**: dev bridge에 `/__bridge/agent-stream` SSE와 `/__bridge/agent/cancel` 추가.
   `runStage` live event와 상태바를 연결.
3. **계획 승인 게이트**: 브리프/장면 계획 `bindery:json`에 `bindery_approval.status` 저장.
   장면 계획은 승인된 브리프 뒤에만, 초안 후보는 승인된 브리프+승인된 장면 계획 뒤에만 생성.
4. **스냅샷/에디터**: 파일 화면에 최근 스냅샷 복원 UI 추가. 파일 화면과 회차 원고 직접 수정에 CodeMirror Markdown 에디터 적용.
5. **웹 AI 교환 확대**: plot-plan, episode-brief, scene-plan, draft-candidate, canon-delta export/import UI 추가.
   가져온 JSON은 기존 contracts 파서 통과 후 정식 파일/후보/proposal로 등록.
6. **Tauri 패키징**: `src-tauri` 추가, `tauriBridge`와 Rust command(fs/scaffold/run_agent/cancel_agent/env) 구현.
   macOS `Bindery.app` 번들 생성 확인.

검증 명령: `npm run check` · `npm test` · `npm run build` · `(cd src-tauri && cargo check)` ·
`npm run tauri:build -- --bundles app`.

## 2026-07-05 — UX-first autopilot 개편 세션 (2차)

근거 문서: bindery_ux_autopilot_pipeline_plan.md / bindery_ux_autopilot_dev_prompt.txt.
Open Design MCP로 신규 셸 와이어프레임(bindery-harness-ui/autopilot-shell.html, S1~S5) 작성 후 구현.

1. **기초자료 로더**: src/lib/harness/context.ts 신설 — 바이블·스타일·재개상태·열린 떡밥·
   플롯 row·이전 회차 요약·이전 화 끝부분을 단일 조립, 빈 자료는 missing으로 보고.
   draft_candidate 프롬프트에 이전 요약/이전 화 끝부분/열린 떡밥, episode_brief에 열린 떡밥 추가.
2. **workflow/autopilot**: workflow.ts(상태→다음 행동), autopilot.ts(runProjectStarterAutopilot·
   runEpisodeAutopilot·runRevisionAutopilot·runCloseEpisodeAutopilot + hard commit 함수).
   브리프/장면 계획은 soft output으로 autopilot 자동 승인(approvedBy: 'autopilot'),
   원고 반영·canon 변경·픽스는 사람 버튼 전용 유지.
3. **UI 셸 2단화**: Sidebar 제거, AppShell을 상단바+단일 작업면으로. 설정에 화면 모드
   (간단/설계자) 추가 — 간단: 홈|집필|작품노트|보류함|파일|설정, 설계자: +소재/세계관/플롯/
   회차/제안·정사+run 도크. HomeSurface(다음 작업 센터+기획 후보 카드), WriteSurface(진행 레일+
   상황별 단일 블록+후보 카드+수정 체크리스트+마감 카드+생성 근거 보기), NotesSurface,
   PendingSurface, LiveRunPanel 신설. StatusBar는 간단 모드에서 내부 용어 숨김(stageLabel).
4. **스트리밍**: runFeed 스토어에 SSE stdout/stderr 원문 누적, LiveRunPanel이 실행 전체
   흐름(스테이지 경계 포함)을 실시간 표시. 실 CLI(gemini-3.5-flash)로 설계→장면→후보 3개
   생성 전 과정 스트리밍 클릭스루 확인.
5. **테스트/문서**: tests/autopilot.test.ts 5건 추가(17/17). docs/ux/autopilot_pipeline_redesign.md,
   docs/ux/simple_mode_user_flow.md, docs/implementation/workflow_autopilot_plan.md 신설,
   ui_direction/roadmap/decisions(D16~D21) 갱신.

검증: npm run check 0오류 · npm test 17/17 · npm run build OK · dev 서버 실 CLI 클릭스루.

## 2026-07-05 — 바이블→플롯→회차 근거 체인 보강

실제 프로젝트(`/Users/tofu/Documents/Bindery/ㅏㅏ`) 점검 중 `world-expansion`과 `plot-plan`은
성공했지만 `bible-assembly`가 `source=fallback / 출력 스키마 검증 실패`로 남아
`canon/setting-bible.md`가 템플릿 상태였음을 확인. 그 결과 ep001은 바이블보다 플롯 row에
의존해 진행되어 작품노트/바이블/집필의 인과가 사용자에게 불명확했다.

조치:
1. `bible.ts`가 AI 출력의 ```markdown 코드펜스를 벗겨 정상 바이블로 파싱하도록 수정.
2. AI 바이블 조립 실패 시에도 승인 자산 파일에서 이름·기능·종류·경로를 추출한 로컬 바이블을 만들고,
   `adoptStarterIdea`가 이를 `canon/setting-bible.md`에 적용한 뒤 플롯을 생성하도록 수정.
3. 홈 채택 완료 토스트를 `세계관 자산 → AI/로컬 바이블 → 플롯 초안` 순서로 표시.
4. `tests/autopilot.test.ts`에 코드펜스 바이블 적용 및 fallback 바이블→플롯 입력 회귀 테스트 추가.

검증: `npm run check` 0오류 · `npm test` 19/19 · `npm run build` OK.

## 2026-07-05 — 라이트모드 바이블·플롯 준비 게이트

사용자 피드백: 작품노트는 생겼지만 라이트모드에서 바이블이 비어 있는 상태로 ep001을 쓰면,
작품노트/바이블 흐름이 아니라 다른 내용으로 보인다.

조치:
1. `workflow.ts`에 `prepareStoryFoundation` 액션을 추가. 실질 바이블이 없거나 현재 회차
   plot row가 없으면 홈 CTA가 집필보다 준비를 먼저 요구한다.
2. `autopilot.ts`에 `ensureStoryFoundation`을 추가. 명시 버튼에서 바이블 후보를 적용하고,
   그 바이블을 입력으로 플롯을 만들거나 갱신한다.
3. `runEpisodeAutopilot`이 바이블/현재 회차 플롯 누락 시 후보 생성을 거부하도록 변경.
4. `WriteSurface` 진행 레일에 `기준` 단계를 추가하고, 라이트모드 집필 화면에도
   [바이블과 플롯 준비하고 쓰기] 블록을 노출. 준비 후에는 설계부터 다시 실행해 낡은 후보를
   그대로 적용하는 흐름을 피한다.
5. `tests/autopilot.test.ts`에 준비 CTA, 바이블만 있는 경우 플롯 준비, 준비 후 집필 진행
   회귀 테스트를 추가.

검증: `npm test -- tests/autopilot.test.ts` 9/9 · `npm run check` 0오류 · `npm test` 21/21.

## 2026-07-05 — ㅏㅏ 프로젝트 프롬프트 주입 원문 문서화

요청: `ㅏㅏ` 프로젝트를 예시로 전체 파이프라인에서 단계별 프롬프트가 어떻게 주입되고,
결과 산출물이 어떻게 남는지 요약 없이 정리. 빌드는 제외하고 로직·문서만 압축.

조치:
1. 실제 프로젝트 `/Users/tofu/Documents/Bindery/ㅏㅏ`의 `.bindery/runs`, `.bindery/trace`,
   artifacts/candidates/proposals와 현재 기준 파일을 읽어
   `docs/implementation/aa_project_full_pipeline_prompt_walkthrough_20260705.md` 생성.
2. 문서에는 run 순서, 실패/repair/fallback 지점, 실제 주입 프롬프트 원문, 실제 결과 파일 원문을
   `details` 블록으로 전체 포함.
3. 기존 workflow 문서의 `prepareStoryFoundation` 설명을 현재 로직(원고 유무와 무관하게 기준 누락 시
   먼저 준비)으로 정정.

검증: 문서 생성 확인(`13,578` lines, 약 `996KB`) ·
`bindery_logic_docs_no_build_20260705_2215.zip` 생성(`147` files, 약 `512KB`) ·
`unzip -t` OK · build 산출물 제외 목록 확인. 빌드 미실행.

## 2026-07-06 — 컨셉 정의서 반영: Context Pack 투명성·QA 요약·프리플라이트·되돌리기 + 에디토리얼 정리

기준 문서: bindery_ai_harness_concept_direction.md (2026-07-06). 내부 엔진은 그대로 두고
"산출물 먼저, 기계장치는 근거 계층으로"라는 컨셉 §6을 Lite 표면에 채웠다.

조치:
1. `context.ts`의 `loadEpisodeContext`가 `sources: ContextSource[]`를 함께 반환 —
   각 기초자료의 투입 여부(투입/비어 있음)와 투입 방식(요약만·끝부분 2,000자만·이번 화 row만)
   을 사용자 표시용으로 기록. 집필 화면 후보 블록 아래 한 줄 요약
   ("참고: … / 비어 있어 추정: …")과 "생성 근거 보기" 상단의 자료 목록(칩+경로)으로 노출 (§6.2, §7.3).
2. 검토 결과 블록에 QA 3관점(설정·연속성·문체) overall verdict 칩(통과/주의/수정 필요)을
   수정 체크리스트 위에 요약 (§4.4 block/warn/pass).
3. 시작 블록에 soft-gap 프리플라이트 라인 추가 — 비어 있는 자료(스타일 지침·이전 요약 등)를
   실행 전에 알리고 [작품노트에서 채우기]와 "그대로 진행하면 AI가 추정" 중 선택하게 함 (§6.4).
   hard gate(바이블·이번 화 플롯)는 기존 준비 CTA 유지.
4. 원고 화면에 [이전본 복원] 추가 — 원고 대상 최신 스냅샷으로 1클릭 되돌리기,
   복원 전 상태도 스냅샷으로 남김 (§6.5).
5. 에디토리얼 정리: 초안 후보와 홈 기획 후보를 좁은 세로 카드(auto-fit minmax) 대신
   전폭 행 리스트로 전환 — 긴 요약이 세로로 늘어지지 않고 줄 단위 비교 가능. 원고 리더/에디터
   높이를 min(66vh,720px)로 키워 원고가 화면 중심이 되게 함. 홈 타이포 스케일 소폭 상향.
6. 시작 화면 결함 수정: 폴더 열기와 새 작품 생성이 `working` 상태를 공유해 열기 중에
   "작품 폴더 만들기"가 "생성 중..."으로 바뀌던 버그 분리, 열기 15초 타임아웃 +
   원인 안내(권한) 토스트 추가, 최근 목록 긴 경로 ellipsis.

발견(환경): 프리뷰 하니스가 띄운 dev 서버 프로세스는 macOS TCC로 `~/Documents` 열람이
차단되어 `/__bridge/fs list`가 무기한 매달렸다(`exists`는 통과). 앱 문제가 아니라 프로세스
권한 문제 — 사용자 터미널에서 띄우면 정상. 6번 타임아웃이 이 경우를 사용자에게 설명한다.

검증: `npm run check` 0오류 · `npm test` 21/21 · `npm run build` OK ·
dev 서버 클릭스루(ㅏㅏ 사본): 홈 CTA→집필 후보 3개 행 레이아웃/참고·제외 요약/근거 자료 목록/
ep001 픽스 원고 리더, 라이트·다크, 1280/375 폭 스크린샷 확인.

## 2026-07-06 — 토큰 라우터: 로컬 정적 선별 → AI 정제 → 집필 + 저/중/고 티어 라우팅

기준 문서: bindery_ai_harness_final_lite_detail_design.md (§5 인덱싱, §6 Context Pack Builder,
§7.5 Preflight, 15.4 모드). 문제: 브리프/초안 프롬프트가 바이블 통짜 clip(6,000자) + 전 자료를
주입해 1화 사전 토큰이 크고, 초안 후보 3회 반복으로 배수 소비됐다.

조치:
1. **로컬 정적 선별 계층** `src/lib/harness/contextPack.ts` (AI 미사용, 결정적):
   - 섹션 인덱스: 바이블·characters/·world/·relationships/·열린 떡밥을 heading 단위로 분할.
   - 관계 근사 + 멘션 스코어: 이번 화 플롯 row·직전 요약·작가 메모에서 질의어를 뽑아
     문서 제목 멘션(강한 가중치)과 본문 일치로 섹션 점수화. 바이블 첫 섹션은 앵커로 기본 포함.
   - 문자 예산 pruning(`contextBudgetChars`, 기본 6,000자) + included/excluded manifest
     (선정·제외 사유, 문자 수, 점수) — 설계안의 source manifest/Prompt Audit에 해당.
2. **AI 정제(distill) 스테이지**: 선별 팩이 `distillThresholdChars`(기본 3,000자)를 넘으면
   `context-distill` 스테이지(신규 blueprint `prompts/context_distill.prompt.md`)가 집필용
   캡슐로 압축. 창작 금지·고유명사 보존 계약, 실패 시 로컬 팩 그대로(정직한 폴백).
   결과·manifest는 `.bindery/artifacts/<ep>/context-{capsule.md,pack.json}`에 남는다.
3. **주입 교체**: `generateBrief`는 로컬 선별 팩을, `generateDraftCandidates`는 정제 캡슐을
   기존 `{{bible}}` 슬롯에 주입 (프롬프트 라벨을 "설정 컨텍스트(선별·정제됨)"로 갱신).
   초안 3후보 반복에 그대로 배수 절감.
4. **저/중/고 모델 티어 라우팅**: `HarnessSettings`에 `profiles{light,heavy}`(별도 CLI/모델/
   타임아웃, 비활성 시 기본 실행기 폴백)와 `stageTiers`(기획·설계/정제/집필/검수/요약·기억
   5그룹 → 티어 배정, 기본: 집필=고급·정제/요약=경량) 추가. `Ctx.agentFor(stage)`를 러너가
   매 스테이지 직전에 조회해 실행기를 바꾼다. run 기록의 command/model도 실제 사용값.
5. **설정 UI**: 「모델 라우팅」(경량/고급 티어 카드 + 프리셋/명령/모델/타임아웃 + 티어별
   연결 테스트), 「파이프라인별 티어 배정」(그룹 5행, 해석된 실행기 mono 표시),
   「컨텍스트 예산」(선별 예산·정제 기준). 여러 CLI(codex/claude/gemini/직접)를 티어별로 연결.
6. **근거 보기 확장**: 집필 화면 "생성 근거 보기" 최상단에 컨텍스트 팩 요약
   (선별 N·제외 N·사용자수/예산·정제 압축률) + 포함 목록(사유) + 제외 목록(접힘, 사유).

검증: `npm run check` 0오류 · `npm test` 28/28 (신규 tests/contextpack.test.ts 7건:
섹션 분할/질의어, 관련 선별·무관 제외·사유, 예산 pruning, 오프라인 skip, 정제 캡슐+티어 호출,
스테이지→그룹 매핑, 프로필 활성/폴백) · `npm run build` OK ·
dev 클릭스루: 설정 모델 라우팅/티어 폼/배정 UI, ep002 근거 보기의 팩 manifest 렌더 확인.

미구현(설계안 대비, 다음 후보): SQLite FTS/벡터 인덱스(현재 키워드 스코어링으로 대체),
branch/lineage 거버넌스, Detail 그래프 스튜디오. 현 구조는 contextPack.ts의 스코어러를
교체하는 것만으로 업그레이드 가능하게 분리돼 있다.

## 2026-07-07 — 문체 재현: 한/일 원문 분석 → 프리셋 → 장면별 집필 주입 (신규 「문체」 탭)

레거시(project/Bindery)의 style_system에서 핵심 아이디어를 준용했다: 장면 후보 분할과
유형 분류(로컬 결정적), 전역 규칙 + 장면 유형별 오버레이의 2층 구조, content term
누출 방지(원문 고유명사 복제 금지), 짧은 인용 fewshot(형태 참고용). 규칙 기반 풀스택
(라우터/스택 병합/스코어러/SQLite)은 신 하네스 방식으로 대체했다:
로컬 분해 → AI 종합 분석 1회 → 프리셋 파일 진실 → 집필 시 장면 매칭 캡슐 주입.

흐름: 한/일 텍스트 입력 → 장면별 분해(로컬: 구분선·헤딩·soft max, 최대 10장면 균등
샘플링, 대화율·마커 기반 유형 분류) → `style-analysis` 스테이지가 한국어 문체 프로필
JSON 종합(전역 분위기·전역 규칙·장면 유형별 특징+인용·대화 처리·금지·content_terms)
→ 프리셋 저장 → 적용 시 style-guide.md 렌더(스냅샷 선행) → 집필 시 전역 분위기 +
이번 화 장면 계획을 유형 매칭해 필요한 오버레이만 캡슐로 주입 → 한국어 아웃풋.

조치:
1. `src/lib/harness/styleTransfer.ts` — 언어 감지(한/일), 장면 분해/분류,
   조사 스트리핑 고유명사 추출(복제 금지 시드), AI 분석(`prompts/style_analysis.prompt.md`,
   오프라인 시 로컬 통계 뼈대 폴백), 프리셋 저장/적용/해제/삭제
   (`style/presets/*.json` + index, 적용은 style-guide.md 덮어쓰기 전 스냅샷),
   이력(`style/history.json`, 분석/저장/적용/해제/삭제 100건),
   `buildStyleCapsule(episode, scenePlan)` — 장면 계획을 유형으로 근사 매칭해
   이번 화에 나오는 유형의 오버레이만 골라 ≤2,400자 캡슐 생성,
   `.bindery/artifacts/<ep>/style-capsule.md`로 감사 기록.
2. 집필 주입: `generateDraftCandidates`와 `generateRevisionCandidate`의 `{{styleGuide}}`
   슬롯이 활성 프리셋 캡슐을 우선 사용(없으면 기존 style-guide.md). 수정 후보도 같은
   라우팅을 타서 수정 과정에서 결이 흔들리지 않는다.
3. UI: 「문체」 탭 신설(간단/설계자 모드 공통, 작품노트 옆). 적용 상태 카드(적용 해제),
   원문 입력(붙여넣기 + .txt/.md 파일, 언어·글자수 표시) → LiveRunPanel 스트리밍 →
   분석 결과(전역 요약/규칙/대화 처리/금지 2단 + 장면 유형별 특징 행 + 복제 금지 목록)
   → 이름 지정 프리셋 저장. 프리셋 행 리스트(적용/삭제/상세 펼침), 이력 행 리스트.
   집필 화면 후보 근거 라인에 "문체: <프리셋명> (장면별 자동 적용)" 표시.
4. `style-analysis` 스테이지는 티어 라우팅에서 기획·설계 그룹으로 실행된다.

검증: `npm run check` 0오류 · `npm test` 41/41 (신규 tests/styleTransfer.test.ts 9건:
언어 감지, 장면 분해/분류, 조사 스트리핑 추출, 오프라인 뼈대+이력, AI 프로필 저장→
style-guide 렌더→이력 순서, 해제/삭제, 장면 매칭, 비활성 null 폴백, 캡슐 선별 주입+감사
기록) · `npm run build` OK · dev 실 CLI(gemini-3.5-flash) 클릭스루: 한국어 샘플 499자
분석 → 전역 규칙 6·대화 4·금지 4·장면 특징 추출 → 「축축한 서점 미니멀」 저장·적용 →
style-guide.md/presets/history.json 파일 확인.

## 2026-07-07 — 제품화 냉정 점검 문서

- `docs/PRODUCT_READINESS_REVIEW_20260707.md` 작성. 코드 사실 확인 후 작성:
  결제/토큰비용/updater/telemetry 의존성·코드 0, 원고 내보내기(합본/EPUB/docx) 부재,
  RunRecord에 char는 있으나 토큰·요금 환산/표시 없음, macOS ad-hoc 서명만.
- 구성: 수익화 공백(BYOK vs 관리형, 비용 가시성 0), 기능 미비(내보내기·온보딩·편집 깊이·
  대규모 미검증·백업), 제품 일관성(모드 개념 누수·용어·i18n), 기술 성숙도(업데이트·서명·
  품질 회귀 부재), 경쟁 분석(Novelcrafter/Sudowrite/Scrivener/챗봇 직접), P0~P2 로드맵.
- 결론: 엔진은 경쟁력 있으나 제품은 프로토타입. P0 3종(비용 가시성·완성물 내보내기·
  CLI 온보딩)으로 최소 완결 루프부터 닫아야 한다.

## 2026-07-07 — 제품화 P0 반영: 비용 가시성 · 완성물 내보내기 · CLI 온보딩

점검 문서(PRODUCT_READINESS_REVIEW)의 P0 3종을 구현했다.

### P0-1 비용 가시성 (`src/lib/harness/usage.ts`)
- 글자 수 기반 토큰 추정(CJK 1.35·기타 0.28 토큰/자), 모델별 단가 테이블(기본값 제공,
  설정에서 편집), 요금은 표시 시점에 단가로 곱해 소급 반영(원장은 토큰만 저장).
- `.bindery/usage.json` 원장에 실행마다 append(러너 persistRun 훅). run 인덱스는 200개만
  유지하므로 월 누적은 원장이 담당.
- `summarizeUsage`: 이번 달/전체/회차별/월별 집계 + 예산 비율. fallback·오프라인은 $0.
- UI: 상단바 게이지("이번 달 ~$1.58/$5.00", 80%↑ 경고색, 100%↑ 위험색), 설정에
  대시보드(이번 달/누적 카드 + 예산 바) · 월 예산 입력 · 회차/월별 표 · 단가 편집 표.
  집필 실행 전 예산 초과 시 경고 토스트(차단은 안 함).

### P0-2 완성물 내보내기 (`src/lib/harness/exportManuscript.ts` + 신규 「내보내기」 탭)
- 회차 원고 수집(원고 없는 회차 제외, 픽스분만 옵션) → Markdown 합본 / 플레인 TXT /
  EPUB2. 합본·TXT는 `exports/`에 저장 + 브라우저 다운로드, EPUB은 브라우저 다운로드.
  이후 DOCX 다운로드까지 확장됨.
- EPUB은 외부 의존성 없이 store(무압축) zip + CRC32를 직접 구현. 실제 `unzip -t`로
  6개 엔트리 CRC 검증 통과(mimetype 첫 엔트리·무압축, container/opf/ncx/xhtml).
- 회차별 "본문 복사"(클립보드) — 연재 플랫폼 붙여넣기용, 마크다운 기호 제거.

### P0-3 CLI 온보딩 + 실패 인과 (`SettingsSurface`, `WriteSurface`)
- 설정 상단에 연결 상태 배너 4단계(없음/미확인/연결됨/실패). 미연결·실패 시 설치·로그인·
  테스트 3단계 가이드와 "연결 전엔 로컬 뼈대로만 돌아 결과가 성의 없어 보인다" 경고.
- 연결 테스트 실패 모드를 원인 후보로 번역(spawn-error→미설치/경로, timeout→로그인/느림).
- 집필 후보가 전부 fallback이면 후보 위에 "AI 아님 — 로컬 뼈대" 붉은 배너 + 설정 링크로
  원인과 결과를 직접 연결.

검증: `npm run check` 0오류 · `npm test` 55/55 (신규 usage 6 + export 8) · `npm run build` OK ·
실제 EPUB unzip CRC 검증 · dev 클릭스루(내보내기 3형식/회차복사, 설정 사용량 대시보드·게이지·
예산 바·단가표·온보딩 배너 시드 데이터로 확인).

미반영(P1 이후, 문서에 남김): 자동 업데이트·공증/배포, 네이티브 수준 다파일 트랜잭션,
실제 AI 출력 품질 골든셋, 네이티브 파일 watch, 벡터 RAG. 관리형 수익화(크레딧·미터링·정산)는 별도 백엔드.

## 2026-07-07 — gemini 프리셋(agy/-model) · /usage 실제 사용량 · P1(백업·포커스 새로고침)

### 요청 반영
- Gemini 프리셋 기본값을 이 머신 실환경에 맞춤: command `gemini`→`agy`, 모델 플래그 `-m`→`-model`
  (`agentSettings.ts` PROVIDER_PRESETS). 라벨도 "Gemini CLI (agy)".
- 실제 사용량 조회 `usage.ts::fetchProviderUsage` — 기본 실행기로 `/usage`를 돌려 결과 원문을
  `.bindery/provider-usage.json`에 저장·표시. 설정 사용량 섹션에 [/usage 불러오기] 버튼 + raw 패널
  (실행기·시각 표시). 형식이 실행기마다 달라 파싱하지 않고 raw로 보여준다.
  주의: agy는 대화형 슬래시 명령이라 `-p "/usage"` 비대화 호출에서는 실제 수치 대신 도움말을
  반환할 수 있다 — 받은 응답을 그대로(정직하게) 표시한다. 실행기가 비대화 /usage를 지원하면
  실수치가 그대로 들어온다.

### P1 이어서
- 프로젝트 백업 `backup.ts::buildProjectBackup` — 진실 텍스트 파일(원고·설정·바이블·프리셋·
  usage 등) 전체를 store-zip으로 묶어 다운로드. 재생성 캐시(runs/trace/candidates/snapshots/
  exchange)는 제외. 「내보내기」 탭에 [전체 백업 (.zip)]. zipStore를 export로 공유.
- 파일 watch 대체: 창 포커스 시 자동 새로고침(App.svelte) — 파인더/외부 에디터 편집 후 상태
  어긋남 방지, 1.5초 디바운스, 실행 중이면 스킵.

검증: `npm run check` 0오류 · `npm test` 57/57 (신규 backup 2) · `npm run build` OK ·
백업 zip 실제 `unzip -t` 중첩 경로/한글 통과 · dev 실 CLI(agy) 클릭스루: gemini 프리셋 agy 반영,
/usage 실행·응답 원문 표시, 백업 다운로드.

## 2026-07-07 — readiness 잔여 반영: DOCX · 백업 복원 · 품질 게이트

기준: `docs/PRODUCT_READINESS_REVIEW_20260707.md`의 남은 제품화 항목을 현재 구현 기준으로
재점검하고, 로컬에서 닫을 수 있는 부분을 추가 반영했다.

### 완성물 내보내기 확장
- `exportManuscript.ts::buildDocx` 추가. 최소 유효 Office Open XML 패키지를 store-zip으로 만들고,
  제목/저자/회차 헤딩/본문을 XML escape해 담는다.
- 「내보내기」 탭에 [Word 문서 (.docx)] 버튼 추가. EPUB과 동일하게 바이너리 브리지 없이
  Blob 다운로드로만 내보낸다.

### 프로젝트 백업 복원
- `backup.ts::readProjectBackup` / `restoreProjectBackup` 추가. Bindery 백업 zip의 store 엔트리 중
  안전한 텍스트 파일만 현재 프로젝트에 덮어쓴다.
- 경로 탈출(`..`, 절대 경로), `__MACOSX`, `.DS_Store`, 재생성 캐시, 비텍스트 엔트리는 복원하지 않는다.
- 「내보내기」 탭에 [백업 복원 (.zip)] 버튼 추가. 백업 파일 선택 시 새 파일/덮어쓰기/동일/건너뜀
  preview를 보여주고, [복원 실행]을 눌러야 적용한다.
- 복원 직전 덮어쓸 파일은 기존 snapshot 시스템에 남기고, 새로 생긴 파일은 restore point에 기록한다.
  [방금 복원 되돌리기]는 snapshot 복구 + 새 파일 삭제로 직전 복원을 되돌린다.

### AI 출력 품질 회귀 안전장치
- `quality.ts` 추가. 후보 원고의 빈 본문, 짧은 본문, placeholder, fallback 문구, 금지어,
  필수어 누락, 반복 문단을 결정적으로 점검한다.
- 초안/수정/웹-import 후보 메타에 `qualityStatus` / `qualityIssues`를 저장하고, 집필/설계자 후보 UI에 표시.
- 의미 품질 전체를 자동 판정하는 장치가 아니라, 제품에 새면 안 되는 흔적을 잡는 좁은 회귀 게이트다.

검증: `npx vitest run tests/backup.test.ts tests/exportManuscript.test.ts` 14/14 ·
`npm run check` 0오류/0경고 · `npm test` 67/67 · `npm run build` OK(기존 chunk-size warning 유지) ·
`npm run tauri:build:mac:standalone` OK ·
`codesign --verify --deep --strict --verbose=2 src-tauri/target/release/bundle/macos/Bindery.app` OK.
당시 내보내기 화면 visual QA: `.superloopy/evidence/frontend/20260707T2048-restore-preview-export/VISUAL_QA.md`
(1280/768/390 viewport PASS, overflow 0, 버튼 겹침 0).

## 2026-07-07 — readiness 잔여 추가 반영: 외부 변경 감지와 저장 전 충돌 가드

기준: 제품화 리뷰의 "네이티브 file watcher와 충돌 처리" 항목 중, 네이티브 watcher 없이도 로컬에서
즉시 닫을 수 있는 신뢰성 레이어를 추가했다.

- `projectChanges.ts` 추가: source-of-truth 텍스트 파일만 해시 digest로 추적하고,
  `.bindery/runs`, `trace`, `snapshots`, `exports` 같은 변동성 출력은 제외.
- 창 포커스 복귀 시 `refreshAll({ reportExternalChanges: true })`가 created/modified/deleted를 비교해
  상단바 [외부 변경 N건] 칩과 toast로 알림.
- 파일 화면 저장, 집필 화면 원고 저장, 설계자 회차 화면 원고 저장은 열어둔 뒤 디스크 파일이 바뀐 경우
  확인을 요구한다. 덮어쓰기로 진행하면 외부 변경본을 먼저 snapshot에 남긴다.
- `tests/projectChanges.test.ts` 3건 추가: 추적 대상 필터, tree flatten, created/modified/deleted diff.

검증: `npx vitest run tests/projectChanges.test.ts tests/backup.test.ts tests/exportManuscript.test.ts tests/quality.test.ts`
20/20 · `npm run check` 0오류/0경고 · `npm test` 67/67 · `npm run build` OK ·
`npm run tauri:build:mac:standalone` OK · codesign verify OK · visual QA PASS
(`.superloopy/evidence/frontend/20260707T2105-external-change-guard/VISUAL_QA.md`,
1280/768/390 overflow 0, 버튼 겹침 0, 외부 변경 칩 표시).
