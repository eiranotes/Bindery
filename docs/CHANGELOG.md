# Changelog

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
