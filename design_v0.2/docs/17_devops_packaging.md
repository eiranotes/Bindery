# 17. DevOps, Build, and Packaging

## 1. Monorepo layout

```text
novel-studio/
  apps/desktop/
    src/
    src-tauri/
    package.json
  packages/novelctl-core/
    novelctl/
    pyproject.toml
  packages/shared-schemas/
  templates/
  docs/
```

## 2. Development environment

Required:

- Node.js LTS
- pnpm
- Rust stable
- Python 3.11+
- uv or pip
- Gemini CLI optional for mock mode off
- Git optional

Commands:

```bash
pnpm install
pnpm --filter desktop dev
pnpm --filter desktop tauri dev
uv sync
uv run novelctl status
```

## 3. Build pipeline

```text
lint TypeScript
→ test frontend
→ test Python core
→ build frontend
→ cargo build
→ tauri bundle
→ smoke test packaged app
```

## 4. CI suggestions

GitHub Actions matrix:

- macOS latest
- Windows latest
- Ubuntu latest

MVP can start with macOS only if personal use is primary.

## 5. Packaging

Tauri bundle targets:

- macOS `.dmg` / `.app`
- Windows `.msi` / `.exe`
- Linux `.AppImage` / `.deb`

## 6. Python core distribution

Options:

### Option A: Require external novelctl

Simplest for dev.

- user installs `novelctl` separately.
- GUI setting points to path.

### Option B: Bundle Python core

Better UX, harder packaging.

- include embedded Python or compiled binary.
- use PyInstaller/briefcase/uv-managed runtime.

### Recommended phased approach

| Phase | Strategy |
|---|---|
| MVP | external novelctl + path setting |
| v1 | bundled novelctl executable |
| v2 | Rust-native subset for local analysis |

## 7. Version compatibility

Store required versions in project config.

```yaml
compat:
  novel_studio: ">=0.1.0"
  novelctl: ">=0.1.0"
  schema: "1"
```

On project open, run migration check.

## 8. Migrations

Migrations are file-based.

```text
.novelctl/migrations/
  001_initial.md
  002_add_analysis_dir.md
```

Never silently rewrite large project structures. Show migration plan first.
