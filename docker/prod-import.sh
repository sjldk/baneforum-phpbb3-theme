#!/bin/bash
# Replaces phpbb_prod, the untouched copy of the production database, with a newer phpBB backup. The old backup files stay in local-data/db/.
#   docker/prod-import.sh [local-data/db/backup_....sql.gz]     (default: the newest file in local-data/db/)
# Then run docker/prod-try.sh to make phpbb_try (the board on port 8081) from it. Needs the main board's db container to run.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
file="${1:-}"
if [[ -z "$file" ]]; then
    file="$(find "$root/local-data/db" -name 'backup_*.sql.gz' | sort | tail -1)"
fi
[[ -f "$file" ]] || {
    echo "No backup file. Put a phpBB backup (backup_....sql.gz) in local-data/db/." >&2
    exit 1
}

db=(docker exec -i docker-db-1 mariadb -uroot -proot)
echo "Importing $(basename "$file") into phpbb_prod"
"${db[@]}" -e 'DROP DATABASE IF EXISTS phpbb_prod; CREATE DATABASE phpbb_prod CHARACTER SET utf8mb4; GRANT ALL ON phpbb_prod.* TO phpbb@"%"'
gunzip -c "$file" | "${db[@]}" phpbb_prod
"${db[@]}" -N -e "SELECT 'posts', COUNT(*) FROM phpbb_prod.phpbb_posts UNION ALL SELECT 'members', COUNT(*) FROM phpbb_prod.phpbb_users UNION ALL SELECT 'private messages', COUNT(*) FROM phpbb_prod.phpbb_privmsgs"
