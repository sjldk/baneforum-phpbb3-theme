#!/bin/bash
# Runs one browser test against the Docker board (http://localhost:8080).
#   run.sh <script.mjs> [arguments]
# Starts headless Chrome with remote debugging, then runs the script with puppeteer-core in a Node
# container. HOST_DIR is this folder as the host sees it (Chrome runs on the host, so file uploads
# need host paths). The scripts write screenshots to /w, which is this folder.
set -euo pipefail

dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ $# -ge 1 ]] || { echo "Usage: ${0##*/} <script.mjs> [arguments]" >&2; exit 1; }

[[ -d "$dir/node_modules" ]] || docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$dir:/w" -w /w node:22-slim npm install --no-audit --no-fund

profile="$(mktemp -d)"
google-chrome --headless=new --no-sandbox --disable-gpu --remote-debugging-port=9222 --user-data-dir="$profile" about:blank >/dev/null 2>&1 &
chrome=$!
trap 'kill "$chrome" 2>/dev/null || true; sleep 1; rm -rf "$profile" 2>/dev/null || true' EXIT
sleep 2

docker run --rm --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -e HOST_DIR="$dir" -v "$dir:/w" -w /w node:22-slim node "$@"
