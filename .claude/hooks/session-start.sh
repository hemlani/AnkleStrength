#!/bin/bash
# SessionStart hook: install tooling so UI changes can be screenshot-verified
# (tools/shot.mjs) and sanity-checked (tools/check.mjs) during web sessions.
set -euo pipefail

# Only run in Claude Code on the web (remote) sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# In real hook runs the harness sets CLAUDE_PROJECT_DIR; fall back to the
# script's repo root so the hook is also runnable by hand.
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"}"
cd "$PROJECT_DIR"

# Node deps (Playwright). The npm registry is on the default egress allowlist.
npm install --no-audit --no-fund

# Chromium binary for screenshots. This download host is NOT on the default
# egress allowlist, so it may 403. Keep it non-fatal: the check script and the
# rest of the session still work without a browser.
if ! npx playwright install chromium; then
  echo ""
  echo "NOTE: Chromium could not be downloaded (likely blocked by network egress)."
  echo "      To enable screenshots (npm run shot), add this host to the"
  echo "      environment's network egress allowlist and re-run the hook:"
  echo "          cdn.playwright.dev"
  echo "      Then: npx playwright install chromium"
fi
