# 22. Novel Studio 설계 리뷰 및 강화안

> 대상: `novel_studio_gui_design` 패키지 전체(docs 01~21, schemas, implementation, templates, wireframes, examples)
> 원칙: 기존 컨셉을 **삭제하지 않고 보존**하며, "금지 추가"가 아니라 **절차적 제어 / 분석 / 후속 수정**으로 강화한다. Markdown / Git / Obsidian 호환을 훼손하지 않는다. 중요한 정보를 GUI 전용 DB에만 두지 않는다.

---

## 1. 전체 평가

### 1.1 현재 설계의 강점

1. **Markdown-SoT + SQLite-cache 원칙이 문서 전반에서 일관됨.** 01·03·04·05·21 어디를 봐도 "중요 데이터는 파일에도 존재해야 한다"가 반복되어, 나중에 구현이 흔들려도 되돌아올 기준점이 명확하다.
2. **비파괴 흐름이 파이프라인 전체에 박혀 있음.** `AI run → candidate → preview → diff → apply → snapshot → write`가 04·07·15에서 일관되게 강제되고, "자동 덮어쓰기 금지 파일" 목록(final/locked canon/user pref/manual scene)이 명시적이다.
3. **QA와 Analysis를 판정(verdict)과 참고통계로 분리.** 12에서 이 구분이 명확해, QA가 창의성을 억누르는 실패를 구조적으로 예방한다.
4. **절차적 제어 철학의 구체화.** "시선 금지" 대신 "반복 지도 → 의도/무심코 판별 → 대체 전략" 예시(01·07·12)는 이 제품의 진짜 차별점이다.
5. **numbered 파이프라인이 agent 출력과 1:1 매핑.** 05의 `00_brief ~ 13_final`과 08의 agent 목록이 정확히 대응해 추적성이 좋다.
6. **Job system이 성숙함.** states/event bus/parallel policy(04·08)와 "같은 output file 동시 실행 금지"까지 실전적이다.
7. **integrity check의 stale 감지(15)** 는 장기 연재에서 실제로 사고를 막는 기능이다(요약/QA/context가 원고보다 오래됨 감지).
8. **한국어 특화가 곳곳에 반영됨.** 조사 결합 alias, IME composition 주의, kiwipiepy, 문장끝 regex(07·12·13·20).
9. **프라이버시가 설계 레벨에서 다뤄짐.** input manifest preview, deny_patterns, privacy modes(16).
10. **CLI-first로 GUI/CLI divergence를 구조적으로 차단(19.4.1).** GUI가 도메인 로직을 자체 구현하지 않고 novelctl에 위임한다는 결정이 핵심적으로 옳다.

### 1.2 현재 설계의 약점 (핵심 공백)

- **Context Pack이 장기기억의 핵심인데 가장 얇게 명세됨.** 계층화(hot/warm/cold), 토큰 예산, "지난 화 대비 delta 주입", stale 감지의 결정 방식이 없다. 50화를 넘기면 AI가 설정을 잊거나(under-context) 과부하되는(over-context) 문제가 여기서 터진다.
- **파일명이 파이프라인 단계와 강결합됨.** `00~13` 숫자 prefix가 단계 위치를 뜻하므로 단계 추가/재정렬 시 전체 리넘버링 → Obsidian 링크·wikilink가 깨진다.
- **draft/final 이중화로 "현재 작업 텍스트"의 정체성이 모호함.** 에디터는 무엇을 편집하고, QA는 무엇에 돌고, rewrite는 무엇을 덮는가? user_flow는 QA를 `13_final`에 돌리는데 revise는 "13_final candidate"를 만든다 → 같은 파일이 입력이자 출력.
- **QA 점수가 전면에 노출됨.** 모든 와이어프레임이 `86 PASS`를 앞세워, 스스로 경고한 "점수놀이"를 유발할 소지가 있다. issue → revision task → 재QA로 이어지는 **폐루프 추적**이 없다(이 이슈가 실제로 고쳐졌는지 아무도 모름).
- **Commit이 다중파일 트랜잭션인데 원자성이 없음.** summary/canon-delta/open-threads/story-state/update-log/progression/git을 한 번에 건드리는데 중간 실패 시 상태 불일치가 남는다.
- **Plot 정보가 4곳에 중복됨.** scene frontmatter의 `plotlines`, plot grid YAML, canvas nodes, timeline events가 같은 사실을 각자 저장 → source drift.
- **QA-all의 AI 비용/지연이 폭증함.** 6~7개 AI agent × 회차, 300화면 감당 불가. "변경된 scene만 재QA"하는 증분 QA가 없다.
- **Notes/Idea Inbox 라이프사이클이 사실상 미명세.** binder 섹션 이름만 있고 스키마·상태전이·본문 연결·note→brief/scene 생성이 비어 있다.
- **Canon lock이 free-text 헤더 수준(setting-bible.md).** canon-delta apply의 대상이 구조화되지 않아 잠금 무결성이 약하다.
- **Export/Compile이 거의 비어 있음.** 문피아/카카페/네이버 시리즈 회차 포맷, 자수 목표, 후기 처리 없음 → 결국 다른 툴로 복붙하게 됨.
- **cross-episode 반복/문체 틱이 추적 안 됨.** Repetition Map은 회차 내부만 본다. 독자는 "매 화 같은 마무리 비트", "3화마다 같은 묘사"를 더 크게 느낀다.
- **style profile 자동 구축·drift 감지 부재.** reference-profile.md를 작가 본인 원고에서 만들거나, 300화에 걸친 문체 이탈을 잡는 장치가 없다.

### 1.3 제품 포지션 재정의

현재도 방향은 옳지만, 한 문장으로 날을 세우면:

> **"Obsidian/Git Markdown vault 옆에서 도는, 연재 전용 연속성(continuity) brain + 비검열 QA 하네스."**

- 에디터로 Obsidian·Scrivener와 경쟁하지 **않는다.** 에디터는 "충분히 좋음"이면 되고, 사용자가 언제든 다른 툴로 같은 파일을 열 수 있어야 한다.
- 진짜 wedge 4가지: (1) 로컬 파일 투명성, (2) Gemini 서브에이전트 **커스터마이징**, (3) 장기 연재 **연속성 무결성**(context pack·canon·open-thread·progression·stale 감지), (4) **비검열 절차적 QA**(금지 대신 대체 전략).
- 따라서 제품의 심장은 에디터가 아니라 **Context Pack + Canon/Continuity + QA 폐루프**다. 로드맵도 이 순서로 무게를 실어야 한다(아래 §7에서 Context Pack을 앞당김).

### 1.4 가장 위험한 설계 리스크 10개

| # | 리스크 | 왜 위험한가 | 조기 완화 방향 |
|---|---|---|---|
| R1 | Context Pack 계층화·토큰예산·delta·stale 미명세 | 장기기억 핵심. 50화+에서 AI가 설정 망각/과부하 → 제품 가치 붕괴 | §5.1 tier 스키마 + source_hash 기반 stale, Phase를 앞당김 |
| R2 | 파일명↔파이프라인 단계 강결합(00~13) | 단계 추가 시 전체 리넘버링, Obsidian 링크 파손 | §5.2 `pipeline` manifest로 stage↔path 분리, prefix는 장식화 |
| R3 | draft/final 이중화로 현재본 정체성 모호 | 편집·QA·rewrite 대상 혼선, 유실·중복 반영 위험 | §5.2 단일 `manuscript.md` 포인터 + 단계본은 immutable 스냅샷 |
| R4 | QA 점수 전면화 + fix 폐루프 부재 | 점수놀이·창의성 위축, 이슈가 고쳐졌는지 추적 불가 | §5.4 revision task 파일화 + input_hash 재QA 자동 close |
| R5 | commit 다중파일 원자성 부재 | 중간 실패 시 요약↔canon↔state 불일치가 영구화 | §5.6 commit journal(staged→verify→atomic move) |
| R6 | plot 정보 4중 중복(frontmatter/grid/canvas/timeline) | source drift, 어느 게 진실인지 모름 | §5.5 scene frontmatter를 유일 원천으로, 나머지는 **derive** |
| R7 | QA-all AI 비용/지연 폭증, 증분 QA 없음 | 300화 운영 불가, 매 회차 수 분+토큰 낭비 | §5.4 scene 단위 QA + hash 캐시, 변경분만 재실행 |
| R8 | Notes lifecycle 미명세 | 아이디어→본문 연결이 공백, Pensieve식 흐름 실종 | §5.7 note state machine + note→brief/scene 커맨드 |
| R9 | canon lock free-text | canon-delta apply 대상 비구조화, 잠금 무결성 약함 | §5.3 canon fact 파일화(state: locked/provisional/retired) |
| R10 | Export/Compile 공백 | 연재 실무(플랫폼 포맷)와 단절 → 툴 이탈 | §5.8 export profile + compile 커맨드 |

추가로 주시할 준리스크: full-file rewrite diff가 9,000자라 리뷰 불가(→ hunk/scene 단위 patch 필요), style profile drift 미감지, cross-episode 반복 미추적.

---

## 2. 기능별 개선안

> 표기: 우선순위 `P0`(MVP 필수) / `P1`(v1) / `P2`(v1.1~) / `P3`(이후). 난이도 `L`(낮음)/`M`/`H`(높음).

| 기능군 | 현재 설계 | 문제점 | 개선안 | 우선 | 난이도 |
|---|---|---|---|---|---|
| **Markdown Editor** | CodeMirror6 + frontmatter fold + dynamic link + repetition/QA decoration + `Cmd+K` selection command | 편집 대상이 draft/final 중 무엇인지 모호. 긴 회차에서 decoration 성능·IME 충돌 우려는 언급됐으나 검증 절차 없음 | 에디터는 항상 `manuscript.md`(단일 현재본)를 연다. decoration은 viewport-only + worker 계산 유지하되 IME `compositionend`까지 transaction filter 금지 규약을 테스트 픽스처로 못박음. draft/final은 읽기전용 diff 대상 | P0 | M |
| **Episode Workspace** | Brief/Context/Plan/Draft/Summary/CanonDelta/QA/Revision/Final 9탭 | 9탭이 초심자에게 과함. "다음 화 쓰기"라는 실제 동선이 탭 순회에 묻힘 | 탭은 유지하되 상단에 **단일 Primary CTA**(상태기반: Build Context→Draft→QA→Revise→Commit)를 고정. "기본 모드"는 Draft·QA·Final 3탭만, "고급 모드"에서 전체 노출 | P0 | L |
| **Context Pack** | context-architect가 `01_context-pack.md` 생성, "전체 canon 넣지 말라" 규칙 | 계층·토큰예산·delta·stale 결정 방식 없음. 장기연재 최대 리스크 | tier 스키마(hot-canon/recent-summaries/active-threads/character-states/style) + `token_budget` + `source_hashes`(stale 결정) + "지난 화 대비 변경 canon만 강조" delta 섹션. §5.1 | **P0** | H |
| **Gemini Agent Pipeline** | 15 agent, 단계별 creativity 파라미터, output contract, parallel policy | agent가 원문 덮어쓸 위험은 규칙으로만 통제. rewrite가 full-file일 때 검토 불가 | agent별 `read`/`write` scope를 novelctl에서 **강제**(16.5), rewriter는 **range-anchored patch**만 출력(full-file blind overwrite 금지). §6 | P0 | M |
| **QA Dashboard** | score card + issue list + jump/rerun | 점수 전면화(점수놀이), 이슈→수정→재QA 폐루프 없음 | 카드는 **verdict 중심**으로 재배치(점수는 보조 회색). 각 issue를 `qa/tasks/`의 task 파일로 승격, 재QA 시 `input_hash`로 자동 close/reopen. §5.4 | P0 | M |
| **Repetition Map** | word/phrase/sentence-ending/description 모드 + 분포 + intentional 마킹 + 대체전략 | 회차 **내부**만. 판정이 count 임계 위주 | 유지 + 판정 4분류 명시(**의도 반복 / 무심코 반복 / 캐릭터 말버릇 / 후렴**)를 term별 라벨로. 말버릇/후렴은 codex·scene 태그와 연동해 자동 예외. cross-episode는 아래 별도 항목 | P1 | M |
| **Rhythm/Density Analysis** | 대사/묘사/독백 비율, 문단 길이, scene 단위 | scene 없을 때 fallback만, "레퍼런스 대비" 기준선 없음 | 유지 + 작가의 "잘 쓴 회차" 표본에서 **개인 기준선(baseline)** 산출 → 이번 화가 baseline에서 얼마나 이탈했는지 표시. 전부 로컬 계산 | P1 | M |
| **Reader Review** | persona별(웹소설/장르팬/유료/편집자) 점수·댓글·유료이탈 위험 | QA와 분리는 잘 됨. 이전 편 summary 주입만 명시 | 유지 + persona 설정 파일화(`analysis/personas.yaml`). 출력에 "다음 화 당길 요소 1개"를 필수 필드로 → 리뷰가 곧 다음 brief 씨앗이 되게 | P2 | M |
| **Codex** | 항목 md+frontmatter, alias, progression, mention history | 관계(relationship)가 별 폴더로 흩어짐, 미사용 항목/요약 누락 탐지만 나열 | 유지 + `relationships/`를 codex의 edge로 흡수(양방향 링크 무결성 체크). "장기 미등장 항목" 리포트를 open-thread와 연결 | P1 | M |
| **Dynamic Links** | alias trie + confidence factor + hover + mention report + safe apply | 짧은 alias 오탐 대응은 좋음. 그러나 confidence 임계·조사 처리 테스트 부재, ambiguous 재검토 UX 얕음 | 유지 + `min_alias_length`·조사 결합 케이스를 golden fixture로 검증. ambiguous는 mention report에서 **일괄 재검토 뷰** 제공(수락/무시/새 항목) | P1 | M |
| **Plot Board** | scene card drag/split/merge/cut, generate from card | 카드 데이터가 scene frontmatter와 별개로 흐를 위험 | 카드 = scene frontmatter의 **뷰**로 못박음(카드 이동 = frontmatter `order` 갱신 + snapshot). 새 저장소 만들지 않음 | P1 | M |
| **Plot Grid** | scene×plotline 매트릭스, subplot 소실/tension flatline 경고 | grid YAML이 frontmatter와 중복 → drift | grid를 **derive-only**로. cell 값(beat)은 scene frontmatter `beats.<plotline>`에서 읽고, 편집 시 frontmatter에 쓴다. §5.5 | P1 | M |
| **Canvas** | node/edge 타입 정의, Mermaid→JSON→Obsidian 3단계 | 우선순위 명확(좋음). 다만 canvas가 또 다른 진실원이 될 위험 | Phase1 **Mermaid를 plot 데이터에서 생성(read-only)** 유지. 수동 배치 JSON은 "레이아웃 오버레이"로만 저장(사실은 frontmatter/thread에서 derive) | P2 | H |
| **Notes Inbox** | 폴더·binder 섹션만 존재 | lifecycle/스키마/본문연결/생성기능 공백 | note state machine(inbox→candidate→attached→used/rejected, promoted_to canon-fact) + `note→brief`, `note→scene candidate` 커맨드. §5.7 | P1 | M |
| **Snapshot/Git** | destructive 전 snapshot, manifest+hash, restore 전 pre-snapshot, git optional | full-file diff 리뷰 부담, snapshot 용량 증가 정책은 리스크에만 | 유지 + **hunk 단위 apply**(diff-match-patch/CodeMirror MergeView). snapshot pruning(회차별 최근 N + before-commit 영구 보존) 정책 파일화 | P0 | M |
| **Integrity Check** | stale summary/QA/context, broken wikilink, ambiguous alias, hash mismatch | 강력함. 단 canon lock 위반·commit journal 미완료·plotline 방치 미포함 | 유지 + 체크 추가: `canon fact state=locked 변경 시도`, `commit journal 미완료`, `open-thread N화 방치`, `progression↔timeline 모순` | P1 | M |
| **Export/Compile** | 개념 한 줄(final 이어붙이기) | 플랫폼 포맷/자수/후기/EPUB 전무 | export profile(`exports/profiles/*.yaml`: 목표자수·회차구분·후기·머리말) + `novelctl compile --profile munpia --range 1-50`. §5.8 | P2 | M |
| **Settings** | App/Project/Gemini/novelctl/Agents/Editor/Privacy/Backup | 충분. 단 creativity 슬라이더가 어디 저장되는지 불명확 | creativity/strict preset을 **project config에 저장**(GUI 전용 저장 금지). 슬라이더는 config를 편집하는 뷰일 뿐 | P1 | L |
| **Security/Privacy** | path sandbox, deny_patterns, input manifest, privacy modes, agent scope | MVP는 novelctl에서만 enforce, Tauri는 v1 | 유지하되 **path traversal 검사만은 MVP부터 Tauri에서 강제**(파일유출은 되돌릴 수 없음). `View Prompt Package`를 QA/draft 실행 버튼 옆에 상시 노출 | P0 | M |

---

## 3. 추가 기능 아이디어

### MVP에 반드시 넣을 것

- **단일 `manuscript.md` 현재본 포인터.** draft/final 이중화의 정체성 문제를 원천 차단. 단계본(03_draft, 13_final)은 이 파일의 immutable 스냅샷으로 남긴다(§5.2).
- **Context Pack tier + 토큰 예산 + source_hash.** 장기연재 핵심을 MVP에서 최소형이라도 확보(§5.1). 없으면 이 제품이 그냥 마크다운 에디터가 된다.
- **QA issue → revision task 파일화.** 이슈가 파일로 남고 재QA가 자동 close. QA를 "판정"에서 "작업 큐"로 전환(§5.4).
- **Commit journal(원자성).** 다중파일 커밋의 crash-safety. 데이터 신뢰의 최저선(§5.6).
- **Tauri path-traversal 강제(MVP).** 유출은 비가역이므로 novelctl뿐 아니라 shell에서 막는다.

### v1.1에 넣을 것

- **Cross-episode 반복/틱 지도.** `analysis/project/tics.md` — 회차를 넘나드는 묘사 과용·회차 마무리 비트 반복 추적. Repetition Map의 자연스러운 확장.
- **개인 문체 baseline.** 작가가 태그한 "잘 쓴 회차"에서 rhythm/density/문장길이 기준선을 만들어 이탈도 표시(전부 로컬).
- **Voice fingerprint.** 캐릭터별 과거 대사 코퍼스를 로컬 집계해 voice-qa 입력으로 제공("최근 3화 대사 구조 유사" 판정을 데이터로 뒷받침).
- **Thread auditor.** open-thread가 N화 방치되었는지, payoff 없는 foreshadow가 있는지 정기 리포트.
- **Story-so-far 재생성.** arc 단위 롤업 요약을 재생성해 신규 독자/작가 복귀용 "지금까지" 문서 유지.

### v1.2 이후에 넣을 것

- **Export/Compile 플랫폼 프로파일**(문피아/카카페/네이버 시리즈/EPUB)(§5.8).
- **Canvas 인터랙티브 그래프**(Svelte Flow) — 단, 레이아웃만 저장하고 사실은 derive.
- **작성 세션/일일 목표/연속기록** 위젯(자수 목표, 오늘 쓴 양). 사용자의 생산성 성향과 부합.
- **Semantic 검색.** summary/canon 임베딩 로컬 인덱스로 "언제 X를 설정했지?" 검색.
- **A/B 초안 비교 뷰.** variants 2개를 나란히 diff + QA 동시 실행 후 선택.

### 실험 기능

- **회차 마무리(cliffhanger) 강도 트렌드 그래프** — reader-review의 cliffhanger 점수를 시계열로.
- **"만약에" 분기 탐색** — 특정 scene에서 대안 전개를 candidate로 뻗어보고 채택 안 하면 폐기(사용자의 Divergence Studio 감성과 연결).
- **로컬 모델 fallback** — Gemini 부재/Local-only 모드에서 소형 로컬 LLM으로 요약·mention만 처리.

### 넣지 말아야 할 기능 (MVP~v1 범위에서)

- **WYSIWYG/블록 에디터 우선** — Markdown 원본 보존·AI diff와 충돌(03·19에서 이미 경계). Tiptap은 보조 뷰로만.
- **실시간 협업/클라우드 동기화** — 1인 로컬 도구의 값을 흐리고 충돌·보안 표면만 키움(P3 유지).
- **GUI 전용 DB에 원고/설정 저장** — 제품 철학 위반. SQLite는 끝까지 캐시로만.
- **강제 금지어 사전** — 절차적 제어 철학과 정면충돌. 반복은 "판정+대체"로만 다룬다.
- **AI 자동 commit/자동 canon 반영** — 사람 승인 없는 canon 변경은 장기 붕괴의 지름길.

---

## 4. UX 개선안

### 4.1 메인 워크스페이스 구조

- 3분할(Binder / Editor / Inspector) + 하단 Job Console 유지.
- **기본 모드 / 고급 모드 토글**을 TopBar에 둔다. 기본 모드: Binder는 Episodes·Codex·Notes만, Editor는 Draft·QA·Final 탭만, Inspector는 QA·Links만. 고급 모드에서 Plot·Analysis·Snapshots·Agents 전부 노출.
- Inspector는 파일 타입별 context-sensitive 유지(06.2.4). 단 **패널은 항상 접힘 가능**, 마지막 상태를 `app-state.json`에 저장.

### 4.2 회차 작성 흐름

- 홈/Episode Dashboard의 최상단은 **상태 기반 단일 Primary CTA** 하나만 크게:
  `context 없음→[컨텍스트 생성]` · `draft 없음→[초안]` · `QA 미실행→[QA]` · `QA fail→[수정 지시서]` · `final 준비→[확정]`.
- 나머지 액션은 "더보기"로 접는다. 매일 쓰는 사람은 CTA 한 번 → diff 확인 → 저장, 이 3동작이 90%여야 한다.
- 각 단계 실행 버튼 옆에 **`입력 패키지 보기`**(§16.2)를 상시 노출 → 무엇이 AI로 가는지 항상 1클릭 확인.

### 4.3 에디터 오른쪽 패널 구성

- 상단: **현재 회차 상태 배지**(status, 자수/목표, QA verdict 요약). 점수 대신 verdict 우선, 점수는 회색 보조.
- 그 아래 탭: `QA` `Links` `Metadata` `Analysis` `Agents`. 기본 모드에선 `QA`/`Links`만.
- QA 탭은 카드가 아니라 **작업 큐**로: 각 이슈가 `[열기][수정계획에 추가][오탐][위치이동]` 액션을 가진 행. 해결된 이슈는 취소선.

### 4.4 AI 제안 적용 방식

- 모든 rewrite/expand/continue 결과는 **candidate → diff → hunk 단위 수락**. full-file 통째 적용 버튼은 두지 않는다(있더라도 "전체 수락"은 별도 확인).
- diff 뷰: 좌 현재본 / 우 candidate, hunk마다 `[이 구간만 적용]`. 적용 직전 자동 snapshot(reason 자동 기록).
- candidate가 stale(원본 hash 변경)이면 적용 비활성 + "현재본으로 재생성" 제안(11.5.2).

### 4.5 QA 결과 표시 방식

- Dashboard 최상단은 `Overall: REVISE_REQUIRED / OK` 한 줄. 개별 점수는 카드 하단 작게.
- 이슈 클릭 → 에디터 해당 line으로 이동 + squiggle 강조. **"수정 지시서에 추가"가 기본 동작**, 그래야 QA가 곧 작업으로 이어진다.
- 재QA 후: 사라진 이슈는 초록 "해결됨" 토스트, 새로 생긴 이슈만 강조 → 반복 QA가 지겹지 않게.

### 4.6 반복 표현 지도 UX

- 좌: term 리스트(분포 스파크라인 + 판정 라벨: **의도/무심코/말버릇/후렴**). 우: 선택 term의 occurrence + 미리보기.
- 각 term에 `[의도로 표시]`(이번 화 예외) / `[말버릇으로 등록]`(codex 캐릭터에 귀속) / `[대체 전략 보기]`. 대체 전략은 삭제 명령이 아니라 후보 목록(07.6, 와이어프레임 유지).
- 상단 토글로 **"이 회차 / 최근 5화 / 전체 연재"** 범위 전환(cross-episode 확장).

### 4.7 Codex 링크 UX

- 본문에서 alias는 confidence에 따라 실선(auto)/점선(ambiguous) 데코레이션. hover 카드에 `[코덱스 열기][링크 삽입][무시]`(13.5 유지).
- 저장 시가 아니라 **명령 실행 시** mention scan → 결과는 mention report + 에디터 데코. 자동 대량 링크는 항상 확인 후.
- Codex 항목 편집기 우측에 "이 항목이 등장한 회차" 타임라인 + progression을 함께 표시 → 설정이 회차와 살아 연결됨을 체감.

### 4.8 Plot Canvas UX

- MVP는 **Mermaid 미리보기**(plot 데이터에서 생성, 편집 불가, export만). 이걸로 "떡밥→회수" 그래프를 먼저 눈으로 본다.
- Plot Grid는 스프레드시트형: 행=scene, 열=plotline, cell 클릭 시 해당 scene frontmatter의 beat를 인라인 편집(§5.5). 빈 cell = subplot 부재를 시각적으로.
- Board는 카드 뷰, drag=순서(frontmatter order)만 바꾼다. 캔버스/그리드/보드 모두 **같은 scene frontmatter의 다른 렌더**임을 UI 카피로도 명시("이 뷰는 장면 메타데이터를 보여줍니다").

---

## 5. 데이터 모델 개선안

> 모든 제안은 **Markdown/YAML/JSON 파일**로 남고 Obsidian에서 열린다. SQLite에는 색인만. 기존 폴더 구조(05)를 삭제하지 않고 **보강**한다.

### 5.1 Context Pack 계층화 — `context/`

```text
context/
  story-so-far.md          # 전체 압축 시놉시스(아크 커밋 때 재생성)
  arc-summaries/
    arc1.md                # 아크 단위 롤링 요약
  recent/                  # 최근 N화 요약을 verbatim 보관(핫 메모리)
    ep009.md ep010.md ep011.md
  character-states.md      # 현재 인물 상태 스냅샷(진행 중 상태만)
  hot-canon.md             # 지금 회차에 관련된 locked fact만 추림(derive)
```

회차 context-pack은 여전히 `story/chapters/ep012/01_context-pack.md`에 생성하되, frontmatter에 **tier·예산·출처해시**를 둔다:

```yaml
context_pack:
  episode: "012"
  token_budget: 8000
  tiers:
    - name: hot-canon        # 필수
      priority: 1
      required: true
      sources: ["canon/facts/guild-medical-vacancy.md"]
      tokens_est: 700
    - name: recent-summaries # 최근 3화 verbatim
      priority: 2
      sources: ["context/recent/ep009.md","context/recent/ep010.md","context/recent/ep011.md"]
    - name: active-threads
      priority: 3
      sources: ["plot/open-threads.md#medical-risk"]
    - name: character-states
      priority: 4
      sources: ["context/character-states.md#eira"]
    - name: style
      priority: 5
      sources: ["style/reference-profile.md"]
  delta_since_last: |        # 지난 화 대비 바뀐 canon만 강조 주입
    - guild 의료 공백이 '언급'에서 '실제 리스크'로 승격됨
  source_hashes:             # stale 판정의 결정 근거
    "canon/facts/guild-medical-vacancy.md": "sha256:..."
    "context/recent/ep011.md": "sha256:..."
  generated_at: "2026-07-01T12:00:00+09:00"
```

- **stale 감지**: 현재 `source_hashes` vs 실제 파일 해시 비교 → 다르면 "context 재생성" 배지(15.7 integrity와 연동, 결정적).
- **토큰 예산 초과 시**: priority 낮은 tier부터 요약본으로 대체(recent verbatim → 요약, 전체 canon은 hot-canon으로만).
- **over-context 방지**: "전체 canon 금지"(현 규칙)를 tier 구조로 **강제화**.

### 5.2 파이프라인 탈결합 + 단일 현재본 — `manuscript.md`

기존 `00~13` numbered 파일은 **단계 산출물 로그로 보존**하되, 숫자 prefix를 "정체성"이 아닌 "표시 순서"로 강등한다.

```text
story/chapters/ep012/
  index.md          # 회차 메타 + pipeline manifest
  manuscript.md     # ★ 유일한 '현재 작업 본문'. 에디터·QA·rewrite의 단일 대상
  stages/           # 단계 스냅샷(immutable, diff용)
    brief.md draft.md draft-variantA.md final.md
  qa/ ...           # 아래 5.4
  scenes/ ...
```

`index.md` frontmatter에 stage↔path·상태·해시 매니페스트:

```yaml
pipeline:
  manuscript: manuscript.md         # 현재본 포인터(정체성 고정)
  stages:
    brief:   {path: stages/brief.md,  status: done, hash: "sha256:..."}
    context: {path: 01_context-pack.md, status: done}
    draft:   {path: stages/draft.md,  status: done}
    qa:      {path: qa/, status: revise_required}
    final:   {path: stages/final.md,  status: pending}
  current_stage: qa
```

- **draft→final은 상태 전이**. `stages/draft.md`·`stages/final.md`는 각 시점의 immutable 복사본(diff·복원용), 편집은 언제나 `manuscript.md`에.
- 단계 추가(예: `beatsheet`) 시 **리넘버링 불필요** — manifest에 키만 추가. wikilink는 `manuscript.md`·`index.md`만 가리키면 되므로 안정.
- Obsidian에서도 `manuscript.md` 하나만 열면 되어 오히려 단순.

### 5.3 Canon fact 구조화 — `canon/facts/`

setting-bible.md의 free-text 헤더를 유지하되(사람이 읽는 개요), **개별 사실을 파일화**해 canon-delta의 apply 대상을 구조화한다.

```text
canon/
  setting-bible.md          # 사람이 읽는 개요(유지)
  facts/
    guild-medical-vacancy.md
    dungeon-entry-women-only.md
```

fact frontmatter:

```yaml
id: guild-medical-vacancy
title: "길드 의료 총괄직 공백"
state: provisional        # locked | provisional | retired
established: ep011
scope: [medical-risk]
supersedes: null          # 이전 fact를 대체하면 id 명시
sensitivity: reveal-later # 독자에게 미공개(context '금지 대신 주의' 표시)
last_confirmed: ep012
```

- canon-extractor는 **fact 후보를 이 스키마로** 출력 → 사용자가 `promote/provisional/discard` 선택 → apply가 파일에 반영.
- integrity check에 "`state: locked` fact가 diff에서 변경 시도됨" 규칙 추가 → 잠금 무결성이 데이터로 강제.

### 5.4 QA 폐루프 + 증분 QA — `story/chapters/epXXX/qa/`

```text
qa/
  plot.md continuity.md style.md voice.md lexicon.md scene-pattern.md
  tasks/
    task-001.md            # 이슈 → 작업으로 승격
  cache.json               # scene hash → 최근 QA 결과(증분용)
```

QA 리포트 frontmatter(기존 novelstudio:qa-json 블록 유지 + 상단에 입력해시):

```yaml
qa:
  type: lexicon
  verdict: fail
  input_hashes:
    "scenes/scene-02.md": "sha256:..."   # 이 scene 기준으로 판정됨
```

revision task 파일:

```yaml
id: task-001
from_issue: {report: lexicon, index: 0}
title: "'시선' scene-02 집중 과용"
severity: fail
status: open            # open | in_progress | fixed | wontfix | false_positive
procedural_fix:         # ★ 금지 아님, 대체 전략
  - "무심코 반복 → 손의 행동/거리 변화/업무적 판단으로 치환"
  - "의도 반복이면 [의도] 표시 후 유지"
resolved_by_snapshot: null
```

- **증분 QA**: `run_episode_qa`가 scene hash를 `cache.json`과 대조 → 변경된 scene만 재실행. 300화 운영 비용/지연을 실질적으로 낮춤.
- **폐루프**: 재QA 시 이전 issue가 재검출 안 되면 연결된 task를 `fixed`로 자동 close(감사 로그 남김).

### 5.5 Plot 단일원천 — scene frontmatter에서 derive

grid/canvas/timeline이 각자 저장하지 않는다. **scene frontmatter를 유일 원천**으로 두고 나머지는 파생 뷰.

scene frontmatter 확장(05.4에 `beats`·`order` 추가):

```yaml
order: 3
plotlines: [main, eira-arc, medical-risk]
beats:
  main: interview
  eira-arc: data-first
  medical-risk: expose
tension: high
timeline: arc1-day4-evening
reveals: [guild-medical-vacancy]     # canon fact id
foreshadows: []
```

- **Plot Grid**: 모든 scene frontmatter를 읽어 행렬 렌더. cell 편집 = 해당 scene의 `beats.<plotline>` 쓰기.
- **Canvas/Mermaid**: `reveals/foreshadows/plotlines`에서 엣지 생성. 수동 배치는 `canvas/layout-arc1.json`(좌표만) 오버레이.
- **Timeline**: scene의 `timeline` 필드 집계. 별도 event 파일은 "회차와 무관한 세계관 사건"에만 사용.
- 결과: 어디를 고쳐도 진실은 한 곳(frontmatter), integrity check가 "grid≠frontmatter" 같은 모순을 원천적으로 만들지 않음.

### 5.6 Commit 원자성 — `.novelctl/commits/`

```text
.novelctl/commits/
  ep012_20260701-120000/
    journal.json     # 계획된 쓰기 목록 + 파일별 상태
    staged/          # 새 버전을 먼저 여기에 기록
```

`journal.json`:

```json
{
  "episode": "012",
  "planned": [
    {"path": "story/chapters/ep012/04_summary.md", "status": "pending"},
    {"path": "canon/facts/guild-medical-vacancy.md", "status": "pending"},
    {"path": "plot/open-threads.md", "status": "pending"},
    {"path": "context/character-states.md", "status": "pending"}
  ],
  "snapshotBefore": "snapshots/ep012/...-before-commit/"
}
```

- 절차: **before-snapshot → staged/에 전량 기록 → 검증(schema/hash) → atomic move → journal done**.
- crash 시 다음 실행에서 journal 발견 → "미완료 커밋 재개/롤백" 제시. archivist는 journal-aware, locked fact는 절대 덮지 않음.

### 5.7 Notes lifecycle — `notes/`

```text
notes/
  inbox/       candidate/       attached/
  archive/used/     archive/rejected/
```

note frontmatter(state machine):

```yaml
id: note-20260701-0007
kind: idea            # idea | memo | snippet | research
state: candidate      # inbox | candidate | attached | used | rejected
attached_to: []       # 예: [story/chapters/ep013/00_brief.md]
promoted_to: null     # canon fact id (promoted-canon 시)
created_at: "2026-07-01T09:00:00+09:00"
```

- 전이: `inbox → candidate → attached → used`(본문 반영) 또는 `rejected`. `promoted-canon`은 canon fact 생성 + `promoted_to`에 id 기록.
- 커맨드: `note→brief`(선택 노트들을 다음 회차 brief 초안으로), `note→scene candidate`(노트 기반 장면 후보 생성, candidate/diff 경유). Pensieve식 흐름을 파일로 실현.

### 5.8 Export/Compile — `exports/`

```text
exports/
  profiles/
    munpia.yaml  kakaopage.yaml  series.yaml  epub.yaml
  build/
    ep001-050.txt
```

profile 예시(`munpia.yaml`):

```yaml
platform: munpia
target_chars_per_episode: 5500
chapter_break: "\n\n───\n\n"
include_author_note: true          # 후기 포함
author_note_source: "stages/author-note.md"
frontmatter: strip                 # 내보낼 때 frontmatter 제거
heading_style: "제{n}화 {title}"
```

- 커맨드: `novelctl compile --profile munpia --range 1-50 --out exports/build/`. final(=`stages/final.md`)만 이어붙이고 profile 규칙 적용.
- EPUB profile은 v1.2. 전부 로컬 산출, 원본 훼손 없음.

### 5.9 기타 파생/분석 폴더

```text
analysis/
  project/
    tics.md                 # cross-episode 문체 틱(과용 묘사, 회차 마무리 비트)
    repetition-global.json  # 전 연재 반복 집계
    baseline.json           # 개인 문체 기준선(잘 쓴 회차 표본)
  personas.yaml             # reader-review 페르소나 설정
```

---

## 6. 에이전트 개선안

> 기존 15 agent를 삭제하지 않고 입출력·scope·금지·품질기준을 명시화하고, 로컬로 대체 가능한 계산은 agent에서 분리한다. `write` scope는 novelctl에서 **강제**한다(16.5).

| Agent | 기존 역할 | 개선 역할 | 입력 파일 | 출력 파일 | 금지사항 | 품질 기준 |
|---|---|---|---|---|---|---|
| context-architect | context pack 생성 | tier·토큰예산·delta·source_hash 포함 pack 생성 | brief, story-so-far, context/recent/*, canon/facts/*, open-threads, character-states, style | `01_context-pack.md` (+tier frontmatter) | 전체 canon 무차별 주입, reveal-later 노출, 원고 수정 | 예산 내 수용, 필수 tier 누락 0, delta 정확, 창작 여지 보존 |
| episode-planner | scene plan 생성 | + 최근 회차 scene function 이력 참조해 **패턴 변주** 유도 | context-pack, scene-pattern 최근 이력 | `02_scene-plan.md` | manuscript 생성/수정, 과도한 beat 확정 | 최근 3화와 구조 중복 경고 반영, plotline 커버리지 |
| prose-drafter | 초안 작성 | 창의성 高로 초안, **scene 단위 출력 옵션** | context-pack, scene-plan | `.novelctl/runs/<id>/draft*.md` (candidate) | final/manuscript 직접 쓰기, 레퍼런스 복제 | 장면 구현>설명, 목소리 구분, canon envelope 준수 |
| summarizer | 요약 | 회차 요약 + **arc-summary delta** 이중 산출 | manuscript/final | `04_summary.md`, `context/recent/epXXX.md` | 원문 수정, 설정 창작 | 사실 정확, 길이 예산, 다음 화 훅 1개 명시 |
| canon-extractor | canon delta 추출 | **fact 스키마 후보**로 출력(state 미정) | final, summary | `05_canon-delta.md`(fact candidates) | canon 파일 직접 apply, locked 변경 | 근거 회차 인용, 중복 fact 감지, 과잉추출 억제 |
| plot-qa | 플롯 QA | scene 단위 + input_hash 캐시 | final, brief, outline, open-threads | `qa/plot.md` | 원고 수정, 점수만 반환 | 구조 결함 위치 지정, **절차적 대안 필수** |
| continuity-qa | 설정/타임라인 QA | + progression↔timeline 모순 검사 | final, canon/facts, timeline, characters, progression | `qa/continuity.md` | 원고 수정 | 모순에 근거 fact id, false-positive 최소 |
| style-qa | 문체 QA | baseline 대비 이탈 + 원천오염 탐지 | final, reference-profile, baseline.json | `qa/style.md` | 장르/소재를 문체로 오판, 원고 수정 | 매치/불일치 trait 분리, rewrite 방향 제시 |
| voice-qa | 말투 QA | **voice fingerprint 입력**으로 데이터 기반 판정 | final, speech rules, voice fingerprint(로컬) | `qa/voice.md` | "절대 하지마" 식 금지 명령 | 과용 패턴을 장면 기능 재배치로 제안 |
| lexicon-qa | 반복/단어 QA | 로컬 repetition 결과 위 판정만(계산은 로컬) | repetition JSON, watch terms | `qa/lexicon.md` | 단순 금지, 원고 수정 | 의도/무심코/말버릇/후렴 4분류, 대체 전략 |
| scene-pattern-qa | 장면 구조 반복 QA | 최근 요약 패턴 토큰화 비교 | summary, 이전 summaries | `qa/scene-pattern.md` | 원고 수정 | 반복 회차 명시 + 절차적 변주안 |
| revision-director | 수정 지시서 | QA 이슈를 **task 파일**로 구조화 매핑 | 모든 qa/*, tasks 상태 | `12_revision-plan.md`, `qa/tasks/*.md` | 원고 직접 수정 | 이슈↔task 1:1, 우선순위·대체전략 포함 |
| prose-rewriter | 최종 수정 | **range-anchored patch만** 출력(full-file 금지) | manuscript, revision-plan/tasks | `.novelctl/runs/<id>/patch.md` (candidate) | manuscript/final blind overwrite | 지정 구간만 변경, diff 검토 가능, 목소리 유지 |
| archivist | 상태 갱신 후보 | **journal-aware**, 후보만 생성 | summary, canon-delta, final | state update candidates(→journal) | locked canon 덮기, 승인 없이 apply | 후보에 근거, 원자성 준수 |
| reader-reviewer | 독자 리뷰 | persona 설정 파일 기반 | final, 이전 summary, personas.yaml | `analysis/reader-review.md` | QA verdict로 혼동, 원고 수정 | persona별 초점 준수, "다음 화 당길 요소" 필수 |
| **style-profiler** (신규) | — | 작가 표본 회차에서 reference-profile 생성 | 작가 지정 best 회차들 | `style/reference-profile.md`(candidate) | 특정 문장 복제, 소재를 문체로 | 추상 trait만, 표본 대표성 |
| **thread-auditor** (신규, 로컬+AI) | — | open-thread 방치·미회수 foreshadow 감사 | open-threads, scene reveals/foreshadows | `analysis/project/thread-audit.md` | 원고 수정 | 방치 화수 정확, payoff 누락 탐지 |

> **로컬로 분리(agent 아님)**: repetition/rhythm/word-count/mention-scan/voice fingerprint 집계/distribution/baseline 계산. AI 비용 없이 결정적으로 돌린다(12.9 표 준수·확장).

---

## 7. 최종 권장 로드맵 (Phase 0 ~ Phase 10)

> 기존 18의 Phase 0~9를 보존·재정렬한다. 핵심 변경: **Context Pack(R1)·Commit 원자성(R5)·단일 현재본(R3)·QA 폐루프(R4)** 를 앞으로 당긴다. 장기연재 신뢰는 후반이 아니라 초중반에 확보해야 하기 때문이다.

### Phase 0 — novelctl `--json` + 로컬 분석 + 스냅샷 + 스테이지 매니페스트
- **목표**: GUI가 호출할 결정적 core 확립. 파이프라인 탈결합의 토대.
- **구현**: `--json`/exit code 표준화; repetition·rhythm·mention·distribution 로컬 구현; snapshot 커맨드; `index.md`의 `pipeline` manifest + `manuscript.md` 규약; mock mode.
- **완료 기준**: `init/context/draft/qa/revise/commit/status/snapshot --json` 동작 + manifest 읽기/쓰기.
- **의존성**: 이후 모든 Phase의 계약.
- **리스크**: JSON 스키마가 나중에 바뀌면 전체 파급 → schema 버전 필드 + golden fixture로 고정.

### Phase 1 — Tauri Shell + 프로젝트 열기 + 트리 + 환경검사
- **목표**: 로컬 프로젝트를 열고 파일을 본다.
- **구현**: Tauri+SvelteKit; launcher; folder open; **path-traversal 검사(shell 강제)**; env check(gemini/novelctl/git); tree scan.
- **완료 기준**: 프로젝트를 열고 트리를 본다 + root 밖 접근 차단 테스트 통과.
- **의존성**: Phase 0 core.
- **리스크**: 대형 프로젝트 스캔 지연 → 증분 인덱싱·백그라운드 rebuild.

### Phase 2 — Markdown Editor MVP + 단일 현재본
- **목표**: 회차 본문을 편집·저장한다(정체성 고정).
- **구현**: CodeMirror6; `manuscript.md` 단일 편집 대상; frontmatter parse/fold; autosave(2s debounce, AI 실행 전 저장); dirty; split preview; word count; **IME compositionend 규약 테스트**.
- **완료 기준**: 한글 IME 안정 + 저장/외부변경 충돌 처리 통과.
- **의존성**: Phase 1.
- **리스크**: decoration×IME 충돌 → viewport-only + composition 중 filter 금지.

### Phase 3 — Episode Workspace + Job Console + Commit 원자성
- **목표**: 버튼으로 context/draft/summary/qa/revise/commit 실행, 커밋이 안전하다.
- **구현**: 탭 + 상태기반 단일 CTA; job console(event bus); high-level Tauri 커맨드; **commit journal(staged→verify→atomic move)**; `입력 패키지 보기`.
- **완료 기준**: 커밋 중 강제종료 후 재개/롤백 성공(golden test).
- **의존성**: Phase 0·2.
- **리스크**: 다중파일 실패 경로 누락 → journal 상태기계 테스트 필수.

### Phase 4 — Context Pack v2 (계층·예산·delta·stale) ★앞당김
- **목표**: 장기기억을 결정적으로 만든다.
- **구현**: `context/` tier 폴더; context-pack frontmatter(tier/budget/source_hashes/delta); stale 배지; 예산초과 시 tier 강등.
- **완료 기준**: 소스 변경 시 stale 감지 + 예산 내 pack 생성(50화 fixture 검증).
- **의존성**: Phase 3(커밋에서 recent/state 갱신).
- **리스크**: 요약 품질이 낮으면 장기 붕괴 → summarizer 품질기준·golden 요약 비교.

### Phase 5 — QA Dashboard + revision task 폐루프 + 증분 QA
- **목표**: QA가 판정이 아니라 작업 큐가 된다.
- **구현**: qa-json 파싱; verdict 우선 카드; issue→`qa/tasks/` 승격; `cache.json` scene-hash 증분 QA; diagnostics 데코; 재QA 자동 close.
- **완료 기준**: 변경 scene만 재QA + 해결 이슈 자동 close 확인.
- **의존성**: Phase 3·4.
- **리스크**: 점수 재부각으로 점수놀이 → UI에서 점수 보조화 유지.

### Phase 6 — Snapshot/Diff + hunk 단위 적용
- **목표**: AI 수정 전후를 안전하게 hunk 단위로 다룬다.
- **구현**: snapshot create/list/restore(pre-restore snapshot); diff viewer; **hunk apply**; stale candidate 차단; pruning 정책.
- **완료 기준**: full-file rewrite도 구간별 수락/거부 가능.
- **의존성**: Phase 2·3.
- **리스크**: 스냅샷 용량 증가 → 최근 N + before-commit 영구 정책.

### Phase 7 — Analysis Widgets (회차내 + cross-episode)
- **목표**: 뮤블식 반복/밀도 + 연재 전체 틱을 본다.
- **구현**: Repetition Map(4모드, 판정 4분류, 범위 토글); Rhythm/Density + baseline; `analysis/project/tics.md`; reader-review 패널(personas.yaml).
- **완료 기준**: 회차/최근5화/전체 범위 전환 + baseline 이탈 표시.
- **의존성**: Phase 0 로컬 분석.
- **리스크**: 지표 과적합→밋밋한 문장 유도 → intentional 마킹·분포 표시·제안 optional 유지.

### Phase 8 — Codex + Dynamic Links + progression + canon fact 구조화
- **목표**: 본문 설정명 자동감지·연결, 설정을 fact로 잠근다.
- **구현**: codex index/alias editor; mention scanner + confidence + hover; safe apply(일괄 재검토 뷰); `canon/facts/` 구조화 + canon-delta apply 연결; progression↔timeline 체크.
- **완료 기준**: 조사 결합/짧은 alias golden 통과 + locked fact 변경 시도 감지.
- **의존성**: Phase 3·5·6.
- **리스크**: alias 오탐 → min_length·auto_link·ambiguous 재검토 강제.

### Phase 9 — Plot Board/Grid/Canvas + Timeline + Thread Auditor
- **목표**: 장면/플롯을 카드·표·그래프로, 단일원천에서.
- **구현**: Board(drag=order); Grid(frontmatter beats 인라인 편집); Mermaid canvas(derive, export); timeline; thread-auditor 리포트.
- **완료 기준**: 어느 뷰에서 고쳐도 scene frontmatter 한 곳만 바뀜 + grid≠frontmatter 모순 0.
- **의존성**: Phase 8(reveals=fact id), Phase 5(grid QA 경고).
- **리스크**: 뷰가 또 다른 진실원이 됨 → derive-only·레이아웃만 별도 저장.

### Phase 10 — Export/Compile + Packaging + Migration
- **목표**: 연재 실무 산출 + 설치형 배포.
- **구현**: `exports/profiles/*`(문피아/카카페/시리즈) + `compile` 커맨드; Tauri bundle(mac 우선); bundled novelctl(v1); 파일기반 migration(계획 먼저 표시); backup ZIP(public-safe).
- **완료 기준**: 1~50화를 플랫폼 포맷으로 내보내고 설치 패키지 생성.
- **의존성**: 전 Phase(안정된 파일 구조 위에서).
- **리스크**: Python 패키징 난이도 → MVP 외부 novelctl→v1 번들 단계적(17.6 준수).

### 2주 첫 마일스톤 (현실 범위 재조정)
1. Phase 0 core(`--json`+snapshot+manifest) → 2. Tauri shell+open+tree → 3. CodeMirror `manuscript.md` 편집/저장 → 4. `status`/`qa`(mock) 실행 + job console → 5. snapshot create/list.
**Context Pack v2·Commit journal은 그 다음 스프린트 최우선.** 이 둘이 이 제품을 "마크다운 에디터"에서 "연재 하네스"로 바꾸는 분기점이다.

---

## 부록 A. 기존 컨셉 보존 확인

이 리뷰는 다음을 **삭제하지 않았다**: numbered 파이프라인 파일(로그로 보존), setting-bible.md(개요로 보존), 15 agent 전원, QA/Analysis 분리, Mermaid→JSON→Obsidian canvas 3단계, privacy modes, creativity 파라미터, snapshot/git optional, SQLite=cache 원칙, Muvel/Scrivener/Novelcrafter/Sudowrite/Plottr/Campfire 벤치마크 매핑. 모든 개선은 **추가·구조화·절차화**이며, 새 강제 금지는 없다(canon lock·path sandbox는 기존 규칙의 데이터화일 뿐).
