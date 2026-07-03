# plan.md — Stage 3.11 Plan

## 2026-07-03 Style System Patch Plan

Current goal: apply `bindery_style_system_patched_20260703.zip`, verify the structured style system, and fix the scene segmentation issue where sentence-separated text became one scene per sentence.

Completed:

- [x] Imported structured style runtime, CLI, frontend API, UI, docs, and tests from the patch archive.
- [x] Fixed scene candidate grouping so short sentence/paragraph blocks merge unless an explicit separator marks a boundary.
- [x] Added a Node smoke test for sentence-separated style samples.
- [x] Reflected `phase2_backlog.md` in `docs/TASKS.md`.

Next:

- [ ] Implement the larger Phase 2 items from `phase2_backlog.md`: SQLite repository/migrations, native Tauri style commands, preset/stack/router editor UI, Korean NLP expansion, structured LLM correction, scoring hardening, and SkillPack validation/zip export.

## 현재 단계

Stage 3.11 — Runtime Readiness, Manual, Naming Pass

## 이번 단계 목표

1. Mock mode 기본값을 OFF로 바꿔 실제 native/novelctl 경로를 기본으로 둔다.
2. 내가 앞서 지적한 컴파일/검증 관련 수정사항을 최소수정으로 반영한다.
3. 모든 기능을 설명하는 운영 매뉴얼을 작성한다.
4. `Bindery`가 임시명이라는 점을 반영해 이름 후보를 제안한다.

## 완료 항목

- [x] `settingsStore.mockMode` 기본값 `true → false`.
- [x] Mock mode ON 상태를 TopBar에 `MOCK OFFLINE` 배지로 표시.
- [x] SettingsPanel에 Mock mode 기본 OFF 안내 추가.
- [x] `AppError`에 `From<serde_json::Error>` 추가.
- [x] `apps/desktop/package.json` check 스크립트에 `svelte-kit sync` 추가.
- [x] `tests/e2e_playwright.py`의 Chromium 하드코딩 fallback 제거.
- [x] `scripts/browser_smoke.sh`에 디버깅 로그와 실패 시 preview log tail 추가.
- [x] `docs/OPERATION_MANUAL.md` 작성.
- [x] `docs/NAME_IDEAS.md` 작성.
- [x] `README.md`, `USAGE.md`, `BUILD_REPORT.md`, `state.md`, `log.md` 갱신.

## 남은 항목

- [x] Rust 환경에서 `cargo check`.
- [x] macOS standalone raw executable build and smoke run.
- [ ] Tauri 환경에서 `npm run tauri:dev`.
- [ ] `mockMode=false`에서 native command 왕복 확인.
- [ ] Windows runner에서 NSIS installer 생성 확인.
- [ ] Native Codex frontmatter alias parser 구현.
- [ ] Native Plot Grid scene frontmatter parser 구현.
- [ ] 배포 CSP 적용.
- [x] `DESIGN.md` 기반 Pensiv/Muvel UI Phase 1 token cleanup.
- [x] My Books hero-card 제거 및 작업 큐형 첫 화면 반영.
- [x] 상단바 light background 고정.
- [x] Codex CLI default AI adapter 연결 및 smoke 검증.

## 다음 권장 단계

Stage 3.16 — Pensiv/Muvel UI Alignment

1. Replace purple/blue accent and logo gradient with `DESIGN.md` teal/warm tokens.
2. Convert My Books from hero-card landing into dense book shelf/work queue.
3. Compact the build ladder for repeated studio use and mobile.
4. Replace emoji theme icon with an icon component.
5. Re-run 390/768/1280 visual QA and record Superloopy evidence.

Stage 3.16 remaining:

1. Add mobile-only compact step picker to reduce ladder truncation.
2. Add recent book metadata: last opened, current phase, pending candidates, snapshot count.
3. Validate full Draft candidate flow inside a real Tauri window, not browser mock.
4. Validate Antigravity separately on a machine with `agy`.


## Stage 3.11 추가 완료 항목

- [x] 임시 제품명 `Bindery` 반영.
- [x] Tauri `productName`, window title, identifier, package metadata 업데이트.
- [x] 기존 `novel-studio-*` localStorage fallback 유지.
- [x] `SnapshotPanel` 수동 snapshot을 현재 에디터 버퍼 기준으로 변경.
- [x] `AIPanel`의 `ep001` 하드코딩 제거.
- [x] 전체 파이프라인 버튼을 현재 step 목록 전체 순회로 수정.
- [x] Repetition Map bucket 클릭 위치 이동 정확도 개선.
- [x] `CODE_REVIEW.md` 작성.

## 2026-07-02 추가 완료 항목

- [x] `npm install`.
- [x] `npm --workspace apps/desktop run check`.
- [x] `npm run build`.
- [x] `cargo check`.
- [x] `npm run tauri:build:mac:standalone`.
- [x] macOS standalone executable process launch smoke test.
- [x] `DESIGN.md` token contract 작성.
- [x] Pensiv/Muvel UI improvement plan 작성.
- [x] Superloopy visual QA evidence 작성.

## Current Next Plan

1. Add packaged `.app` click-through automation if a macOS GUI automation route is approved.
2. Add recent-book metadata to My Books.
3. Add Muvel-style optional writing widgets.
4. Add Pensiv-style graph/canvas materials view.
5. Validate Windows standalone/installer on a Windows runner.
