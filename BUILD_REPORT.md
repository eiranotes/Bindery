# Bindery Stage 3.15 Build Report

## 2026-07-02 Local standalone validation

Commands run:

```text
npm install
npm --workspace apps/desktop run check
npm run build
cargo check
npm run tauri:build:mac:standalone
```

## 2026-07-02 Writing-First UI + Pipeline Rebuild

Summary:

- Main screen is now `작성`, with manuscript editing and saving as the primary workflow.
- `AI 작업` is a separate screen for candidate generation, QA, revision, evidence, and candidate comparison.
- Visible app menus and controls were Koreanized.
- Mobile frame overflow and panel text clipping were fixed.

Verification:

```text
npm --workspace apps/desktop run check: PASS
npm run build: PASS
cargo check: PASS
python3 scripts/verify_static.py: PASS
bash scripts/verify_ai_pipeline.sh: PASS (codex)
Playwright 1440/1024/390 visual QA: overflow 0, candidate true, QA true
npm run tauri:build:mac:standalone: PASS
npx tauri build --bundles app: PASS
open -n .../Bindery.app: PASS
```

Artifacts:

```text
apps/desktop/dist-standalone/Bindery_0.3.0_arm64-standalone
SHA-256 e72c5d90ae07440697e5c654c96cdb2936e2b001dd08de4c6e9814e7d6464a72

apps/desktop/src-tauri/target/release/bundle/macos/Bindery.app
Contents/MacOS SHA-256 51e0149fcbd3bc782a1fc9feec4baaac8315043ff84553f10ef817e4328631d1
```

Results:

```text
npm install: PASS, with 3 low severity npm audit findings
svelte-check: PASS, 0 errors / 0 warnings
vite build: PASS, with one >500 kB chunk warning
cargo check: PASS
tauri mac standalone: PASS
```

Standalone executable:

```text
apps/desktop/dist-standalone/Bindery_0.3.0_arm64-standalone
SHA-256: 6ce1edac9258184e2133bc24d94c528e0629ea316a90ac66bdf5363d667f710b
Size: 12.00 MiB
```

Run check:

```text
standalone-running pid=59376
standalone-stopped
stderr: empty
stdout: empty
```

Fix required for Tauri build:

```text
apps/desktop/src-tauri/src/lib.rs added
apps/desktop/src-tauri/src/main.rs now calls novel_studio_lib::run()
```

Reason: `Cargo.toml` declared `[lib] name = "novel_studio_lib"`, but no `src/lib.rs` existed.

Visual QA evidence:

```text
.superloopy/evidence/frontend/20260702-bindery-pensiv-muvel/VISUAL_QA.md
```

Windows note: Windows `.exe` was not produced on this Mac. Use `npm run tauri:build:standalone` on Windows or a Windows runner.

## 2026-07-02 UI implementation and AI adapter validation

Commands run:

```text
npm --workspace apps/desktop run check
npm run build
cargo check
bash scripts/verify_ai_pipeline.sh
```

Results:

```text
svelte-check: PASS, 0 errors / 0 warnings
vite build: PASS, with one >500 kB chunk warning
cargo check: PASS
AI pipeline adapter smoke: PASS (codex)
```

AI provider status:

```text
codex: PASS, non-interactive final-message output verified
gemini: BLOCKED, current account/client reports IneligibleTierError in headless prompt
claude: BLOCKED, 401 invalid authentication credentials
agy: unavailable on this Mac
```

Visual QA evidence:

```text
.superloopy/evidence/frontend/20260702-bindery-ui-implementation/VISUAL_QA.md
```

UI changes verified:

```text
light topbar background: rgb(251, 250, 248)
390/768/1280/1440: no document-level horizontal overflow
1440 browser flow: Open Book -> Files -> manuscript.md -> Prose -> Draft showed 2 mock candidates
```

Standalone rerun:

```text
npm run tauri:build:mac:standalone: PASS
latest SHA-256: 6ce1edac9258184e2133bc24d94c528e0629ea316a90ac66bdf5363d667f710b
standalone launch smoke: PASS, process stayed alive for 5 seconds with empty stdout/stderr
```

## Scope

Stage 3.15 implements the Pensive-style Book Studio shell, Agent CLI abstraction, Antigravity file-output candidate path, and macOS packaging support.

## Static checks run in container

```text
python3 -m json.tool package.json
python3 -m json.tool apps/desktop/package.json
python3 -m json.tool apps/desktop/src-tauri/tauri.conf.json
python3 scripts/verify_static.py
```

Result:

```text
json-ok
static verify ok
command ok: status sample-project
command ok: analyze sample-project
all static checks ok
```

## Checks not run in container

```text
npm run build
cargo check
npm run tauri:build
npm run tauri:build:mac
```

Reason: this execution environment does not contain installed Node dependencies or Cargo/Rust.

## Local commands

Windows installer:

```powershell
npm install
npm run tauri:build
```

Windows standalone exe:

```powershell
npm run tauri:build:standalone
```

macOS `.app` / `.dmg`:

```bash
npm install
npm run tauri:build:mac
```

macOS raw executable:

```bash
npm run tauri:build:mac:standalone
```
