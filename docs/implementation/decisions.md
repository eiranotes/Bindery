# 설계 결정 기록 (누적)

## 2026-07-05 — 신규 구축 결정

### D1. 작업 트리 신규 구축, 레거시는 참조로
사용자 지시("현재 작업 트리에 아예 새로. UI는 레거시가 마음에 안 듦")에 따라
`/Users/tofu/Bindery`에 제품을 새로 구축했다. 레거시(HermesWorkspace/project/Bindery)에서는
코드가 아니라 **검증된 패턴**만 흡수했다: candidate-first, snapshot-before-apply, artifact/run
영속화, envelope 검증+repair, agent/fallback 정직 표시, warm-paper/teal 디자인 토큰, 경로 앵커링.
레거시 저장소에 넣었던 초기 수정은 전부 원복했다.

### D2. 스택: Vite+Svelte5 SPA + dev 브리지, Tauri는 로드맵
데스크톱 패키징보다 "지금 실제로 도는 local-first"를 우선했다. Vite dev 서버 미들웨어
(server/bridge.ts)가 Node fs와 CLI spawn을 제공하므로 `npm run dev`만으로 완전한 로컬 도구다.
프런트엔드는 Bridge 인터페이스(src/lib/bridge)만 알기 때문에, Tauri 채택 시 어댑터 하나를
추가하면 되고 UI/도메인 코드는 바뀌지 않는다. memory 브리지는 테스트·정적 데모용이다.

### D3. 러너 단일 경로
레거시의 "액션 파일이 단계마다 프롬프트/파싱/폴백을 반복"하는 구조 대신,
`runStage(ctx, spec)` 하나에 blueprint 렌더→실행→검증→repair→폴백→trace를 고정했다.
단계 모듈은 vars/parse/fallback만 정의한다. UI-오케스트레이션 분리 요구(§9)의 답이다.

### D4. 프롬프트는 파일이 원본
`prompts/*.prompt.md` 16종이 원본이고 코드는 `?raw`로 읽는다. 템플릿 기능은 `{{var}}` 치환만.
전송본은 `.bindery/trace/`에 실행마다 보존된다. 프로젝트별 blueprint 오버라이드는 로드맵.

### D5. 승인 모델: 항목 단위 결정 + 비파괴 반영
proposal(세계관 확장/정사 변경)은 항목별 approved/rejected를 사람이 찍고 `applyProposal`만
파일을 쓴다. 정사 변경은 기존 파일에 **표식 주석과 함께 append**한다 — AI patch가 사람이 쓴
내용을 덮는 사고를 구조적으로 차단하고, 정리는 사람이 한다. 재적용은 마커로 멱등 처리.

### D6. 오프라인 폴백의 정직성 등급
- 계획류(소재/플롯/브리프/장면): "뼈대"를 만들되 뼈대임을 본문·risk에 명시.
- 위험류(수정 후보/정사 변경): 폴백을 만들지 않고 거부한다. 지어낸 수정·설정 변경은
  뼈대가 아니라 오염이기 때문이다.
- QA: "판정 아님"만 남긴다.

### D7. 상태 = 폴더 (ideas)
소재의 채택/보류/폐기를 frontmatter가 아니라 폴더 이동으로 표현했다. 파일 탐색기만 봐도
상태가 보이고, 이동이 곧 이력이다. 브리지에 move 연산을 두고 경로 탈출을 서버에서 거부한다.

### D8. QA는 3관점 분리 실행
단일 점수 대신 style/continuity/canon 세 blueprint를 따로 실행한다. 근거 인용 없는 fail은
파서가 warn으로 강등한다(레거시에서 검증된 규칙 흡수). 세 보고서가 수정 계획의 입력이 된다.

### D9. resume state는 정적 조립
재개 상태는 AI 산출이 아니라 픽스 시점의 파일들(요약/떡밥/제안 대기/진행 상태)에서
기계적으로 조립한다. 재개 지점이 환각될 이유가 없어야 하기 때문이다.

### D10. JSON Schema는 교환용, TS 파서가 런타임 기준
스키마 이중화(schemas/*.json ↔ contracts.ts)의 충돌 시 contracts.ts가 기준. JSON Schema는
웹 AI 교환과 외부 도구 문서화용이다. 7종은 선행 설계 패키지에서 흡수, 3종 신규 작성.

### D11. 후보 수 상한과 폴백 중단
초안 후보는 최대 4개. 폴백 경로에서는 1개 생성 후 중단한다 — 같은 뼈대를 여러 "후보"로
보여주는 것은 비교라는 행위 자체를 속이는 것이기 때문.

### D12. 웹 AI 교환은 CLI와 동일 파서를 공유
packet import는 CLI 경로와 같은 contracts 파서를 통과해야만 등록된다(source=web-import 표시).
현재 idea-discovery/world-expansion 왕복이 UI에 연결됨. 나머지 단계는 로드맵.

### D13. 우측 고정 인스펙터 제거
3단 레이아웃은 작업면을 좁히고, 반복 정보가 우측에 고정되어 AI 생성 대시보드처럼 보이는 문제가 있었다.
Bindery는 좌측 구조 탐색 + 중앙 작업면의 2단 구조를 기본으로 하고, 현재 실행/대기 제안/최근 스냅샷 같은
보조 정보는 최하단 1줄 상태바와 run 도크로 이동했다. 상태바는 설정에서 숨길 수 있다.

### D14. 계획 산출물 승인은 파일 내부 JSON에 저장
브리프와 장면 계획은 `story/chapters/{ep}/brief.md`, `scene-plan.md`의 `bindery:json` 블록에
`bindery_approval.status`를 저장한다. 별도 상태 DB를 만들지 않고 파일이 진실이라는 원칙을 유지하기 위해서다.
초안 후보 생성은 브리프와 장면 계획이 모두 `approved`일 때만 통과한다.

### D15. Tauri는 Bridge 어댑터로만 붙인다
Tauri 패키징은 `tauriBridge`와 `src-tauri` Rust command(fs/scaffold/run_agent/cancel_agent/env)로 추가했다.
UI와 하네스는 여전히 Bridge 인터페이스만 알며, dev 서버의 `/__bridge`와 패키지 앱의 Rust command는 같은 계약을 구현한다.

## 2026-07-05 — UX-first autopilot 개편

### D16. 파이프라인 위에 autopilot 레이어, stage는 불변
승인 피로의 원인은 내부 파이프라인이 UI에 그대로 노출된 것이므로, stage를 줄이는 대신
`workflow.ts`(상태→다음 행동)와 `autopilot.ts`(stage 묶음 실행)를 추가했다.
설계자 모드에서 기존 화면·버튼은 전부 유지된다.

### D17. 승인 이원화 — soft output은 autopilot이 승인
브리프·장면 계획은 soft output으로 재분류하고 `bindery_approval.approvedBy: 'autopilot'`으로
자동 승인한다(D14의 게이트 자체는 유지 — 설계자 모드의 수동 흐름과 기존 테스트 보존).
원고 반영·canon 변경·픽스·기획 채택은 hard commit으로 남아 반드시 사람이 버튼으로 확정한다.

### D18. 기초자료는 단일 로더로 강제
집필 계열 stage가 파일을 흩어 읽다 빠뜨리는 사고를 막기 위해 `context.ts`의
`loadEpisodeContext()`가 바이블·스타일·재개 상태·열린 떡밥·플롯 row·이전 요약·이전 화
끝부분을 한 번에 조립하고, 빈 자료를 `missing`으로 보고한다. draft 프롬프트에 이전 요약·
이전 화 끝부분·열린 떡밥 변수를 추가해 구멍을 메웠다.

### D19. 간단/설계자 이원 UI + 최대 2단
기본은 간단 모드(홈·집필·작품노트·보류함·파일·설정, 사이드바 없음)이고, 설정에서
설계자 모드로 전환하면 기존 파이프라인 화면과 run 도크가 열린다. 3단 배치는 금지를
유지하며, 2단 분할은 작품노트(목록+뷰어) 한 곳만 허용한다.

### D20. 대기 시간은 스트리밍으로 흡수
기존 SSE를 `runFeed` 스토어에 누적해 집필/홈 화면의 LiveRunPanel이 CLI stdout 원문을
실시간 표시한다. 요약 tail만 보여주던 상태바 방식은 보조로 강등.

### D21. 후보는 번호가 아니라 접근 라벨
기본 후보 3개는 정석안/추진안/감정안 라벨과 접근 지시(variation)를 가진다.
추천은 자체 점검 점수 최고 후보. 후보 카드 메타(요약·위험·자수·점수)는 index.json에 영속.

### D22. 바이블은 플롯 전에 반드시 실질 문서로 적용
기획 채택 후 플롯은 `canon/setting-bible.md`를 입력으로 읽는다. 따라서 AI 바이블 조립이
코드펜스 등 형식 문제로 실패해도, 승인된 자산 파일에서 만든 로컬 조립본을 canon 바이블에
적용한 뒤 플롯을 짠다. 빈 템플릿 바이블을 두고 플롯/회차를 진행하면 다른 이야기처럼
흘러가는 문제가 생기기 때문이다.

### D23. 라이트모드는 바이블·플롯 누락을 집필 전에 차단
간단 모드에서도 `바이블 → 플롯 → 회차 설계 → 초안` 순서를 보장한다. `workflow.ts`는
실질 바이블이 없거나 현재 회차 plot row가 없으면 `prepareStoryFoundation` CTA를 먼저
낸다. `runEpisodeAutopilot`도 같은 조건에서 후보 생성을 거부한다. 사용자가
[바이블과 플롯 준비하고 쓰기]를 누르면 `ensureStoryFoundation`이 바이블을 적용하고 그
바이블로 플롯을 제안한 뒤, 집필 화면은 설계부터 다시 후보를 만든다.

### D24. 컨텍스트는 로컬 선별 → AI 정제 → 집필의 3단 라우터로 조립
프롬프트에 바이블/설정을 통짜 clip으로 넣지 않는다. 1차는 AI 없는 결정적 선별
(`contextPack.ts`: 섹션 분할 + 이번 화 플롯 row·직전 요약·메모 질의어 스코어 +
문자 예산 pruning), 2차는 팩이 임계값을 넘을 때만 경량 모델의 `context-distill`
캡슐 압축, 3차가 집필이다. 포함/제외와 사유는 manifest
(`.bindery/artifacts/<ep>/context-pack.json`)로 남겨 근거 보기에서 감사한다.
관계 그래프·FTS·벡터 RAG는 이 선별 계층의 스코어러를 교체/보강하는 방식으로
도입한다 — 조립 파이프라인 자체는 바뀌지 않는다.

### D25. 모델은 파이프라인 그룹별 티어로 라우팅
실행기는 저(경량)/중(기본)/고(고급) 3티어이고, 티어마다 다른 CLI·모델을 연결할 수
있다(codex/claude/gemini/직접). 스테이지는 기획·설계/컨텍스트 정제/원고 집필/검수/
요약·기억 5그룹으로 접혀 그룹→티어 배정을 설정에서 바꾼다. 기본값: 집필=고급,
정제·요약=경량, 나머지=기본. 러너는 `Ctx.agentFor(stage)`로 매 스테이지 직전에
실행기를 해석하고, 비활성 티어는 기본 실행기로 폴백한다. run 기록에는 실제 사용된
command/model이 남는다.

### D26. 최초 기획 업로드는 원문 파일 + 제한된 프롬프트 요약으로 분리
최초 [AI에게 기획 맡기기]에서 사용자가 붙인 텍스트 자료와 `.zip` 내부의 텍스트 엔트리는
`notes/source-raw.md`에 먼저 저장한다. 기획 후보 생성 프롬프트에는 저장 경로와 제한된 발췌만
넣어 입력 폭주를 막는다. 앱은 업로드 개수 자체를 제한하지 않지만, 각 파일 원문과 전체
프롬프트에는 문자 예산을 유지한다. zip은 메모리에서 펼치고 경로 탈출, macOS 메타 파일,
비텍스트 엔트리는 건너뛴다. PDF/문서 파싱이나 장기 RAG 색인은 별도 기능으로 둔다.

### D27. 패키지 아이콘은 레거시 Bindery 아이콘 세트를 그대로 사용
현재 Tauri 패키지의 앱 아이콘은 레거시 Bindery의 검증된 아이콘 세트
(`/Users/tofu/HermesWorkspace/project/Bindery/apps/desktop/src-tauri/icons/`)를 원본으로 한다.
번들러가 기본값을 추론하지 않도록 `bundle.icon`에 `32x32.png`, `128x128.png`,
`128x128@2x.png`, `icon.icns`, `icon.ico`를 명시한다.

### D28. macOS standalone 재빌드는 앱 번들 ad-hoc 서명까지 포함한다
현재 루트 Tauri 체크아웃의 macOS standalone 산출물은 `npm run tauri:build:mac:standalone`으로
만든다. 이 스크립트는 `tauri build --bundles app` 뒤에
`codesign --force --deep --sign - src-tauri/target/release/bundle/macos/Bindery.app`을 실행한다.
Tauri가 만든 실행 파일의 linker ad-hoc 서명만으로는 `.app` 리소스 봉인이 없어
`codesign --verify --deep --strict`가 실패할 수 있으므로, 배포 전 검증 가능한 앱 번들을
반복 생성하기 위해 빌드 명령에 서명 단계를 고정한다.

### D29. zip 압축 해제는 WebView API에만 의존하지 않는다
최초 기획 자료 zip은 중앙 디렉터리에서 텍스트 엔트리를 선별한 뒤 브라우저 메모리에서 읽는다.
deflated 엔트리는 먼저 `DecompressionStream('deflate-raw')`을 시도하지만, macOS WebView처럼 이 API가
없거나 형식 지원이 불완전한 런타임에서는 `sourceUploads.ts`의 순수 JS raw deflate fallback으로
푼다. 이 fallback은 zip의 stored/fixed/dynamic deflate 블록을 읽는 좁은 범위의 구현이며,
새 production dependency 없이 앱 내부 자료 업로드 경로에만 사용한다.
