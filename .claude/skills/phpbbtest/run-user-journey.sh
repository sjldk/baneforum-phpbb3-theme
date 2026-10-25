#!/bin/bash
# Starts the test board from the image build-image.sh made, fills it, and runs the user-journey test in Chromium.
# Prints the PASS/FAIL lines. Exit status 0 when every check passes. Takes about 4 minutes. See SKILL.md.
#   run-user-journey.sh [script.mjs]     (default user-journey.mjs, any script in scripts/browser-tests)
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
script="${1:-user-journey.mjs}"
db=(docker compose -f "$root/docker/docker-compose.yml" exec -T db mariadb -u phpbb -pphpbb --skip-ssl phpbb)

docker ps >/dev/null 2>&1 || { echo "No Docker daemon. Run build-image.sh first (it starts one)." >&2; exit 1; }
docker image inspect docker-web:latest >/dev/null 2>&1 || { echo "No image docker-web:latest. Run build-image.sh first." >&2; exit 1; }

cd "$root/docker"
docker compose up -d --no-build >/dev/null
for _ in $(seq 1 90); do
	docker compose exec -T web test -s /var/www/html/config.php 2>/dev/null \
		&& [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/)" = 200 ] && break
	sleep 5
done
# The entrypoint may still be enabling extensions after the first page works.
until "${db[@]}" -N -e "SELECT 1 FROM phpbb_ext WHERE ext_name='baneforum/imagecompress' AND ext_active=1" 2>/dev/null | grep -q 1; do sleep 3; done

# Dummy data first, then the purge: the index is cached, so a purge before the data shows only "Your first forum".
./dummy-data.sh >/dev/null 2>&1 || true
./purge-cache.sh >/dev/null 2>&1
# Each run adds a failed login; after 3 phpBB asks for a captcha.
"${db[@]}" -e "DELETE FROM phpbb_login_attempts; UPDATE phpbb_users SET user_login_attempts=0"

cd "$root/scripts/browser-tests"
[ -d node_modules ] || npm install --no-audit --no-fund >/dev/null 2>&1

chrome="$(ls /opt/pw-browsers/chromium-*/chrome-linux*/chrome 2>/dev/null | head -1)"
[ -n "$chrome" ] || { echo "No Chromium under /opt/pw-browsers." >&2; exit 1; }
port=9223
curl -s -m 3 "http://127.0.0.1:$port/json/version" >/dev/null || {
	setsid nohup "$chrome" --headless=new --no-sandbox --disable-gpu --remote-debugging-port=$port \
		--user-data-dir="$(mktemp -d)" about:blank >/dev/null 2>&1 </dev/null &
	for _ in $(seq 1 15); do curl -s -m 3 "http://127.0.0.1:$port/json/version" >/dev/null && break; sleep 1; done
}

PORT=$port BF_USER="${BF_USER:-alice}" HOST_DIR="$PWD" node "$script"
