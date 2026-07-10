# Bindery — AI 장기 소설 집필 하네스

local-first · Markdown-native · AI candidate-first. AI는 중간 단계를 자동 처리하고,
확정(후보 적용·정사 변경·마감)은 항상 사람이 한다.

사용자에게 보이는 흐름(간단 모드):

```text
홈 → [이번 화 쓰기] → 집필안 1개 검토·적용 → 병렬 QA·수정 체크리스트 → 회차 마감
```

내부 파이프라인(설계자 모드에서 직접 조작 가능):

```text
소재 발굴 → 세계관 확장 → 바이블 → 플롯 → 회차 브리프 → 장면 계획
→ 원고 후보(diff/hunk 적용) → 3관점 QA → 수정 후보 → 요약 → 정사 변경 승인
→ 기록·픽스 → 재개 상태(resume) → 다음 회차
```

## 실행

```bash
npm install
npm run dev        # http://localhost:5199 — dev 브리지가 로컬 파일/CLI 접근 제공
npm test           # 코어 + 검증 시나리오 E2E
npm run check      # svelte-check
npm run qa:ui-contract  # 전체 Svelte CTA의 실행 연결 감사
npm run build      # 웹 번들
npm run tauri:build:mac:standalone    # macOS Bindery.app 생성 + ad-hoc 서명
```

시작 화면에서 새 작품을 만들면 프로젝트 폴더(ideas/ canon/ characters/ world/ plot/ story/ …)가
생성된다. 설정 화면에서 CLI 실행기(codex/claude/agy/직접 설정)를 연결하면 각 단계가 AI로
돌고, 없으면 로컬 뼈대/웹 AI 교환(packet)으로 동작한다. 패키지 앱은 Finder 실행 시에도
`~/.local/bin`, `~/.cargo/bin`, Homebrew 표준 경로를 보강해 프리셋 CLI를 찾는다.

최초 기획 ZIP은 읽기 진행률·취소와 안전 한도(50MB, 500 엔트리, 텍스트 엔트리당 2MB)를
제공한다. `canon` 설정 문서와 `world`/`plot` 문서가 함께 든 구조화 패키지는 단순 발췌 대신
역할별 파일로 가져온다. resume 지점이 있으면 원본의 다음 회차에서 이어 쓸지, 같은 바이블과
세계 규칙·원본 플롯 자료를 유지한 채 `ep001`부터 활성 플롯을 다시 설계할지 가져오기 전에 명시적으로 선택한다. 열린 작품의 홈에서도
`epXXX 이어쓰기`와 `같은 설정으로 ep001부터 다시 쓰기`를 별도 동작으로 제공한다.

실행기가 `agy`이면 설정 화면은 프로젝트 토큰으로 요금을 추정하지 않고, 대화형 `/usage` 화면의
5시간·주간 잔여 한도를 직접 읽어 표시한다. 다른 실행기는 실제 쿼터 API가 없을 때만 기존 실행
원장 기반 추정치를 표시한다.

## 구조

- `src/lib/bridge` — 로컬 접근 인터페이스 (dev/memory/tauri)
- `src-tauri` — Tauri v2 패키징 + Rust command bridge (fs/scaffold/run_agent_stream/cancel_agent/pick_folder/env)
- `src/lib/harness` — 도메인 로직 (UI 무지, vitest로 직접 검증)
  - `context.ts` 기초자료 단일 로더 · `workflow.ts` 다음 행동 계산 · `autopilot.ts` stage 묶음 실행
  - `exportManuscript.ts` Markdown/TXT/EPUB/DOCX 완성물 · `backup.ts` 프로젝트 백업/복원 · `projectChanges.ts` 외부 변경 digest
- `src/lib/schemas/contracts.ts` — AI 출력 계약 검증 (교환용 JSON Schema는 `schemas/`)
- `prompts/*.prompt.md` — 프롬프트 blueprint 원본 18종
- `server/bridge.ts` — Vite 미들웨어 (fs + CLI spawn + trace)
- `src/lib/ui` — 진행/설계/프로젝트 작업 레일, 간단 모드(홈·집필·작품노트·보류함) +
  설계자 모드(파이프라인 화면) 지연 로드 작업면,
  dev SSE와 Tauri Channel을 공유하는 실시간 CLI 스트리밍(LiveRunPanel)

문서: `DESIGN.md` `docs/architecture/` `docs/workflows/` `docs/prompts/` `docs/implementation/`
(설계 결정은 `docs/implementation/decisions.md`, 검증 결과는 `acceptance_criteria.md`).

레거시 참조 구현: `~/HermesWorkspace/project/Bindery` (패턴 흡수원, 코드 미사용).
선행 설계 패키지: `novel_harness_final_package/` (스키마·프롬프트 흡수원).
