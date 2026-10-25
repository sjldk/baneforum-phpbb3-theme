#!/bin/bash
# Builds the test board image (docker-web:latest) inside a Claude cloud session, where containers cannot reach
# the internet directly. Starts dockerd if needed, pulls the base images (retrying Docker Hub's 429), and builds
# from a temporary copy of docker/Dockerfile. The repo is not changed. See SKILL.md in this folder.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

if ! docker ps >/dev/null 2>&1; then
	setsid nohup dockerd >/tmp/dockerd.log 2>&1 </dev/null &
	for _ in $(seq 1 30); do docker ps >/dev/null 2>&1 && break; sleep 1; done
	docker ps >/dev/null 2>&1 || { echo "dockerd did not start, see /tmp/dockerd.log" >&2; exit 1; }
fi

for image in mariadb:11 php:8.5-apache node:22-slim; do
	for _ in $(seq 1 20); do
		docker image inspect "$image" >/dev/null 2>&1 && break
		docker pull -q "$image" >/dev/null 2>&1 && break
		echo "pull of $image refused (rate limit?), retrying in 20 s"
		sleep 20
	done
	docker image inspect "$image" >/dev/null 2>&1 || { echo "could not pull $image" >&2; exit 1; }
done

# github.com/.../archive/*.tar.gz is denied by the proxy (403), a plain git clone is allowed.
version() { sed -n "s/^ARG $1=//p" "$root/docker/Dockerfile"; }
git clone -q --depth 1 --branch "$(version MARKDOWN_VERSION)" https://github.com/AlfredoRamos/phpbb-ext-markdown "$work/md"
git clone -q --depth 1 --branch "$(version MEDIAEMBED_VERSION)" https://github.com/phpbb-extensions/mediaembed "$work/me"
rm -rf "$work/md/.git" "$work/me/.git"
cp /root/.ccr/ca-bundle.crt "$work/ca.crt"
cp "$root/docker/entrypoint.sh" "$work/"

# Containers do not trust the proxy CA and reach the proxy only on the host network. The port changes per session.
port="${HTTPS_PROXY##*:}"
python3 - "$root/docker/Dockerfile" "$work/Dockerfile" "$port" <<'PY'
import re, sys
src, dst, port = sys.argv[1:4]
s = open(src).read()

def swap(pattern, replacement, text):
    new, count = re.subn(pattern, replacement, text, flags=re.S)
    if count != 1:
        sys.exit(f"docker/Dockerfile changed: no longer matches {pattern[:40]!r}")
    return new

s = swap(r"ARG PHPBB_VERSION=", (
    "COPY ca.crt /usr/local/share/ca-certificates/ccr.crt\n"
    f"ENV http_proxy=http://127.0.0.1:{port} https_proxy=http://127.0.0.1:{port}"
    " SSL_CERT_FILE=/usr/local/share/ca-certificates/ccr.crt CURL_CA_BUNDLE=/usr/local/share/ca-certificates/ccr.crt\n"
    "RUN update-ca-certificates || true\n"
    "RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/* /etc/apt/sources.list 2>/dev/null; true\n"
    "ARG PHPBB_VERSION="), s)
s = swap(r"RUN mkdir -p /var/www/html/ext/alfredoramos/markdown.*?\n\n", "COPY md /var/www/html/ext/alfredoramos/markdown\nRUN chown -R www-data:www-data /var/www/html/ext\n\n", s)
s = swap(r"RUN mkdir -p /var/www/html/ext/phpbb/mediaembed.*?\n\n", "COPY me /var/www/html/ext/phpbb/mediaembed\nRUN chown -R www-data:www-data /var/www/html/ext\n\n", s)
open(dst, "w").write(s)
PY

docker build --network host -t docker-web:latest "$work"
echo "Image docker-web:latest is built. Next: run-user-journey.sh"
