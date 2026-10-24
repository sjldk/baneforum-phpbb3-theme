#!/bin/bash
# Makes a folder with what Baneforum adds to a phpBB site: the style and our extensions. Nothing else.
# Copy the folder to a server by hand (rsync, scp, FTP). It holds no phpBB core files, no config.php, no data.
#
#   scripts/publish.sh [options] [OUT_DIR]       (default OUT_DIR: dist/publish)
#     --host HOST     the sub domain for a test on a copy of the live data, written into PUBLISH.md (default: TEST_HOST)
#     --scheme S      http or https for that test site (default: https)
#     --build         build the editor first (scripts/bf-editor.sh build). Stops if the built files differ from git.
#     --allow-dirty   publish although git has uncommitted changes (the manifest says so)
#     --force         empty OUT_DIR first. Only done for a folder that an earlier run made (it holds .baneforum-publish).
#
# The folder:
#   styles/baneforum/        the style, without *.orig and the style guide page
#   ext/baneforum/<name>/    each extension, without its tests
#   PUBLISH.md               what is in it, and the steps for a sub domain test on a copy of the live data
#   MANIFEST.sha256          a checksum of every file (check with: cd OUT_DIR && sha256sum -c MANIFEST.sha256)
set -euo pipefail

usage() {
    sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//' >&2
    exit 1
}

host=TEST_HOST
scheme=https
build=0
allow_dirty=0
force=0
out=

while [[ $# -gt 0 ]]; do
    case "$1" in
        --host) host=${2:?--host needs a value}; shift 2 ;;
        --scheme) scheme=${2:?--scheme needs a value}; shift 2 ;;
        --build) build=1; shift ;;
        --allow-dirty) allow_dirty=1; shift ;;
        --force) force=1; shift ;;
        -h | --help) usage ;;
        -*) echo "Unknown option: $1" >&2; usage ;;
        *) out=$1; shift ;;
    esac
done

case "$scheme" in
    http | https) ;;
    *) echo "--scheme must be http or https" >&2; exit 1 ;;
esac

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$root" || exit 1
out=${out:-$root/dist/publish}
case "$out" in
    /*) ;;
    *) out=$PWD/$out ;;
esac

# 1. The source must be what git says it is.
dirty=$(git status --porcelain | wc -l)
if [[ $dirty -gt 0 && $allow_dirty -eq 0 ]]; then
    echo "git has $dirty uncommitted change(s). Commit them, or use --allow-dirty." >&2
    exit 1
fi

if [[ $build -eq 1 ]]; then
    scripts/bf-editor.sh build
    if [[ -n $(git status --porcelain baneforum/theme/js baneforum/theme/bf-render.css) ]]; then
        echo "The built editor files differ from git. Commit the new build first." >&2
        exit 1
    fi
fi

# 2. The output folder. Only a folder that an earlier run made may be emptied.
if [[ -e $out && -n $(ls -A "$out") ]]; then
    if [[ $force -eq 0 ]]; then
        echo "$out is not empty. Use --force to replace an earlier publish." >&2
        exit 1
    fi
    if [[ ! -f $out/.baneforum-publish ]]; then
        echo "$out has no .baneforum-publish file, so an earlier run did not make it. I will not empty it." >&2
        exit 1
    fi
    find "${out:?}" -mindepth 1 -delete
fi
mkdir -p "$out/styles/baneforum" "$out/ext/baneforum"

# 3. Copy. tar keeps the folder structure and handles the excludes.
copy() { # copy SRC DEST [tar exclude ...]
    local src=$1 dest=$2
    shift 2
    local args=()
    for pattern in "$@"; do
        args+=("--exclude=$pattern")
    done
    tar -C "$src" "${args[@]}" -cf - . | tar -C "$dest" -xf -
}

copy baneforum "$out/styles/baneforum" '*.orig' './theme/styleguide.html'

names=()
for dir in extensions/baneforum/*/; do
    name=$(basename "$dir")
    [[ -f $dir/composer.json ]] || continue
    mkdir -p "$out/ext/baneforum/$name"
    copy "$dir" "$out/ext/baneforum/$name" './tests'
    names+=("$name")
done

# 4. Nothing secret may go out.
bad=$(find "$out" \( -name 'config.php' -o -name '.env*' -o -name '*.key' -o -name '*.pem' -o -name 'id_rsa*' \) -print)
if [[ -n $bad ]]; then
    echo "A file that may hold a secret is in the output:" >&2
    echo "$bad" >&2
    exit 1
fi
if grep -rIl -e 'BEGIN [A-Z ]*PRIVATE KEY' "$out" >/dev/null 2>&1; then
    echo "A private key is in the output. Stopped." >&2
    exit 1
fi

# 5. The notes and the manifest.
commit=$(git rev-parse --short HEAD)
branch=$(git branch --show-current)
stamp=$(date '+%Y-%m-%d %H:%M')
port=443
[[ $scheme == http ]] && port=80
secure=1
[[ $scheme == http ]] && secure=0

# The editor extension goes first: the editor needs it.
ordered=()
[[ " ${names[*]} " == *" editor "* ]] && ordered+=(editor)
for name in "${names[@]}"; do
    [[ $name == editor ]] || ordered+=("$name")
done

{
    cat <<EOF
# Baneforum publish

Made $stamp from commit \`$commit\` on branch \`${branch:-detached}\` ($dirty uncommitted change(s) when it was made).

| In this folder | Goes to on the site |
|---|---|
| \`styles/baneforum/\` | \`styles/baneforum/\` |
EOF
    for name in "${ordered[@]}"; do
        echo "| \`ext/baneforum/$name/\` | \`ext/baneforum/$name/\` |"
    done
    cat <<'EOF'

No phpBB core files, no `config.php` and no data are in this folder. The live steps are in `docs/production-install.md`
(back up first, then follow it in order).

## Test on a sub domain with a copy of the live data

**Use a copy of the live database, never the live one.** Installing the style and enabling extensions writes to the database.
Do the same with the files: a copy of the site folder, not the live folder.

1. **Copy the site.** Make a new site folder for the sub domain. Copy the whole live site folder into it (including `files/`,
   `store/` and `images/avatars/upload/`). Empty `cache/` in the copy.
2. **Copy the database.** Dump the live database and load it into a new database with its own user:
   `mysqldump --single-transaction LIVE_DB | mysql TEST_DB`
3. **Point the copy at the test database.** Edit `config.php` **in the copy**: database name, user and password.
   Do not touch the live `config.php`.
4. **Make the copy a separate site.** Run this in the **test** database (the table prefix is `phpbb_`; change it if yours differs):
EOF
    cat <<EOF

   \`\`\`sql
   UPDATE phpbb_config SET config_value='$host' WHERE config_name IN ('server_name', 'cookie_domain');
   UPDATE phpbb_config SET config_value='$port' WHERE config_name='server_port';
   UPDATE phpbb_config SET config_value='$scheme://' WHERE config_name='server_protocol';
   UPDATE phpbb_config SET config_value='$secure' WHERE config_name IN ('cookie_secure', 'force_server_vars');
   -- the copy must not send mail to the real members:
   UPDATE phpbb_config SET config_value='0' WHERE config_name IN ('email_enable', 'smtp_delivery');
   \`\`\`

   If the site is not at the root of the sub domain, also check \`script_path\`.
5. **Add our files.** Copy \`styles/\` and \`ext/\` from this folder over the test site's (they add \`styles/baneforum\` and \`ext/baneforum/*\`).
   Give the web server user the files: \`chown -R www-data: styles/baneforum ext/baneforum\` (use your web user).
6. **Purge the cache:** \`php bin/phpbbcli.php cache:purge\` in the test site.
7. **Enable the extensions**, in this order (the editor first):

   \`\`\`
EOF
    for name in "${ordered[@]}"; do
        echo "   php bin/phpbbcli.php extension:enable baneforum/$name"
    done
    cat <<'EOF'
   ```

8. **Install the style.** ACP, Customise, Styles, Install styles: install the Baneforum style, or click Refresh if it is already installed.
   Make it the default style. Also set the board settings that `docs/production-install.md` lists (the picture size limits must be 0).
9. **Look.** Front page, a topic with a video, a topic with pictures, the posting page, a private message, the member list, the phone width.
   Log in with a normal account. Facebook and Google login do not work on the sub domain (the providers only know the live address).
10. **Keep it private.** Put a password on the sub domain (web server basic auth) and tell search engines to stay away
    (`X-Robots-Tag: noindex`). The style's footer holds the StatCounter script, so test visits are counted.
11. **Remove it** when you are done: delete the test site folder and drop the test database.

To go back after a test on a copy, there is nothing to undo on the live site.
EOF
} >"$out/PUBLISH.md"

touch "$out/.baneforum-publish"
(cd "$out" && find styles ext -type f -print0 | sort -z | xargs -0 sha256sum >MANIFEST.sha256)

files=$(wc -l <"$out/MANIFEST.sha256")
echo "Published $files files (${#names[@]} extensions) from $commit to:"
echo "  $out"
echo "Next: read $out/PUBLISH.md"
