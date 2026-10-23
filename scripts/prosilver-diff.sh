#!/bin/bash
# Show what prosilver changed between the release we last reviewed and a new one,
# for the files we override. Our own edits never show up.
# Usage: scripts/prosilver-diff.sh <new-version>
# The reviewed version is in docs/prosilver-reviewed. Change it after you went through the diffs.
# Output: one .diff per changed override in local-data/prosilver-diff/<old>-<new>/ (git-ignored).
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
new="${1:-}"
old="$(tr -d '[:space:]' <"$root/docs/prosilver-reviewed")"
if [[ -z "$new" ]]; then
    echo "Usage: $0 <new-version>   (reviewed so far: $old)" >&2
    exit 1
fi
cache="$root/local-data/prosilver-releases"
out="$root/local-data/prosilver-diff/$old-$new"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fetch() {
    [[ -d "$cache/$1/styles/prosilver" ]] && return 0
    curl -fsSL -o "$tmp/phpbb.zip" "https://download.phpbb.com/pub/release/3.3/$1/phpBB-$1.zip"
    unzip -q -o "$tmp/phpbb.zip" 'phpBB3/styles/prosilver/*' -d "$tmp/$1"
    mkdir -p "$cache/$1"
    mv "$tmp/$1/phpBB3/styles" "$cache/$1/styles"
}
fetch "$old"
fetch "$new"
a="$cache/$old/styles/prosilver"
b="$cache/$new/styles/prosilver"

rm -rf "${out:?}"
mkdir -p "$out"
echo "Prosilver $old to $new, files we override:"
echo
echo "| # | File | Lines changed upstream |"
echo "|---|---|---|"
n=0
for f in "$root"/baneforum/template/*.html "$root"/baneforum/theme/*.css; do
    rel="${f#"$root"/baneforum/}"
    [[ -f "$b/$rel" ]] || continue
    cmp -s "$a/$rel" "$b/$rel" && continue
    n=$((n + 1))
    diff -u "$a/$rel" "$b/$rel" >"$out/${rel//\//_}.diff" || true
    echo "| $n | $rel | $(grep -c '^[+-][^+-]' "$out/${rel//\//_}.diff" || true) |"
done
[[ $n -gt 0 ]] || echo "| - | none | 0 |"

echo
echo "Changed upstream, not overridden by us (they follow prosilver, check our CSS still fits):"
echo
mapfile -t others < <(diff -rq "$a/template" "$b/template" | sed -n 's|^Files .*/template/\(.*\) and .*|template/\1|p; s|^Only in .*/template: \(.*\)|template/\1|p'
    diff -rq "$a/theme" "$b/theme" | sed -n 's|^Files .*/theme/\(.*\) and .*|theme/\1|p; s|^Only in .*/theme: \(.*\)|theme/\1|p')
echo "| # | File |"
echo "|---|---|"
m=0
for rel in "${others[@]}"; do
    [[ -f "$root/baneforum/$rel" ]] && continue
    m=$((m + 1))
    echo "| $m | $rel |"
done
echo
echo "Diffs: ${out#"$root"/}. When done, write $new to docs/prosilver-reviewed."
