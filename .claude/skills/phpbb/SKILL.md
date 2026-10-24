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

- `local-data/` is git-ignored. Never commit it. `phpbb_prod` is the untouched import. Do not change it. Reset `phpbb_try` with `docker/prod-try.sh`. A newer production backup goes in `local-data/db/`; `docker/prod-import.sh` replaces `phpbb_prod` with the newest one (the older files stay), then run `docker/prod-try.sh`.
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
| Fixed `px` sizes in the theme CSS | Use `rem`, and `em` in media queries. Keep 1px borders, the 16px minimum of form fields (iOS zoom) and `px` inside SVG (`.attachment-icon .type`), because SVG text scales with its viewBox. |
| Prosilver caps menus at 300px and scrolls inside them, and fixes icons at 14px | `baneforum_common.css` removes the cap and sets icons to `1.25em`. Prosilver itself still has about 690 `px` values. |
| Extension routes are in `config/routing.yml`, not `routes.yml` | A wrong name gives `RouteNotFoundException` and a fatal error on every page that makes the URL. Purge the cache after the fix. |
| `extensions/baneforum` is owned by `www-data` (Docker made it) | Create a new extension folder with `docker exec -u root docker-web-1 mkdir`, then `chown 1000:1000` it. Then you can write in it. |
| phpBB's word censor changes words inside URLs (`maerklin.de` becomes `Märklin.de`) and breaks links | It censors the whole HTML including `href` (`renderer.php`, `censorHtml($html, true)`). `extensions/baneforum/censor` takes the core censor out and censors text only, keeping URLs. The ACP word list is still used. Test: `docker compose exec web php ext/baneforum/censor/tests/censor_test.php` |
| Check our overrides against a new phpBB release | `scripts/prosilver-diff.sh <new-version>` shows what prosilver changed since the release in `docs/prosilver-reviewed`, for the files we override, plus a list of changed files we do not override. Read the diffs, copy what you need by hand, then write the new version into `docs/prosilver-reviewed`. |
| A new bar of tool buttons in the editor (like the table bar) | Make it a `<menu role="toolbar">` that looks exactly like the main toolbar: the `menu` and `menu button` rules in `bf-editor.css`. No own colours, border, shadow or button size, only its place may differ. The owner's rule. |
| Portrait phone photos come out sideways | phpBB's browser-side resize (ACP, Image category settings: "Maximum image dimensions" above 0 x 0) turns them wrongly in Chrome. Tested with `scripts/browser-tests/upload-photo.mjs` and an EXIF-tagged photo: strip metadata No keeps the tag after turning the pixels (viewers turn it again), strip Yes turns them twice. With `imagecompress` also on, a photo is turned a second time. Dimensions 0 x 0 (browser resize off) plus `imagecompress` gave an upright picture and thumbnail for tags 6 and 3. Only Chrome was tested. |
| Tables and lists in the editor | `prosemirror-tables` arrow key handling expects paragraphs in the cells. Ours hold inline text, so it ends in an invisible gap cursor: `moveInTable` and `leaveTable` in `table-commands.js` do the arrow keys, and they must stay before `gapCursor()` in the plugin list. A cell holds inline text only (`[td]` makes no paragraphs). Tables are at most 20 columns (`MAX_TABLE_COLUMNS` in `schema.js`: picker, add column, paste). The board needs the helper extension `baneforum/editor` for the table BBCodes. A dialog that closes moves the browser cursor to the start of the text, so a command that opens one must put the selection back (see `table-commands.js`). In the plugin list `tableEditing()` stays after the paste plugin, or `handlePaste` finds it first. Test: `scripts/browser-tests/tables-lists.mjs`. |
| The saved format is BBCode. The editor needs `extensions/baneforum/editor` on the board | It adds the `[s]` BBCode and sets `BF_MARKDOWN` on the posting page for a post whose stored XML holds Markdown (`markdown_detector.php`). The editor then reads that post as Markdown and saves BBCode. Without the extension a Markdown post that is opened and saved loses its formatting. Test: `docker compose exec web php ext/baneforum/editor/tests/markdown_detector_test.php` and `scripts/browser-tests/markdown.mjs`. |
| Markdown extension: production has 1.2.0 (no per-post flag), the test board 1.5.0 (`phpbb_posts.enable_markdown`) | Never rely on the flag. Decide from the stored XML. The editor sends `disable_markdown=1`, which both versions read. |
| Firefox keeps an `@import`ed stylesheet (`stylesheet.css` imports our CSS) in its own cache, so a CSS edit may not show, even after a reload | Measure in `scripts/browser-tests` (Chrome starts with a clean profile each run), or clear the cache in the browser. `headers.mjs` shows how. |
| Firefox holds port 9222, so `run.sh` cannot start Chrome | `PORT=9223 scripts/browser-tests/run.sh <script.mjs>` |
| Facebook and Google login buttons | Stay. 14 production users are linked. Styles are in `login_body_oauth.html`. |

## Design rules

| Rule | What it means |
|---|---|
| A link that works as a button never has an underline, in any state | Nav bar and menu links, post buttons, contact buttons, page numbers, tabs, the footer of a video card and every `.button`. They are told apart by a surface, and hover and keyboard focus show a soft background (the focus ring stays). Links in running text keep their underline. The list is one rule in `baneforum_common.css` (search for "RULE: a link that works as a button"). A new kind of button-like link is added to that list. |

## Template overrides in this style

`baneforum/template/` holds: `attachment.html`, `index_body.html`, `login_body.html`, `login_body_oauth.html`, `navbar_header.html`,
`navbar_footer.html`, `overall_header.html`, `overall_footer.html`, `posting_editor.html`, `posting_poll_body.html`.
A file here replaces the one in prosilver. Check the prosilver original of the same phpBB version when you change one.

## Tests

| Task | Command |
|---|---|
| Editor build, test, lint | `scripts/bf-editor.sh build` / `test` / `check`. Build before you commit a change in `packages/bf-editor/src` (the built copies in `baneforum/theme/` are committed). |
| PHP: syntax, code standard, extension tests | `scripts/php-check.sh all` (or `lint` / `check` / `fix` / `test`). Runs in a container (`tools/php`, PHP 8.5 like the board), the host needs no PHP. The standard is phpBB's extension ruleset (release 3.3.19, copied to `tools/php/phpbb-standard/`) plus our rules for comments in `tools/php/ruleset.xml`. Rules and the comment standard for PHP and JS: `docs/code-style-php.md`. |
| Editor alone in Chrome | `scripts/browser-tests/smoke.sh` |
| A browser test on the board | `scripts/browser-tests/run.sh <script.mjs>` (Chrome) or `BROWSER=firefox scripts/browser-tests/run.sh <script.mjs>` |
| Firefox | Puppeteer talks WebDriver BiDi. `states.mjs` uses the Chrome DevTools protocol and is Chrome only. |
| Style sheet page | `baneforum/theme/styleguide.html` shows every button level, surface, heading, list row, post card and form field in both themes. Open `/styles/baneforum/theme/styleguide.html` on the test board after a style change, and run `styleguide.mjs`. Add a new part of the theme to it. |
| Another board | The tests use `http://localhost:8080`. Change the host in `login.mjs` and the scripts for 8081. |

Details: `scripts/browser-tests/README.md`.
