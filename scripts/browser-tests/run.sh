#!/bin/bash
# Runs one browser test against the Docker board. The URL is in docker/.test-url (written by docker/test-env.sh),
# or set BASE yourself. Without both it is http://localhost:8080.
#   run.sh <script.mjs> [arguments]          (BROWSER=firefox run.sh ... runs it in Firefox)
#   PORT=9223 run.sh ...  uses another debugging port (default 9222, for when Firefox already holds it)
# Starts headless Chrome with remote debugging, then runs the script with puppeteer-core in a Node
# container. HOST_DIR is this folder as the host sees it (Chrome runs on the host, so file uploads
# need host paths). The scripts write screenshots to /w, which is this folder.
set -euo pipefail

dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ $# -ge 1 ]] || { echo "Usage: ${0##*/} <script.mjs> [arguments]" >&2; exit 1; }

[[ -d "$dir/node_modules" ]] || docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$dir:/w" -w /w node:22-slim npm install --no-audit --no-fund

if [[ -z "${BASE:-}" && -s "$dir/../../docker/.test-url" ]]; then
	BASE="$(<"$dir/../../docker/.test-url")"
fi
export BASE="${BASE:-http://localhost:8080}"
echo "Board: $BASE"

profile="$(mktemp -d)"
if [[ "${BROWSER:-chrome}" == firefox ]]; then
	firefox --headless --no-remote --profile "$profile" --remote-debugging-port="${PORT:-9222}" about:blank >/dev/null 2>&1 &
else
	google-chrome --headless=new --no-sandbox --disable-gpu --remote-debugging-port="${PORT:-9222}" --user-data-dir="$profile" about:blank >/dev/null 2>&1 &
fi
chrome=$!
trap 'kill "$chrome" 2>/dev/null || true; sleep 1; rm -rf "$profile" 2>/dev/null || true' EXIT
sleep 4

docker run --rm --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -e HOST_DIR="$dir" -e BROWSER="${BROWSER:-chrome}" -e PORT="${PORT:-9222}" -e BASE -e BF_USER -e BF_PASS -e TOPIC -e GUEST -e PAGES -e CONVERTED -v "$dir:/w" -w /w node:22-slim node "$@"
