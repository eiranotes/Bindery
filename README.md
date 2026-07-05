# Bindery — AI 장기 소설 집필 하네스

local-first · Markdown-native · AI candidate-first. AI는 후보와 제안을 만들고,
확정(원고 반영·정사 변경)은 항상 사람이 한다.

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
```

시작 화면에서 새 작품을 만들면 프로젝트 폴더(ideas/ canon/ characters/ world/ plot/ story/ …)가
생성된다. 설정 화면에서 CLI 실행기(codex/claude/gemini/직접 설정)를 연결하면 각 단계가 AI로
돌고, 없으면 로컬 뼈대/웹 AI 교환(packet)으로 동작한다.

## 구조

- `src/lib/bridge` — 로컬 접근 인터페이스 (dev/memory, 로드맵: tauri)
- `src/lib/harness` — 도메인 로직 (UI 무지, vitest로 직접 검증)
- `src/lib/schemas/contracts.ts` — AI 출력 계약 검증 (교환용 JSON Schema는 `schemas/`)
- `prompts/*.prompt.md` — 프롬프트 blueprint 원본 16종
- `server/bridge.ts` — Vite 미들웨어 (fs + CLI spawn + trace)
- `src/lib/ui` — 펜시브 벤치마크 구조의 작업면 8종

문서: `docs/architecture/` `docs/workflows/` `docs/prompts/` `docs/implementation/`
(설계 결정은 `docs/implementation/decisions.md`, 검증 결과는 `acceptance_criteria.md`).

레거시 참조 구현: `~/HermesWorkspace/project/Bindery` (패턴 흡수원, 코드 미사용).
선행 설계 패키지: `novel_harness_final_package/` (스키마·프롬프트 흡수원).
