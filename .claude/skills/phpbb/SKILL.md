---
name: phpbb
description: Work on the Baneforum phpBB 3.3 board, theme, editor or test boards. Use when a task touches phpBB templates, the style, extensions, uploads, the Docker test boards, the production copy or the browser tests. Holds the traps found so far. Add new findings here.
---

# phpBB on Baneforum

Production: phpBB 3.3.19, PHP 8.5, `alfredoramos/markdown`, `phpbb/mediaembed`, `phpbb/boardannouncements`.
Style `baneforumblue` has the path `baneforum` (this repo's `baneforum/`). The history is in `docs/editor-progress.md`.
The install steps for production are in `docs/production-install.md`.

**Rule: when you learn something about phpBB that cost time, add one line to the right table below in the same commit.**

## The two boards

| | Test board | Production copy |
|---|---|---|
| URL | http://localhost:8080 | http://localhost:8081 |
| Code | phpBB downloaded in `docker/Dockerfile` | `local-data/phpbb` (the real production tree) |
| Database | `phpbb` (installed fresh, disposable) | `phpbb_try` (clone of `phpbb_prod`) |
| Login | `admin` / `adminadmin` | `Baneforum.dk` / `adminadmin` |
| Files | empty | `local-data/production/files` |
| Start | `docker compose -f docker/docker-compose.yml up -d --build` | `docker/prod-try.sh`, then `UID GID=$(id -g) docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d --build prod` |

- `local-data/` is git-ignored. Never commit it. `phpbb_prod` is the untouched import. Do not change it. Reset `phpbb_try` with `docker/prod-try.sh`.
- The production copy board runs as your user and writes into `local-data/phpbb` (cache, store) and `local-data/production/files`.
- Do not run `docker compose down -v`. Do not drop `phpbb_prod`.
- Purge the cache after a template change: `sh docker/purge-cache.sh` (test board), or `docker exec -u 1000 docker-prod-1 php bin/phpbbcli.php cache:purge` (copy).

## Traps

| Trap | What to do |
|---|---|
| The test board has no `config.php` after the web container was recreated, and the installer says "Tables with the specified prefix already exist" or "Config file is missing data" | Drop and create the `phpbb` database (not `phpbb_prod`), then `up -d --force-recreate web`. The entrypoint installs again. |
| phpBB refuses a form sent in the same second the page was made | Tests wait 1.5 seconds before an upload. |
| phpBB checks picture size before any extension runs | `img_max_width`, `img_max_height`, `max_filesize` and `max_filesize_pm` must be 0 on every board. `extensions/baneforum/imagecompress` shrinks the picture. |
| The attachment panel holds the hidden fields sent with the form | Keep it (hidden unless there are files not in the text). Plupload still uploads, the editor hands it the files. |
| phpBB's error dialog shows during an editor upload | `bf-phpbb.js` holds it back, because the picture shows its own error. |
| An opened and saved post must keep its text exactly | The textarea is only rewritten when the writer changes something. Test with `edit.mjs`. |
| Production has only 20 smilies. `:)`, `:-)`, `:D` and `;)` are not smilies there | Emoji for those is an improvement, not a restore. Old posts are not changed in the database. |
| Production `server_name`, cookie domain and secure cookie | Set by `prod-try.sh` for localhost in the clone. Never import those values back. |
| On the copy board the founder is user 2, `Baneforum.dk` | There is no user named `admin`. |
| StatCounter loads from `overall_footer.html` | A tracker. Not changed. Ask the owner. |
| Facebook and Google login buttons | Stay. 14 production users are linked. Styles are in `login_body_oauth.html`. |

## Template overrides in this style

`baneforum/template/` holds: `attachment.html`, `index_body.html`, `login_body.html`, `login_body_oauth.html`, `navbar_header.html`,
`navbar_footer.html`, `overall_header.html`, `overall_footer.html`, `posting_editor.html`, `posting_poll_body.html`.
A file here replaces the one in prosilver. Check the prosilver original of the same phpBB version when you change one.

## Tests

| Task | Command |
|---|---|
| Editor build, test, lint | `scripts/bf-editor.sh build` / `test` / `check`. Build before you commit a change in `packages/bf-editor/src` (the built copies in `baneforum/theme/` are committed). |
| Editor alone in Chrome | `scripts/browser-tests/smoke.sh` |
| A browser test on the board | `scripts/browser-tests/run.sh <script.mjs>` (Chrome) or `BROWSER=firefox scripts/browser-tests/run.sh <script.mjs>` |
| Firefox | Puppeteer talks WebDriver BiDi. `states.mjs` uses the Chrome DevTools protocol and is Chrome only. |
| Another board | The tests use `http://localhost:8080`. Change the host in `login.mjs` and the scripts for 8081. |

Details: `scripts/browser-tests/README.md`.
