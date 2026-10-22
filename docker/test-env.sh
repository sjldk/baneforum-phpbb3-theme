#!/usr/bin/env bash
# Starts the test board (http://localhost:8080), waits until phpBB is installed and fills it with dummy data.
# Login: admin / adminadmin. Users alice, bob and carol have the same password.
# Safe to run again: dummy-data.sh stops if the board is already filled.
set -euo pipefail
cd "$(dirname "$0")"

port="${HTTP_PORT:-8080}"

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
