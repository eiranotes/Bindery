# Standalone Windows exe build

Bindery can be built in two Windows distribution forms:

| Command | Output | Use |
|---|---|---|
| `npm run tauri:build` | `src-tauri/target/release/bundle/nsis/*-setup.exe` | Installer distribution |
| `npm run tauri:build:standalone` | `apps/desktop/dist-standalone/*-standalone.exe` | No-installer portable exe |

## Build from repository root

```powershell
cd D:\AI\Bindery\bindery
npm install
npm run tauri:build:standalone
```

## Build from desktop package

```powershell
cd D:\AI\Bindery\bindery\apps\desktop
npm install
npm run tauri:build:standalone
```

The command uses:

```powershell
tauri build --no-bundle
node .\scripts\make-standalone.mjs
```

`tauri build --no-bundle` compiles the release application executable without generating NSIS/MSI installers. The copy script then writes a stable distribution filename such as:

```text
apps/desktop/dist-standalone/Bindery_0.3.0_x64-standalone.exe
```

It also writes:

```text
apps/desktop/dist-standalone/SHA256SUMS.txt
apps/desktop/dist-standalone/standalone-manifest.json
```

## Runtime note

The standalone exe avoids the installer, but it is still a Tauri/WebView2 desktop app. On Windows, WebView2 Runtime must exist on the target machine. Most current Windows 10/11 installations already have it, but this standalone exe does not bootstrap missing WebView2 the way an installer can.

## CRT note

`apps/desktop/src-tauri/.cargo/config.toml` enables `+crt-static` for Windows MSVC targets. This reduces dependency on a separate Visual C++ Redistributable for the app binary.
