# Changelog

## 2026-07-02 (UI 하네스 개편)

- Reworked the top navigation to four Korean tabs: `집필`, `자료`, `AI 작업`, `내보내기`; `도움말` and `환경설정` moved to the topbar.
- Rebuilt `AI 작업` as a staged harness: `01 연결` (CLI provider, command, output mode, test, demo mode) → `02 바이블` (detect setting bible, create template, or explicitly proceed without one) → `03 실행` (7-step pipeline with per-step status, prompt preview, and connected step rail) → `04 검토` (candidate diff, QA, revision plan, repetition map).
- Removed all AI entry points from the writing screen; editor slash commands now only navigate to the AI harness.
- Merged the old `검토` tab into the AI harness review stage, removing duplicated panels.
- Removed mock-only binder content (fake progress meter, hardcoded episode list) and dead components (`RightDock`, `BuildLadder`, `EpisodeTabs`, `EvidenceSummary`, `AIPanel`, `SettingsPanel`).
- Added an `환경설정` modal for editor preferences (font, size, autosave, line numbers, mentions, smart input).
- Restored the open project (file tree and manuscript) after a page reload.
- Fixed the literal `\n` rendering in the job console.

## 2026-07-02

- Added a project-first start screen for creating a new work, opening an existing folder, or loading the sample project.
- Added native project creation that writes the initial manuscript, setting bible, plot, notes, and `.novelctl/config.yaml`.
- Added a separate `도움말` screen for the full writing, AI, review, and export workflow.
- Simplified the studio topbar by moving project switching back to the start screen.
- Refined the start UI away from card-like launcher buttons toward a quieter Pensiv-style line/form layout.
- Reworked Bindery into a writing-first studio with `작성` as the main screen.
- Split AI generation and review into the separate `AI 작업` screen.
- Added top-level Korean navigation: `작성`, `AI 작업`, `자료`, `검토`, `내보내기`.
- Koreanized visible controls and panels across settings, snapshots, job logs, QA, codex, plot board, and candidate review.
- Fixed mobile and desktop text clipping/overflow found during visual QA.
- Made candidate generation stay in `AI 작업` and show candidate comparison plus QA output.
- Rebuilt macOS raw standalone executable and launchable `Bindery.app`.
- Verified Codex CLI AI adapter smoke path.
