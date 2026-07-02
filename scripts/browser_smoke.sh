#!/usr/bin/env bash
# Browser smoke test against the REAL Svelte app (vite preview build),
# not the static prototype. Requires: node deps installed, python3+playwright,
# a chromium binary (CHROME_PATH env or playwright default path).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${PORT:-}" ]; then
  PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()
PY
)"
else
  PORT="${PORT}"
fi
export PREVIEW_URL="http://127.0.0.1:${PORT}/"

echo "[smoke] PREVIEW_URL=${PREVIEW_URL}"
echo "[smoke] CHROME_PATH=${CHROME_PATH:-playwright-default}"
echo "[smoke] building Svelte app…"
npm run build >/dev/null

echo "[smoke] starting vite preview on :${PORT}…"
(cd apps/desktop && npx vite preview --host 127.0.0.1 --port "${PORT}") >/tmp/ns-preview.log 2>&1 &
PREVIEW_PID=$!
trap 'kill ${PREVIEW_PID} 2>/dev/null || true' EXIT

for i in $(seq 1 30); do
  if curl -sf -o /dev/null "${PREVIEW_URL}"; then break; fi
  sleep 1
done
curl -sf -o /dev/null "${PREVIEW_URL}" || { echo "[smoke] preview did not come up"; tail -n 80 /tmp/ns-preview.log || true; exit 1; }
echo "[smoke] preview is up — running Playwright E2E…"

python3 tests/e2e_playwright.py || { echo "[smoke] playwright failed"; tail -n 120 /tmp/ns-preview.log || true; exit 1; }
echo "[smoke] PASS"
