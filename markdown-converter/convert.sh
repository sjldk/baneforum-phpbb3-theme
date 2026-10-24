#!/bin/bash
# Converts the Markdown rows to BBCode with the editor's converter, in a Node container (the host needs no Node).
#   markdown-converter/convert.sh
# Put markdown-rows.jsonl in markdown-converter/work/ first (from the page, or from cli/bf-markdown-export-cli.php).
# It writes markdown-converter/work/converted.jsonl. The work folder is git-ignored, because the files hold real posts and private messages.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work="$root/markdown-converter/work"

[[ -f "$work/markdown-rows.jsonl" ]] || {
    echo "Put markdown-rows.jsonl in $work first." >&2
    exit 1
}

# The converter needs the editor's packages. The install is quick when they are up to date, and makes sure that new ones are there.
"$root/scripts/bf-editor.sh" install

"$root/scripts/bf-editor.sh" exec node tools/convert-corpus.mjs ../../markdown-converter/work/markdown-rows.jsonl ../../markdown-converter/work/converted.jsonl
echo "Done: $work/converted.jsonl"
