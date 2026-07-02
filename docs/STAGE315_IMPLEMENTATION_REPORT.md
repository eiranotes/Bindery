# Stage 3.15 Implementation Report

## Summary

This stage changes Bindery from a developer-dashboard style interface into a Pensive-style Book Studio.

Primary changes:

- Projectless landing screen: `MyBooks.svelte`
- Fixed Book Studio layout: Navigator / Studio Surface / AI Editor Rail
- Build ladder: Brief → Foundations → Spine → Chapters → Beats → Prose → Read / Revise → Publish
- Right dock simplified into a proposal/evidence rail
- Agent CLI generalized from Gemini-only to Antigravity/Gemini/Custom
- Antigravity file-output mode added
- macOS build scripts, workflow, and icon support added

## Changed Frontend Files

```text
apps/desktop/src/lib/components/layout/AppShell.svelte
apps/desktop/src/lib/components/layout/MyBooks.svelte
apps/desktop/src/lib/components/layout/TopBar.svelte
apps/desktop/src/lib/components/layout/BuildLadder.svelte
apps/desktop/src/lib/components/layout/MainSurface.svelte
apps/desktop/src/lib/components/layout/RightDock.svelte
apps/desktop/src/lib/components/binder/BinderPanel.svelte
apps/desktop/src/lib/components/settings/SettingsPanel.svelte
apps/desktop/src/lib/components/layout/CommandPalette.svelte
apps/desktop/src/lib/components/candidates/CandidateDiffPanel.svelte
apps/desktop/src/lib/stores/uiStore.ts
apps/desktop/src/lib/stores/buildLadderStore.ts
apps/desktop/src/lib/stores/settingsStore.ts
apps/desktop/src/lib/api/commands.ts
apps/desktop/src/lib/styles/app.css
```

## Changed Backend Files

```text
apps/desktop/src-tauri/src/commands/novelctl.rs
apps/desktop/src-tauri/src/main.rs
apps/desktop/src-tauri/tauri.conf.json
```

## Packaging / macOS Files

```text
apps/desktop/src-tauri/icons/icon.icns
scripts/build_macos_app.sh
.github/workflows/build-macos.yml
package.json
apps/desktop/package.json
```

## Local Verification Performed

Available in this environment:

- JSON config validation
- icon generation
- static source inspection
- zip packaging

Not available in this environment:

- `npm install` dependency download
- Svelte build
- Cargo/Tauri build
- macOS bundle build

Run on local Windows/macOS:

```bash
npm install
npm run build
npm run tauri:build
```

macOS:

```bash
npm run tauri:build:mac
```
