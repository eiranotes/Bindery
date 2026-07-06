# log.md — 작업 로그

## 2026-07-05 — AI 장기 집필 하네스 신규 구축 세션

1. **레거시 감사**: HermesWorkspace/project/Bindery 코드·문서·파이프라인 정밀 감사
   → docs/research/current_structure_audit.md. 초기에 레거시 확장 방향으로 착수했다가
   사용자 지시로 방향 전환(작업 트리 신규 구축, UI 신규). 레거시에 넣었던 수정은 전량 원복.
2. **조사**: 펜시브(pensiv.so) 웹 재조사 → docs/research/pensiv_ui_benchmark.md.
   Open Design MCP로 와이어프레임 생성(bindery-harness-ui).
3. **스캐폴드**: Vite+Svelte5+TS, git init, dev 브리지(server/bridge.ts: fs 앵커·경로 탈출 거부·
   CLI spawn·trace 저장·timeout), memory 브리지.
4. **코어**: layout/text/diff/blueprint 유틸 → 프롬프트 blueprint 16종 → contracts 검증기 →
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
