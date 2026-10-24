#!/bin/bash
# Runs everything PHP for this repo inside a container, so the host needs no PHP (as scripts/bf-editor.sh does for Node).
#   php-check.sh build           build the image (tools/php/Dockerfile: PHP 8.5 with GD, composer)
#   php-check.sh install         install the code standard tools (tools/php/vendor, not in git)
#   php-check.sh lint            php -l on every PHP file
#   php-check.sh check [args]    the code standard: phpBB's extension rules plus our rules for comments (tools/php/ruleset.xml)
#                                extra arguments go to phpcs, for example "--report=source" for a count per rule;
#                                PHP_PATHS="extensions/baneforum/likes" checks only those paths
#   php-check.sh fix             let phpcbf repair what it can (layout only, never comments)
#   php-check.sh test            the tests of every extension (extensions/baneforum/*/tests/*.php); the ones that need phpBB run in the board image
#   php-check.sh all             lint, check and test
# The first call builds the image and installs the tools, which needs the network once.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
image="bf-php-tools"
sources=(extensions scripts docker)

usage() {
    echo "Usage: ${0##*/} build|install|lint|check [phpcs args]|fix|test|all" >&2
    exit 1
}

[[ $# -ge 1 ]] || usage
command -v docker >/dev/null 2>&1 || {
    echo "docker is needed" >&2
    exit 1
}

build() {
    docker build --quiet --tag "$image" "$root/tools/php" >/dev/null
}

# Runs a command in the container, with the repo mounted at /repo and the same user as on the host.
run() {
    docker image inspect "$image" >/dev/null 2>&1 || build
    docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$root:/repo" -w /repo "$image" "$@"
}

install_tools() {
    run composer install --working-dir=tools/php --no-interaction --no-progress --quiet
}

ensure_tools() {
    [[ -x "$root/tools/php/vendor/bin/phpcs" ]] || install_tools
}

lint() {
    local failed=0 file
    while IFS= read -r file; do
        if ! run php -l "$file" >/dev/null; then
            failed=1
        fi
    done < <(cd "$root" && find "${sources[@]}" -name '*.php' -not -path '*/node_modules/*' | sort)
    if [[ $failed -eq 0 ]]; then
        echo "php -l: no syntax errors"
    fi
    return "$failed"
}

check() {
    ensure_tools
    local -a paths=("${sources[@]}")
    # PHP_PATHS="extensions/baneforum/likes scripts" checks only those paths
    if [[ -n "${PHP_PATHS:-}" ]]; then
        read -r -a paths <<<"$PHP_PATHS"
    fi
    run php tools/php/vendor/bin/phpcs --standard=tools/php/ruleset.xml --extensions=php -s --report-width=120 \
        "$@" "${paths[@]}"
}

fix() {
    ensure_tools
    run php tools/php/vendor/bin/phpcbf --standard=tools/php/ruleset.xml --extensions=php "${sources[@]}" || true
}

# A test that loads phpBB (it requires vendor/autoload.php) runs in the board's own image, with the extensions mounted
# where the board expects them. BOARD_IMAGE changes the image name (default docker-web, from docker/docker-compose.yml).
board_test() {
    local image="${BOARD_IMAGE:-docker-web}"
    if ! docker image inspect "$image" >/dev/null 2>&1; then
        echo "SKIPPED: needs the image $image (docker compose -f docker/docker-compose.yml build)" >&2
        return 0
    fi
    docker run --rm --entrypoint "" -v "$root/extensions/baneforum:/var/www/html/ext/baneforum:ro" -w /var/www/html \
        "$image" php "ext/baneforum/${1#extensions/baneforum/}"
}

tests() {
    local failed=0 file
    while IFS= read -r file; do
        echo "== $file"
        if grep -q 'vendor/autoload.php' "$root/$file"; then
            board_test "$file" || failed=1
        elif ! run php "$file"; then
            failed=1
        fi
    done < <(cd "$root" && find extensions -path '*/tests/*.php' | sort)
    return "$failed"
}

case "$1" in
build) build ;;
install) install_tools ;;
lint) lint ;;
check)
    shift
    check "$@"
    ;;
fix) fix ;;
test) tests ;;
all)
    status=0
    lint || status=1
    check || status=1
    tests || status=1
    exit "$status"
    ;;
*) usage ;;
esac
