#!/bin/bash
# Run npm commands for packages/bf-editor inside a Node container.
# The host has no Node. Files in node_modules and dist belong to the host user.
#
# Usage: scripts/bf-editor.sh install|build|test|lint|format|typecheck|check|exec <command...>|<any npm args>
set -euo pipefail

NODE_IMAGE="node:22-slim"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
package="$root/packages/bf-editor"

if [[ $# -eq 0 ]]; then
    echo "Usage: ${0##*/} install|build|test|lint|format|typecheck|check|exec <command...>|<npm args>" >&2
    exit 1
fi

[[ -d "$package" ]] || {
    echo "Missing $package" >&2
    exit 1
}

case "$1" in
install | build | test | lint | format | format:check | typecheck | check) args=(npm run --silent "$1") ;;
exec) args=("${@:2}") ;;
*) args=(npm "$@") ;;
esac
if [[ "$1" == "install" ]]; then
    args=(npm install --no-audit --no-fund)
fi

docker run --rm \
    --user "$(id -u):$(id -g)" \
    --env HOME=/tmp \
    --volume "$root:/repo" \
    --volume "$root/local-data:/local-data" \
    --workdir /repo/packages/bf-editor \
    "$NODE_IMAGE" "${args[@]}"

# After a build, the script for pages that show posts goes into the theme, which phpBB serves.
if [[ "$1" == "build" ]]; then
    mkdir -p "$root/baneforum/theme/js"
    cp "$package/dist/bf-render.js" "$root/baneforum/theme/js/bf-render.js"
    cp "$package/dist/bf-render.css" "$root/baneforum/theme/bf-render.css"
    cp "$package/dist/bf-editor.js" "$root/baneforum/theme/js/bf-editor.js"
fi
