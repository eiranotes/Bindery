# macOS Build Notes

## 1. Prerequisites

Install the normal Tauri macOS prerequisites, Node 20+, and Rust stable.

```bash
node --version
rustc --version
cargo --version
```

Install npm dependencies from the repository root.

```bash
npm install
```

## 2. Build `.app` and `.dmg`

```bash
npm run tauri:build:mac
```

Equivalent helper:

```bash
./scripts/build_macos_app.sh
```

Expected output directory:

```text
apps/desktop/src-tauri/target/release/bundle/
```

## 3. Build raw standalone executable

```bash
npm run tauri:build:mac:standalone
```

or:

```bash
./scripts/build_macos_app.sh --standalone
```

Expected output:

```text
apps/desktop/dist-standalone/Bindery_0.3.0_<arch>-standalone
apps/desktop/dist-standalone/SHA256SUMS.txt
apps/desktop/dist-standalone/standalone-manifest.json
```

## 4. Icons

macOS uses:

```text
apps/desktop/src-tauri/icons/icon.icns
```

Windows still uses:

```text
apps/desktop/src-tauri/icons/icon.ico
```

## 5. Signing / Notarization

This stage does not add Apple Developer ID signing or notarization. Unsigned local builds may require manual open approval in macOS security settings. Distribution outside local testing should add signing and notarization as a later packaging stage.

## 6. Agent CLI on macOS

Default Agent command:

```text
agy
```

If the app cannot resolve PATH from the GUI environment, use an absolute path from Terminal:

```bash
which agy
```

Then paste the result into:

```text
AI Editor → Agent settings → Command
```
