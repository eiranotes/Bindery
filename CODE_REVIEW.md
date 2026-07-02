# Bindery Stage 3.15 Code Review

## Architecture changes

- `AppShell` now branches into `MyBooks` when no project is open, then `Book Studio` after project open.
- `uiStore` now uses Pensive-style build steps instead of the previous four generic center views.
- `BuildLadder.svelte` centralizes the step navigation.
- `RightDock.svelte` is now an AI Editor rail instead of tabbed tool clutter.
- `BinderPanel.svelte` is now a Book Navigator with Book / Files / Bible tabs.

## Agent CLI changes

- Settings moved from Gemini-only to Agent CLI.
- Supported providers: `antigravity`, `gemini`, `custom`.
- Supported output modes: `file`, `stdout`.
- Antigravity defaults to write-to-file candidate capture.
- Existing `test_gemini_cli` remains as a compatibility wrapper.

## macOS changes

- Generated `apps/desktop/src-tauri/icons/icon.icns`.
- Added `npm run tauri:build:mac`.
- Added `scripts/build_macos_app.sh`.
- Added `.github/workflows/build-macos.yml`.

## Known follow-up work

- Implement real `import_bible` backend command.
- Persist build ladder state in `.bindery/project.json`.
- Parse `.bindery/outline/chapters.yml` and `.bindery/outline/beats.yml` instead of using mock episode rows.
- Add signed/notarized macOS release flow.
