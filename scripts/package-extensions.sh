#!/usr/bin/env bash
# Packs each extension in extensions/baneforum/ into a zip for another board. The zips go to dist/.
# Usage: scripts/package-extensions.sh [--bump patch|minor|major] [name ...]
#   no name      all extensions
#   --bump       raises the version in composer.json first, then packs. Commit composer.json afterwards.
# On another board: unzip into the board's ext/ folder (the zip holds baneforum/<name>/), then
# ACP, Customise, Manage extensions, Enable. A newer zip over an old one: unzip, then ACP shows "Update".
set -euo pipefail
cd "$(dirname "$0")/.."

bump=
if [ "${1:-}" = --bump ]; then
	bump=${2:-}
	case "$bump" in
		patch | minor | major) shift 2 ;;
		*) echo "Usage: $0 [--bump patch|minor|major] [name ...]" >&2; exit 1 ;;
	esac
fi

out=dist
mkdir -p "$out"

if [ "$#" -gt 0 ]; then
	names=("$@")
else
	names=()
	for dir in extensions/baneforum/*/; do
		names+=("$(basename "$dir")")
	done
fi

for name in "${names[@]}"; do
	src=extensions/baneforum/$name
	[ -f "$src/composer.json" ] || { echo "Not an extension: $name" >&2; exit 1; }
	version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$src/composer.json" | head -1)

	if [ -n "$bump" ]; then
		IFS=. read -r major minor patch <<< "$version"
		case "$bump" in
			major) version=$((major + 1)).0.0 ;;
			minor) version=$major.$((minor + 1)).0 ;;
			patch) version=$major.$minor.$((patch + 1)) ;;
		esac
		sed -i "s/\(\"version\": *\"\)[^\"]*\"/\1$version\"/" "$src/composer.json"
	fi

	zip_path="$PWD/$out/baneforum-$name-$version.zip"
	rm -f "$zip_path"
	# The tests stay in the repo. The board does not need them.
	(cd extensions && zip -qr "$zip_path" "baneforum/$name" -x "baneforum/$name/tests/*")
	echo "$name $version -> $zip_path"
done
