# Project Status

Updated: 2026-07-03 (산출물 + 문체)

## Current State

Bindery is a writing-first macOS/Svelte/Tauri app. Five Korean main tabs — `집필`, `자료`, `문체`, `AI 작업`, `내보내기` — plus topbar `도움말`/`환경설정`. The AI harness (`01 연결 → 02 바이블 → 03 실행 → 04 검토`) now records an artifact for every step in a per-episode shelf, and draft/revise prompts automatically include the latest artifacts plus the style guideline. The `문체` studio turns a pasted sample into a per-scene analysis, scene-type writing rules with ban lists, a proof scene, and a final style guideline saved to `canon/style-guide.md`.

## Completed (2026-07-03)

- Artifact shelf: every pipeline step (context/draft/analyze/qa/revise/summarize/commit) records a per-episode artifact with viewer modal and `집필 반영` badges.
- Guidance injection: `generate_candidate` accepts a guidance block (bible + style guideline + latest artifacts); prompt preview shows the real assembled prompt.
- New `run_agent_text` Tauri command and unified agent CLI runners (stdout/file/codex exec).
- `문체` tab: sample input → per-scene quantitative stats → AI emotional extraction → scene-type rules + banned words/imagery → proof scene not in the source → final guideline saved into the project; offline fallbacks are clearly labeled.
- Verified: svelte-check 0 errors, vite build, cargo check, `npx tauri build --bundles app` success, browser click-through of the full style flow and artifact-fed draft prompt.

## Completed (2026-07-02)

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
