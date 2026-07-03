# analysis_report.md

## 1. 현재 구조 요약

### 주요 디렉터리
- `apps/desktop/src/lib/domain/`: 문체 분석, 반복 분석, 프롬프트 조립 도메인 코드.
- `apps/desktop/src/lib/components/style/StyleStudio.svelte`: 문체 재현 UI. 샘플 입력 → 로컬 분석 → AI 보강 → 지침 → 재현 테스트 → 최종 지침서 흐름.
- `apps/desktop/src/lib/stores/styleStore.ts`: 문체 스튜디오 상태를 localStorage에 저장.
- `apps/desktop/src/lib/api/commands.ts`: Tauri 명령 래퍼와 브라우저 mock API.
- `apps/desktop/src-tauri/src/commands/analysis.rs`: 반복어 분석 Tauri command.
- `packages/novelctl-core/novelctl/cli.py`: 최소 novelctl CLI.

### 문체 분석 관련 기존 코드
- `styleAnalyzer.ts`: 로컬 MVP 문체 분석기. 문단 기반 scene 후보 분할, sentence split, pacing, transition, dialogue stats, emotion handling, evidence extraction, PromptCapsuleV3 생성이 존재.
- `style.ts`: `styleAnalyzer.ts`를 감싼 UI용 API. `analyzeStyle`, `buildExtractPrompt`, `buildGuidePrompt`, `buildProofPrompt`, `buildGuidelinePrompt`, mock 문서 생성기가 존재.
- 기존 SceneRecord는 `observation/dialogue/exposition/movement/conflict/aftermath/quiet_transition`의 lowercase scene type 중심이며, `primary_type/secondary_types/style_register` 구조는 없었다.

### DB 구조
- 업로드된 코드에는 SQLite 연결, migration, repository layer가 없다.
- 저장은 프론트엔드 `localStorage`, 파일 저장은 `writeFile`, CLI 산출물은 프로젝트 폴더의 Markdown 파일 쓰기 중심이다.
- 이번 패치에서는 DB 구현 대신 `packages/novelctl-core/novelctl/style_system.py`에 `SQLITE_SCHEMA` 상수를 추가하고, CLI `style-sql`로 schema를 출력하게 했다.

### UI 구조
- `StyleStudio.svelte`가 문체 작업의 중심 UI다.
- 좌측 rail은 단계 이동, 우측 stage는 각 단계별 산출물을 보여준다.
- 이번 패치에서는 기존 장면 정량표를 깨지 않고, 구조화된 `SceneClassification` 표를 추가했다.

### AI 호출 구조
- `runAgentText()`가 범용 AI 호출 래퍼다.
- 브라우저/mock mode에서는 AI 호출 실패로 처리하고 기존 mock 생성기로 대체된다.
- 기존 설계상 로컬 분석이 먼저 실행되고 AI는 감성·거리감·해석 보강을 담당한다.

## 2. 재사용 가능한 기존 코드

### 그대로 활용할 파일
- `styleAnalyzer.ts`: 문단 분할, sentence split, surface feature, evidence extraction 로직.
- `style.ts`: 기존 UI 프롬프트 빌더와 mock 생성기.
- `StyleStudio.svelte`: 기존 문체 스튜디오 단계 구조.
- `styleStore.ts`: localStorage 기반 상태 보관 구조.
- `commands.ts`: Tauri/mock dual API wrapper.
- `cli.py`: novelctl subcommand 패턴.

### 일부 수정한 파일
- `apps/desktop/src/lib/domain/style.ts`: 구조화된 style runtime export 추가.
- `apps/desktop/src/lib/stores/styleStore.ts`: SceneClassification, presets, stacks, router, activeStack, PromptCapsule 상태 추가.
- `apps/desktop/src/lib/components/style/StyleStudio.svelte`: classifyScene 실행과 장면분류/register 표 추가.
- `apps/desktop/src/lib/api/commands.ts`: style classifier/router/capsule/scorer/SkillPack local API entrypoint 추가.
- `packages/novelctl-core/novelctl/cli.py`: style 관련 CLI subcommand 추가.

### 삭제하지 말아야 할 구조
- 기존 `PromptCapsuleV3`는 로컬 evidence 기반 분석 결과로 유지한다.
- 기존 `StyleAnalysisBundle`은 StyleStudio의 분석 화면과 prompt builder가 사용한다.
- 기존 mock mode는 오프라인 데모와 테스트에 필요하므로 유지한다.

## 3. 누락된 기능

이번 패치 전에는 아래 기능이 없었다.

- `StyleProfile` schema
- `StylePreset` schema
- `StyleStack` schema
- `SceneClassification` schema
- `StyleRouter` schema
- `PromptCapsule` schema
- `StyleRouter` resolver
- `StyleStack` merge logic
- `StyleMatchScore`/`StyleMatchReport`
- `SkillPack export`
- CLI/API 최소 진입점
- 해당 테스트

## 4. 기존 구조와 충돌하는 부분

### naming
- 기존 scene type은 lowercase semantic label이고, 신규 장면분류는 `OBS/DIA/ACT/INF/CON/MOV/AFT/TRN/INT/REL` 코드다.
- 충돌 방지: 신규 코드는 `styleSystem.ts`/`style_system.py`에 분리하고, 기존 analyzer는 유지했다.

### schema
- 기존 `PromptCapsuleV3`는 evidence 중심, 신규 `PromptCapsule`은 generation input 중심이다.
- 충돌 방지: 두 타입을 병존시켜 기존 UI 산출물과 신규 runtime 산출물을 분리했다.

### storage
- 현재 SQLite repository가 없으므로 DB migration을 실제 연결하지 않았다.
- 대신 SQL schema를 `SQLITE_SCHEMA`로 제공하고 docs에 저장 전략을 명시했다.

### API
- Tauri backend command는 style runtime을 아직 노출하지 않는다.
- 이번 패치에서는 `commands.ts`의 browser-safe local 함수와 CLI subcommand를 추가했다.

### UI
- 완전한 Preset Manager/Stack Mixer/Router Editor는 없다.
- 이번 패치에서는 SceneClassification 표만 StyleStudio에 최소 삽입했다.

### tests
- 기존 테스트 구조가 없었다.
- 신규 `tests/test_style_system.py`와 `tests/styleSystem.node.test.mjs`를 추가했다.

## 5. 구현 전략

### 이번 패치에서 실제 반영한 범위
- TypeScript runtime: `apps/desktop/src/lib/domain/styleSystem.ts`
- Python CLI runtime: `packages/novelctl-core/novelctl/style_system.py`
- Frontend store/API/UI 최소 연결
- SceneClassifier, StyleRouter, StyleStack merge, PromptCapsule, StyleMatchScorer, SkillPack export
- Python unittest와 Node TypeScript smoke test
- docs 및 작업 로그 파일

### Phase 2로 미룬 범위
- SQLite repository/migration 실제 연결
- Tauri backend style commands
- Preset Manager/Stack Mixer/Router Editor 전체 UI
- 한국어 형태소 분석기 연동
- LLM structured-output 보정 실제 provider 연결
- 고급 leakage detector/vector search
- SkillPack validator/zip exporter
