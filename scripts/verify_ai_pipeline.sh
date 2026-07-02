#!/usr/bin/env bash
# Verify that Bindery's default AI adapter can obtain a clean final message
# from the local non-interactive agent CLI.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKDIR="${1:-"${ROOT}/sample-project"}"
AGENT_CMD="${AGENT_CMD:-codex}"
OUT="$(mktemp)"
LOG="$(mktemp)"
trap 'rm -f "${OUT}" "${LOG}"' EXIT

if ! command -v "${AGENT_CMD}" >/dev/null 2>&1; then
  echo "FAIL: agent command not found: ${AGENT_CMD}" >&2
  exit 1
fi

case "${AGENT_CMD}" in
  codex)
    (cd "${WORKDIR}" && "${AGENT_CMD}" exec --skip-git-repo-check --ephemeral -s read-only -o "${OUT}" "Return exactly: BINDERY_AI_OK") >"${LOG}" 2>&1
    ;;
  *)
    (cd "${WORKDIR}" && "${AGENT_CMD}" -p "Return exactly: BINDERY_AI_OK") >"${OUT}" 2>"${LOG}"
    ;;
esac

if ! grep -qx "BINDERY_AI_OK" "${OUT}"; then
  echo "FAIL: agent did not return the expected final message" >&2
  echo "--- final message ---" >&2
  sed -n '1,80p' "${OUT}" >&2 || true
  echo "--- agent log ---" >&2
  sed -n '1,120p' "${LOG}" >&2 || true
  exit 1
fi

echo "AI pipeline adapter smoke: PASS (${AGENT_CMD})"
