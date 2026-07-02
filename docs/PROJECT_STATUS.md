# Project Status

Updated: 2026-07-02 (UI 하네스 개편)

## Current State

Bindery is a writing-first macOS/Svelte/Tauri app. The studio has four Korean main tabs — `집필`, `자료`, `AI 작업`, `내보내기` — plus topbar `도움말` and `환경설정`. Writing and AI are fully separated: the editor has no AI entry points, and all AI work happens in a staged harness (`01 연결 → 02 바이블 → 03 실행 → 04 검토`) with a persistent status rail so the whole novel pipeline is visible at a glance.

## Completed (latest)

- Rebuilt `AI 작업` as the staged harness: CLI connection (provider/command/output/test/demo), bible detection with template creation or explicit skip, a 7-step pipeline (컨텍스트→초안 후보→표현 분석→QA→수정 계획→요약→기록) with per-step status and prompt preview, and a review stage (candidate diff, QA, revision plan, repetition map).
- Removed AI from the writing surface; editor slash commands only navigate to the harness.
- Merged the old `검토` tab into the harness review stage; export screen now holds only snapshots and job history.
- Moved editor preferences into a `환경설정` modal; AI connection status is a topbar button that jumps to harness stage 01.
- Deleted dead components (`RightDock`, `BuildLadder`, `EpisodeTabs`, `EvidenceSummary`, `AIPanel`, `SettingsPanel`) and mock-only binder content; cleaned orphaned CSS.
- Restored open project (file tree + manuscript) after page reload; fixed job console `\n` rendering.

## Verification

- `npm --workspace apps/desktop run check` — 0 errors
- `npm run build` — success
- `python3 scripts/verify_static.py` — pass
- Browser click-through (Vite dev): start → sample → 집필/자료/AI 작업(4단계, 데모 전체 실행)/내보내기/도움말/환경설정, dark mode, 1024px responsive.

## Known Risks

- Windows `.exe`/NSIS output is still unverified on a Windows runner.
- Browser QA verifies the full UI flow with mock data; native Codex CLI is verified at adapter level.
- The build still warns that one Vite chunk is larger than 500 kB.
- Tauri `.app` bundle was not rebuilt after this UI rework (frontend build verified; run `npx tauri build --bundles app` before distributing).
