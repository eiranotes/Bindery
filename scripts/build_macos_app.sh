#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm install
if [[ "${1:-}" == "--standalone" ]]; then
  npm run tauri:build:mac:standalone
  echo "Check apps/desktop/dist-standalone for the raw macOS executable."
else
  npm run tauri:build:mac
  echo "Check apps/desktop/src-tauri/target/release/bundle for .app/.dmg outputs."
fi
