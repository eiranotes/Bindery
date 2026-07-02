# Project Status

Updated: 2026-07-02 22:37 KST

## Current State

Bindery is now a writing-first macOS/Svelte/Tauri app with an explicit onboarding flow. The first screen lets the author create a new local project, open an existing folder, or load the sample project before entering the manuscript editor. AI candidate generation, QA, revision planning, and evidence remain isolated in the `AI 작업` screen.

## Completed

- Added a start screen for `새 작품`, `기존 폴더`, and `샘플` entry.
- Added native `create_project` support that creates the initial manuscript, setting bible, plot, notes, and `.novelctl/config.yaml`.
- Added a top-level `도움말` screen that explains the complete workflow from project creation through AI review and export.
- Replaced the start screen's card-button layout with a quieter line/form-based layout inspired by Pensiv's focused workspace direction.
- Simplified the topbar so project switching returns to the start screen instead of exposing a raw path input during writing.
- Reworked the primary navigation to `작성`, `AI 작업`, `자료`, `검토`, `내보내기`.
- Made project open select the first writable manuscript automatically.
- Removed the always-visible right AI dock from the main writing layout.
- Koreanized visible menus, panel labels, settings, snapshot, job log, QA, codex, plot, and candidate copy.
- Kept the macOS topbar light in light mode while preserving native decorations, movement, resizing, and window controls.
- Verified Codex CLI pipeline adapter with `scripts/verify_ai_pipeline.sh`.
- Rebuilt raw standalone executable and launchable macOS `.app` bundle.

## Verification

- `npm --workspace apps/desktop run check`
- `npm run build`
- `cargo check`
- `python3 scripts/verify_static.py`
- `bash scripts/verify_ai_pipeline.sh`
- Playwright onboarding/help/pipeline QA at 1440, 1024, and 390 px with 0 horizontal overflow and 0 clipping candidates
- Playwright visual QA at 1440, 1024, and 390 px
- `npm run tauri:build:mac:standalone`
- `npx tauri build --bundles app`
- `open -n apps/desktop/src-tauri/target/release/bundle/macos/Bindery.app`

## Known Risks

- Windows `.exe`/NSIS output is still unverified on a Windows runner.
- Browser QA verifies the full UI flow with mock data; native Codex CLI is verified at adapter level.
- The build still warns that one Vite chunk is larger than 500 kB.
