# state.md — 현재 인수인계 상태

## 2026-07-10 UI 작업실 개편 · CTA 전수 감사 · 번들 병목 제거

- 기준점: 작업트리가 깨끗한 `38615c91`에서 시작했다.
- 셸: 상단 한 줄 탭을 208px 작업 레일로 교체했다. 진행/설계/프로젝트 그룹, 간단/설계자 전환,
  48px 문맥 헤더, surface 로딩/오류 상태를 제공한다. 980px 이하는 가로 작업 스트립으로 바뀐다.
- 홈: 다음 행동을 왼쪽에 유지하고 AI 연결/바이블/플롯/현재 회차/보류/월 사용량을 오른쪽 상태 원장에
  배치했다. 시작 화면은 제품 맥락/최근 작품/새 작품 3영역으로 재구성했다.
- 성능: Home 외 12개 surface를 동적 import하고 CodeMirror/Lezer를 청크 분리했다. 초기 JS는
  883.40kB에서 234.06kB로 73.5% 감소했고 기존 500kB 경고가 사라졌다.
- CTA: `npm run qa:ui-contract`가 Svelte 22파일의 버튼 175개(174 onclick + form submit 1)를 확인하고
  연결 없는 버튼 0개를 단언한다. dev 런타임은 13화면/본문 CTA 86개, 콘솔 오류 0, 이름 없는 버튼 0.
- 반응형: 390/768/1280px에서 13개 화면 전체 진입, 문서/작업면 수평 overflow 0. 390px에서도
  간단/설계자 전환과 작품 바꾸기 CTA를 유지한다.
- agy: 직접 `agy -model gemini-3.5-flash -p ...` exit 0(8.46초), 앱 내 연결 테스트 exit 0
  (7.525초, `BINDERY-OK`). 최종 설치 앱의 Tauri 경로도 exit 0(9.394초, `BINDERY-OK`).
- 패키지 병목: 설치 앱에서 Medallion 열기 프리즈를 재현하고 main-thread sample로 동기 `fs_op`의
  `read_to_string` 정지를 확인했다. `fs_op`/`scaffold`를 `spawn_blocking` async command로 바꿔
  파일-provider가 지연돼도 UI가 반응하고 15초 뒤 시작 화면으로 복귀한다.
- standalone: 최종 소스로 재빌드해 `/Applications/Bindery.app`에 설치했고 strict codesign, 로컬
  프로젝트 홈/설정 클릭스루, agy 연결을 통과했다. Rust test는 3/3이다. 상세:
  `docs/UI_CTA_PERFORMANCE_REVIEW_20260710.md`.

## 2026-07-10 단일 후보 · 병렬 QA · 네이티브 스트리밍 · 구조화 ZIP · 프로젝트 열기 UX

- 생성량: 간단 모드의 소재·회차 집필은 후보를 기본 3개에서 **집필안 1개**로 줄였다. 설계자
  모드는 회차 후보 수를 직접 늘릴 수 있다. 오프라인 기획 채택도 로컬 바이블을 먼저 적용한 뒤
  플롯으로 이어져 빈 바이블 입력을 만들지 않는다.
- QA: 문체·연속성·정사 3종을 `Promise.all`로 병렬 실행한다. AI 호출은 병렬이지만 run index와
  usage 원장 갱신은 큐로 직렬화해 동시 read-modify-write 유실을 막았다. 다중 실행 상태와 전체
  취소 UI, 실제 1초 경과 타이머를 추가했다.
- 스트리밍: 패키지 앱도 Tauri `Channel<Value>` 기반 `run_agent_stream`을 사용한다. Rust command는
  `spawn_blocking`에서 stdout/stderr를 동시에 비우고 line event를 보내므로 UI IPC와 cancel이
  실행 중에도 응답한다. 프로젝트+label 조합으로 실행을 구분한다.
- 테스트 AI: Gemini 프리셋은 `agy -model`을 사용한다. `gemini-3.5-flash` 실제 실행으로 아이디어
  스키마 후보 1개를 13.7초에 받았고 stream event(status 1/stdout 6/done 1)를 확인했다. Codex는
  일반 작품 폴더에서도 실행되도록 `--skip-git-repo-check`를 기본 인자에 넣었다. Tauri는 Finder
  PATH 제약을 보완해 `~/.local/bin/agy` 등 사용자 설치 CLI를 절대경로로 해석한다.
- ZIP: 50MB/500엔트리/엔트리당 2MB/텍스트 합계 20MB/전체 원문 200만자 제한, 진행률·취소,
  이벤트 루프 양보를 추가했다. canon 설정+world/plot 역할이 있는 ZIP은 구조화 패키지로 판정해
  snapshot 후 canonical/imported 경로에 가져오고 바이블·플롯 준비로 연결한다.
- 프로젝트 열기: 네이티브 폴더 선택, 최근 항목 삭제, 일반 폴더 확인, 15초 timeout 뒤 늦게 끝난
  요청 무효화, 새로고침 오류 배너·재시도, 기존 비어 있지 않은 폴더 scaffold 거부를 추가했다.
- 검증: `npm run check` 0/0, `npm test` 73/73, Rust test 2/2, `npm run build` OK,
  `npm run tauri:build:mac:standalone` OK, codesign strict verify OK, 새 번들 launch process 확인.
  디자인 간격 검사도 통과했다. 실제 앱 시각 캡처는 Mac 잠금으로 이번 세션에서만 미완료다.

## 2026-07-07 프로젝트 열기 성능 패치 · standalone 재빌드

- 프로젝트 열기: `openProjectByPath`/`createProjectAt`가 메타와 설정만 먼저 읽고 곧바로 셸로
  진입한다. 무거운 `refreshAll`은 후행 작업으로 돌려 열기 버튼이 전체 파일 해시 계산을 기다리지 않는다.
- 초기 새로고침: `refreshAll({ deferDigest: true })` 경로를 추가해 UI 데이터(tree/ideas/proposals/
  plot/episodes/progress/snapshots/candidates/usage)를 먼저 채우고, 외부 변경 감지 기준선 digest는
  백그라운드에서 계산한다. 포커스 복귀/수동 새로고침은 기존처럼 digest 비교로 외부 변경을 알린다.
- 스캔 비용 절감: 초기 refresh가 같은 파일 트리를 여러 번 만들지 않도록 `listIdeas`/`listEpisodes`가
  이미 읽은 tree를 재사용한다. digest 파일 읽기는 동시성 4개로 제한해 `~/Documents` 파일-provider가
  한꺼번에 몰리며 수십 초 지연되는 현상을 줄였다.
- 빌드 산출물 제외: Tauri Rust walker와 dev bridge walker가 `target`, `dist`, `build`, `.superloopy`,
  `.svelte-kit`, `.bindery/{artifacts,backups,runs,snapshots,trace}`, `exports`를 프로젝트 트리에서
  제외한다. 저장소 루트를 실수로 작품으로 열어도 `src-tauri/target` 2.1GB를 밟지 않는다.
- 검증: `npx vitest run tests/projectChanges.test.ts` 3/3 · `npm run check` 0 오류 · `cargo check` OK ·
  `npm test` 67/67 · `npm run tauri:build:mac:standalone` OK · `codesign --verify --deep --strict` OK ·
  새 `Bindery.app` launch process 확인 후 종료. 초기 tree-only 측정: Medallion 22개 텍스트 파일 29ms,
  repo root 841개 텍스트 파일 1.2s(빌드 산출물 제외 후).

## 2026-07-07 제품화 잔여 반영: DOCX · 백업 복원 · 품질 게이트 · 외부 변경 가드

- 기준: `docs/PRODUCT_READINESS_REVIEW_20260707.md`를 현재 구현 상태로 재정리하고, 로컬에서
  끝낼 수 있는 P1 잔여를 추가 반영했다.
- 완성물 내보내기: 「내보내기」 탭에 Word 문서(.docx) 다운로드 추가. Markdown/TXT는
  `exports/` 저장+다운로드, EPUB/DOCX는 Blob 다운로드(`exportManuscript.ts::buildDocx`).
- 프로젝트 백업: 기존 [전체 백업(.zip)]에 [백업 복원(.zip)] 추가. Bindery store-zip의 안전한
  텍스트 엔트리만 preview 후 현재 프로젝트에 반영하고, 경로 탈출·macOS 메타·캐시·비텍스트는
  건너뜀. 덮어쓰기 전 snapshot과 방금 복원 rollback 제공
  (`backup.ts::previewProjectRestore/restoreProjectBackup/rollbackProjectRestore`).
- AI 품질 안전장치: `quality.ts` 추가. 후보 원고의 placeholder/fallback/반복/금지어/필수어 누락을
  결정적으로 점검하고 후보 메타(`qualityStatus`, `qualityIssues`)와 UI에 표시.
- 외부 변경 감지: `projectChanges.ts` 추가. 창 포커스 시 source-of-truth 텍스트 파일 해시를 비교해
  상단바에 외부 변경 건수를 표시하고, 파일 화면/집필/회차 원고 저장은 디스크 쪽 파일이 바뀌었으면
  확인 후 덮어쓰며 외부 변경본을 snapshot으로 남김.
- 검증: focused 백업/내보내기/품질/외부변경 20/20 · check 0 · test 67/67 · build OK · standalone 재빌드 OK ·
  codesign verify OK · 내보내기+외부 변경 1280/768/390 시각 QA PASS.

## 2026-07-07 agy 프리셋 · /usage 실사용량 · 백업 · 포커스 새로고침

- Gemini 프리셋 기본값: command `agy`, 모델 플래그 `-model` (`agentSettings.ts`).
- 실제 사용량: 설정 [/usage 불러오기] → 기본 실행기로 `/usage` 실행, 결과 원문을
  `.bindery/provider-usage.json`에 저장·표시(`usage.ts::fetchProviderUsage`). agy는
  대화형 슬래시라 `-p` 비대화 호출 시 실수치 대신 도움말이 올 수 있음 — 받은 대로 표시.
- 프로젝트 백업: 「내보내기」 탭 [전체 백업(.zip)] — 진실 텍스트 전체 store-zip, 캐시 제외.
  이후 [백업 복원(.zip)]까지 확장됨(`backup.ts`). 창 포커스 시 자동 새로고침(App.svelte, watch 대체).
- 검증 당시: check 0 · test 57/57 · build OK · 백업 unzip 검증 · agy 클릭스루. 최신 검증은 상단 항목.


## 2026-07-07 제품화 P0 반영 (비용 가시성·내보내기·온보딩)

- 점검 문서 `docs/PRODUCT_READINESS_REVIEW_20260707.md`의 P0 3종 구현:
  - 비용 가시성 `usage.ts` — 토큰 추정 + 단가표(설정 편집) + `.bindery/usage.json` 원장(러너
    훅) + 이번달/누적/회차별/월별 집계. 상단바 게이지 + 설정 대시보드 + 예산 상한/경고.
  - 내보내기 `exportManuscript.ts` + 신규 「내보내기」 탭 — 합본 .md/.txt(exports/ 저장+다운로드),
    EPUB/DOCX(무의존 store-zip+CRC32), 회차 클립보드 복사.
  - CLI 온보딩 — 설정 연결 상태 배너 4단계 + 설치 가이드 + 실패 원인 번역, 집필 후보의
    로컬 뼈대 여부를 붉은 배너로 결과에 직접 연결.
- 검증: check 0오류 · test 55/55 · build OK · EPUB unzip CRC 통과 · dev 클릭스루. 상세 log.md.
- 미반영(P1+): 자동 업데이트·공증/배포, 실제 AI 골든셋, 네이티브 watch/diff merge UI,
  벡터 RAG, 관리형 수익화.


## 2026-07-07 문체 재현 시스템 (「문체」 탭)

- 레거시 style_system 준용·개선: 한/일 원문 → 장면 분해(로컬) → `style-analysis` 스테이지가
  한국어 문체 프로필 종합(전역 분위기·규칙 + 장면 유형별 특징·인용 + 금지 + 복제 금지
  고유명사) → 프리셋 저장(`style/presets/*.json`) → 적용 시 `style/style-guide.md` 렌더
  (스냅샷 선행) → 집필/수정 후보 생성 시 `buildStyleCapsule`이 이번 화 장면 계획과
  유형 매칭된 오버레이만 캡슐로 주입(`.bindery/artifacts/<ep>/style-capsule.md` 감사).
- 프리셋 다중 저장/적용/해제/삭제 + 이력(`style/history.json`) 관리. UI는 신규 「문체」 탭
  (간단·설계자 공통). 집필 근거 라인에 적용 문체 표시.
- 검증: check 0오류 · test 41/41 · build OK · 실 CLI(gemini) 분석→저장→적용 클릭스루.
  상세 log.md.

## 2026-07-06 zip 압축 해제 WebView fallback

- macOS 앱 WebView에서 `DecompressionStream('deflate-raw')` 지원이 없거나 불완전하면 deflated zip
  엔트리가 `zip-error`로 건너뛰어지는 문제를 막기 위해 `sourceUploads.ts`에 순수 JS raw deflate
  fallback을 추가했다.
- zip 중앙 디렉터리/경로 정규화/텍스트 엔트리 선별 계약은 유지하고, 압축 해제만
  `DecompressionStream` 우선 + local fallback 순서로 처리한다. 새 production dependency는 추가하지 않았다.
- 검증: `npx vitest run tests/sourceUploads.test.ts` 4/4(`DecompressionStream` 없는 런타임 포함) ·
  `npm run check` 0 오류 · `npm test` 32/32 · `npm run tauri:build:mac:standalone` OK ·
  `/Applications/Bindery.app` 최신 빌드 교체 및 `codesign --verify --deep --strict` OK · 앱 실행 프로세스 확인.

## 2026-07-06 최초 기획 자료 zip 및 무제한 업로드

- 홈의 최초 [AI에게 기획 맡기기] 자료 업로드가 앱 차원의 파일 개수 제한 없이 동작하도록 바뀌었다.
  기존 3개 제한과 [파일 추가] 비활성 조건을 제거했다.
- `.zip` 파일을 추가하면 내부 텍스트 엔트리(`.txt`, `.md`, `.json`, `.yaml`, `.csv`, `.tsv`, `.log`,
  `.rtf`, `.xml`, `.html`)를 자동으로 펼쳐 일반 자료 파일처럼 목록에 넣는다. 경로 탈출, macOS 메타
  파일, 비텍스트 엔트리는 건너뛴다.
- 원문 저장/프롬프트 폭주 방지 계약은 유지한다. 각 자료는 앱 입력 한도 안에서 `notes/source-raw.md`에
  저장되고, 기획 후보 프롬프트에는 제한된 발췌만 들어간다.
- 검증: `npx vitest run tests/sourceUploads.test.ts` 3/3 · `npm run check` 0 오류 · `npm test` 31/31 ·
  `npm run build` OK(기존 chunk-size warning 유지).
- 브라우저 QA: Playwright Chromium에서 zip 1개(텍스트 2개 + 비텍스트 1개)와 별도 텍스트 5개를 업로드해
  총 7개 행 표시를 확인했다. 390/768/1280px 스크린샷 및 QA 기록:
  `.superloopy/evidence/frontend/20260706T2034-source-zip-unlimited-upload/VISUAL_QA.md`.

## 2026-07-06 레거시 아이콘 적용 및 재빌드

- 현재 Tauri 앱 아이콘을 레거시 Bindery 아이콘 세트와 동일하게 맞췄다.
  원본: `/Users/tofu/HermesWorkspace/project/Bindery/apps/desktop/src-tauri/icons/`.
- `src-tauri/icons/`에 32/128/256/1024 PNG, macOS `icon.icns`, Windows `icon.ico`를 복사하고
  `src-tauri/tauri.conf.json`의 `bundle.icon`에 명시했다.
- macOS standalone 재빌드 명령은 `npm run tauri:build:mac:standalone`이다. `tauri build --bundles app`
  뒤에 `Bindery.app`을 ad-hoc 서명해 `codesign --verify --deep --strict`가 통과하는 번들을 만든다.
- 검증: `npx vitest run tests/sourceUploads.test.ts` 3/3 · `npm run check` 0 오류 · `npm test` 31/31 ·
  `npm run tauri:build:mac:standalone` OK(기존 chunk-size warning 유지) ·
  `codesign --verify --deep --strict --verbose=2 src-tauri/target/release/bundle/macos/Bindery.app` OK.

## 2026-07-06 최초 기획 자료 업로드

- 홈의 최초 [AI에게 기획 맡기기] 흐름에 [자료 파일] 업로드 메뉴를 추가했다. 텍스트 기반 파일
  최대 3개를 붙일 수 있고, 선택한 파일은 이름/크기/글자 수로 표시하며 개별 삭제 또는 전체 비우기가 가능하다.
- 실행 시 업로드 원문은 `notes/source-raw.md`에 저장되고, 기획 후보 생성 프롬프트에는 자료 요약이 함께 들어간다.
  프롬프트에는 길이 제한을 둬 과도한 입력을 막고, 저장 파일에는 앱 입력 한도 안의 원문을 남긴다.
- 기획을 채택하면 임시 업로드 목록은 비운다. 후보를 취소하거나 다시 만들 때는 같은 자료로 재실행할 수 있다.
- 검증: `npm run check` 0 오류 · `npm test` 28/28 · `npm run build` OK(기존 chunk-size warning 유지) ·
  브라우저 업로드 클릭스루 390/768/1280px PASS.
  증거: `.superloopy/evidence/frontend/20260706T104835-initial-source-upload/VISUAL_QA.md`.

## 2026-07-06 프로젝트 선택 복귀 UX

- 상단바의 현재 작품 옆에 [작품 선택] 버튼을 추가했다. 열린 작품에서 시작 화면(ProjectPicker)으로
  돌아가 최근 작품/폴더 열기/새 작품 생성 흐름을 다시 사용할 수 있다.
- `returnToProjectPicker()`는 프로젝트별 UI 캐시, run 선택, 후보/제안/트리 상태를 초기화하고
  최근 작품 목록은 보존한다. AI/파일 작업이 실행 중일 때는 복귀를 막고 안내 토스트를 띄운다.
- 같은 프로젝트 안에서 새로 쓰는 진입점도 추가했다. 홈 보조 액션 [같은 작품에서 epXXX 처음부터 쓰기]는
  필요한 회차 스캐폴드와 바이블/플롯 row를 준비한 뒤 초안 후보 생성으로 보낸다. 이미 원고가 있는
  집필 화면에는 [처음부터 새 후보 만들기]를 노출해 현재 원고를 보존한 채 설계와 후보만 다시 만든다.
- 검증: `npm run check` 0 오류 · `npm test` 28/28 · `npm run build` OK(기존 chunk-size warning 유지) ·
  브라우저 클릭스루 390/768/1280px PASS.
  증거: `.superloopy/evidence/frontend/2026-07-06T10-27-32-236Z-project-switch-and-fresh-write/VISUAL_QA.md`.

## 2026-07-06 토큰 라우터 + 모델 티어 라우팅

- 기준: `bindery_ai_harness_final_lite_detail_design.md`. 1화 사전 토큰 절감 구조 구현:
  - `contextPack.ts` — 로컬 정적 선별(섹션 분할 + 플롯 row/요약/메모 질의어 스코어 +
    문자 예산 pruning + included/excluded manifest). AI를 쓰지 않는 1차 필터.
  - `context-distill` 스테이지 — 선별 팩이 기준(기본 3,000자)을 넘으면 경량 티어가
    집필 캡슐로 압축. 산출: `.bindery/artifacts/<ep>/context-{capsule.md,pack.json}`.
  - 브리프=선별 팩, 초안 후보=정제 캡슐이 기존 `{{bible}}` 슬롯을 대체.
  - 모델 티어: settings `profiles{light,heavy}` + `stageTiers`(5그룹) →
    `Ctx.agentFor(stage)`로 러너가 스테이지별 CLI/모델 선택. 설정 UI에 라우팅/예산 섹션.
  - 집필 "생성 근거 보기"에 팩 manifest(포함/제외/사유/압축률) 표시.
- 검증: check 0오류 · test 28/28 · build OK · 설정/근거 UI 클릭스루. 상세 log.md.
- 남은 후보: FTS/벡터 검색 계층, branch/lineage, 그래프 스튜디오 (스코어러 교체 지점 분리됨).

## 2026-07-06 컨셉 정의서 반영 패스

- 기준: `bindery_ai_harness_concept_direction.md`. 엔진 변경 없음, Lite 표면 보강:
  - Context Pack 투명성 — 집필 화면에 "참고: … / 비어 있어 추정: …" 한 줄 +
    "생성 근거 보기"에 자료별 투입 방식/경로 목록 (`context.ts`의 `sources`).
  - 검토 결과에 QA 3관점 verdict 칩(통과/주의/수정 필요) 요약.
  - 시작 블록 soft-gap 프리플라이트(작품노트 채우기 vs AI 추정 진행), 원고 [이전본 복원].
  - 초안 후보·기획 후보를 세로 카드에서 전폭 행 리스트로, 원고 리더 66vh로 확대.
  - 시작 화면: 열기/생성 상태 분리, 열기 15초 타임아웃+권한 안내.
- 검증: check 0오류 · test 21/21 · build OK · dev 클릭스루(라이트/다크, 1280/375). 상세는 log.md.
- 주의: 프리뷰/자동화가 띄운 dev 서버는 macOS 권한 때문에 `~/Documents` 아래 프로젝트
  열람(`fs list`)이 매달릴 수 있다. 사용자 터미널 실행은 정상.

## 2026-07-05 신규 하네스 구축 (v0.1)

### 무엇이 있는가
- `/Users/tofu/Bindery`가 제품 저장소다 (git, main). 레거시(HermesWorkspace/project/Bindery)는
  참조로만 쓰였고 이번 작업의 수정 없이 원상태다.
- 스택: Vite 6 + Svelte 5 + TS + Tauri v2. `npm run dev`(포트 5199)가 dev 브리지(파일/CLI)를 포함한
  완전한 로컬 런타임이고, `npm run tauri:build:mac:standalone`이 macOS `Bindery.app`을 만들고
  ad-hoc 서명한다.
- 제품 루프 전체 구현: 소재(폴더 상태 보드) → 세계관 proposal → 승인 → 자산 파일 → 바이블
  후보/교체 → 플롯 제안/표 편집/회차 승인 → 브리프 → 장면 → 초안 후보 → diff hunk 적용
  (스냅샷) → 3관점 QA → 수정 계획(수용/기각) → 수정 후보 → 요약 → 정사 delta proposal →
  항목 승인/반영 → 픽스 → resume state → 다음 회차.
- 프롬프트 blueprint 18종(`prompts/`), 계약 검증(`src/lib/schemas/contracts.ts` + `schemas/*.json`),
  러너 단일 경로(repair 1회 + 정직한 폴백 + trace), proposal 레지스트리, 웹 AI 교환
  (idea/world/plot/brief/scene/draft/canon-delta 왕복).
- **UI는 이원 모드다 (2026-07-05 UX-first autopilot 개편).**
  기본은 간단 모드: 상단바 + 단일 작업면(최대 2단, 사이드바 없음), 메뉴
  홈|집필|작품노트|보류함|파일|설정. 홈은 다음 작업 센터(CTA 1개 + 한 줄 메모),
  집필은 기준→설계→초안→검토·수정→마감 레일 + 상황별 블록(바이블·플롯 준비/후보 카드/수정 체크리스트/마감 카드) + 실시간
  CLI 스트리밍(LiveRunPanel) + "생성 근거 보기". 설정에서 설계자 모드로 전환하면
  기존 파이프라인 화면(소재/세계관/플롯/회차/제안·정사)과 run 도크가 열린다.
- autopilot 레이어(src/lib/harness/{context,workflow,autopilot}.ts):
  기초자료 단일 로더(누락 보고), 상태→다음 행동 계산, stage 묶음 실행.
  soft output(브리프·장면 계획)은 autopilot 자동 승인, hard commit(원고 반영·canon
  변경·픽스·기획 채택)은 사람 버튼 전용. 현재 기본 후보는 집필안 1개다.
  기획 채택은 세계관 자산을 반영한 뒤 바이블을 적용하고, 그 바이블을 읽어 플롯을 짠다.
  AI 바이블 조립이 형식 문제로 실패하면 승인 자산 기반 로컬 바이블을 적용한다.
  라이트모드도 바이블 또는 현재 회차 플롯 row가 비어 있으면 집필을 막고
  [바이블과 플롯 준비하고 쓰기]를 먼저 실행한다.

### 검증 상태
- `npm test` 21/21 (검증 시나리오 §11 E2E 12건 + autopilot/workflow/바이블 체인 9건)
- `npm run check` 0 오류, `npm run build` OK
- 실 CLI 클릭스루(2차, 당시): gemini-3.5-flash로 홈→[이번 화 쓰기]→설계·장면·후보 3개
  전 과정 실시간 스트리밍 확인. 2026-07-10부터 기본 후보는 1개다.
- `cargo check` OK, `npm run tauri:build -- --bundles app` OK
  (`src-tauri/target/release/bundle/macos/Bindery.app` 생성)
- dev 브리지 실검증: fs 왕복/경로 탈출 거부/scaffold OK
- 실 CLI: **claude OK** (연결 테스트 + 실제 소재 발굴 1회, 스키마 통과 65s).
  **codex는 이 머신 인증 만료**(refresh token revoked — `codex login` 필요, 앱 문제 아님).
  gemini 미검증.
- 상세: docs/implementation/acceptance_criteria.md

### 다음 인수인계 포인트
1. 패키지된 `Bindery.app`에서 실제 프로젝트 열기/CLI 실행/cancel 클릭스루 QA.
2. 브라우저에서 후속 실사용 클릭스루: `npm run dev` → 새 작품 → 소재 발굴(claude 연결) → 승인 플래그 포함 루프 1회.
3. codex를 쓰려면 `codex login` 후 설정 화면에서 프리셋 전환.
4. sandbox-projects/와 `src-tauri/target/`는 gitignore된 로컬 산출물 — 지워도 된다.
