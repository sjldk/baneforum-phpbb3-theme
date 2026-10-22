#!/usr/bin/env bash
# Fills the test board (http://localhost:8080) with forums, users and topics in every status.
# Users alice, bob and carol have the password adminadmin. Stops if the board is already filled.
cd "$(dirname "$0")" || exit 1
docker compose cp dummy-data.php web:/tmp/dummy-data.php
docker compose exec --user www-data web php /tmp/dummy-data.php
