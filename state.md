# state.md — 현재 인수인계 상태

## 2026-07-05 신규 하네스 구축 (v0.1)

### 무엇이 있는가
- `/Users/tofu/Bindery`가 제품 저장소다 (git, main). 레거시(HermesWorkspace/project/Bindery)는
  참조로만 쓰였고 이번 작업의 수정 없이 원상태다.
- 스택: Vite 6 + Svelte 5 + TS. `npm run dev`(포트 5199)가 dev 브리지(파일/CLI)를 포함한
  완전한 로컬 런타임. Tauri 패키징은 roadmap Phase 3.
- 제품 루프 전체 구현: 소재(폴더 상태 보드) → 세계관 proposal → 승인 → 자산 파일 → 바이블
  후보/교체 → 플롯 제안/표 편집/회차 승인 → 브리프 → 장면 → 초안 후보 → diff hunk 적용
  (스냅샷) → 3관점 QA → 수정 계획(수용/기각) → 수정 후보 → 요약 → 정사 delta proposal →
  항목 승인/반영 → 픽스 → resume state → 다음 회차.
- 프롬프트 blueprint 16종(`prompts/`), 계약 검증(`src/lib/schemas/contracts.ts` + `schemas/*.json`),
  러너 단일 경로(repair 1회 + 정직한 폴백 + trace), proposal 레지스트리, 웹 AI 교환
  (idea/world 왕복).

### 검증 상태
- `npm test` 12/12 (검증 시나리오 §11 전체를 memory 브리지 E2E로 커버)
- `npm run check` 0 오류, `npm run build` OK
- dev 브리지 실검증: fs 왕복/경로 탈출 거부/scaffold OK
- 실 CLI: **claude OK** (연결 테스트 + 실제 소재 발굴 1회, 스키마 통과 65s).
  **codex는 이 머신 인증 만료**(refresh token revoked — `codex login` 필요, 앱 문제 아님).
  gemini 미검증.
- 상세: docs/implementation/acceptance_criteria.md

### 다음 인수인계 포인트
1. 브라우저에서 실사용 클릭스루: `npm run dev` → 새 작품 → 소재 발굴(claude 연결) → 루프 1회.
2. roadmap Phase 1: agent 스트리밍/취소, planning artifact 승인 플래그, 스냅샷 UI, CodeMirror.
3. codex를 쓰려면 `codex login` 후 설정 화면에서 프리셋 전환.
4. sandbox-projects/는 gitignore된 실험용 — 지워도 된다.
