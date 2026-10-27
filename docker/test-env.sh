#!/usr/bin/env bash
# Starts the test board, waits until phpBB is installed and fills it with dummy data.
# Login: admin / adminadmin. Users alice, bob and carol have the same password.
# Safe to run again: dummy-data.sh stops if the board is already filled.
# The port is random, so it does not clash with other things. HTTP_PORT=8080 test-env.sh picks a fixed one.
# The URL is saved in docker/.test-url. scripts/browser-tests/run.sh reads it.
set -euo pipefail
cd "$(dirname "$0")"

# A port that is free: no listener on it.
free_port() {
	local p
	while :; do
		p=$((RANDOM % 20000 + 20000))
		ss -ltn "sport = :$p" | grep -q LISTEN || { echo "$p"; return; }
	done
}

# Reuse the port of a board that already runs, so a second run does not move it.
if [ -z "${HTTP_PORT:-}" ] && [ -s .test-url ] && [ -n "$(docker compose ps -q web 2>/dev/null)" ]; then
	HTTP_PORT="$(sed 's/.*://' .test-url)"
fi
export HTTP_PORT="${HTTP_PORT:-$(free_port)}"
port="$HTTP_PORT"
echo "http://localhost:${port}" >.test-url
echo "Test board port: ${port}  (http://localhost:${port})"

docker compose up -d --build

echo "Waiting for phpBB to install (the first start takes a few minutes)..."
for _ in $(seq 1 180); do
	if docker compose exec -T web test -s /var/www/html/config.php 2>/dev/null \
		&& [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${port}/")" = 200 ]; then
		ready=1
		break
	fi
	sleep 2
done
[ "${ready:-0}" = 1 ] || { echo "The board did not start in 6 minutes. See: docker compose logs web" >&2; exit 1; }

# The entrypoint may still be enabling extensions after the first page works.
until docker compose exec -T db mariadb -u phpbb -pphpbb --skip-ssl phpbb -N \
	-e "SELECT 1 FROM phpbb_ext WHERE ext_name='baneforum/imagecompress' AND ext_active=1" 2>/dev/null | grep -q 1; do
	sleep 2
done

./purge-cache.sh
./dummy-data.sh
echo "Ready: http://localhost:${port}  (admin / adminadmin)"
