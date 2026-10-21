#!/bin/bash
# The editor self-test in headless Chrome: packages/bf-editor/demo/smoke.html. Prints PASS or FAIL lines.
# Run scripts/bf-editor.sh build first.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root/packages/bf-editor"
python3 -m http.server 8099 >/dev/null 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
sleep 1
google-chrome --headless=new --no-sandbox --disable-gpu --virtual-time-budget=15000 --dump-dom "http://localhost:8099/demo/smoke.html" | grep -E '^(PASS|FAIL)'
