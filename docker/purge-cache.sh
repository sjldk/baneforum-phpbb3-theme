#!/usr/bin/env bash
# Clears the phpBB template cache so theme edits show up.
cd "$(dirname "$0")" && docker compose exec web php bin/phpbbcli.php cache:purge
