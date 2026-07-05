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
