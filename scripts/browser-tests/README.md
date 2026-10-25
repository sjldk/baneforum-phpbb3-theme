# Browser tests

Tests that run in a real Chrome against the Docker board at `http://localhost:8080`. They are dev tools only.
They log in as `admin` (the test board's password is in `docker/docker-compose.yml` and `docker/entrypoint.sh`).

Needs: Docker, Google Chrome on the host. Node runs in a container (`node:22-slim`), the same way as
`scripts/bf-editor.sh`. The first run installs `puppeteer-core` and `axe-core` into `node_modules` here.

```bash
docker compose -f docker/docker-compose.yml up -d     # the board
scripts/bf-editor.sh build                            # the editor
scripts/browser-tests/fixtures.sh                     # files to upload (once)
scripts/browser-tests/run.sh posting.mjs              # one test
```

| Script | What it checks |
|---|---|
| `smoke.sh` | The editor alone (`demo/smoke.html`): toolbar, link dialog, YouTube player, picture upload with a fake host. |
| `axe-pages.mjs` | axe-core (WCAG A, AA, AAA) on the pages the theme work touches, with the delete dialog open and at phone width. Last run: no problems. |
| `axe-more.mjs` | axe-core (WCAG A, AA, AAA) in the light and the dark theme on 11 pages the others skip: control panel, private messages, profile settings, search, member list, a profile, reply with review, a topic with pictures. Last run: 22 of 22 pass. On another board: `BASE=http://localhost:8081 GUEST=1 TOPIC=4512` (guest pages only), run on the production copy: all pass. Logged in on the copy: add `BF_USER=Baneforum.dk BF_PASS=adminadmin` and drop `GUEST` (passes, except the grey inline colour that a poster chose in a signature, `style="color:#555555"`, which is 1.9:1 in the dark theme). Start the browser with a new `--user-data-dir`, or it shows cached CSS from the last run. |
| `styleguide.mjs` | The style sheet page `baneforum/theme/styleguide.html` (open it at `/styles/baneforum/theme/styleguide.html` on a board that has the style): axe-core in the light and the dark theme, and the font weights. Last run: 3 checks pass. |
| `darkmode.mjs` | The dark theme switch: click turns `data-theme` on and off, the choice is kept in localStorage and is back at DOMContentLoaded after a reload, and axe-core (contrast, AA and AAA) finds nothing on six pages in the dark theme. Last run: 16 checks pass. |
| `dialogs.mjs` | Delete and restore of a post ask in a native `<dialog>` on the same page: opens as a modal, Escape cancels, confirming deletes and restores. Makes a throwaway reply. |
| `snap.mjs <out.json> <selector>...` | Computed styles of the matching elements on 25 pages, each keyed by its path in the page. Run it before and after a CSS change and compare the two files. `*` takes every element. `W=400` sets the window width and `DARK=1` turns the dark theme on. Used when a prosilver CSS file was replaced by our own. |
| `tables-lists.mjs` | Lists and tables in the editor with the real keyboard and pointer: `- ` makes a list, Enter and Tab, the table picker (grid and number fields, 21 refused), Tab through cells and adds a row, add column stops at 20, delete table, axe (A, AA, AAA) in both themes with the table bar and the picker open. |
| `edit-roundtrip.mjs <post id>...` | Opens posts in the editor, presses Save with no change, and compares the text before and after (never prints it). The text must not change. Saves the posts, so use it on a copy. Works on any board with `BASE`, `BF_USER`, `BF_PASS`. |
| `user-journey.mjs` | A normal visit as a guest and as the member `alice` (needs `docker/dummy-data.sh`). It logs in and out, browses, searches, posts a topic, replies with a quote, edits, likes, deletes, sends a private message, switches the dark theme and checks the phone width. It fails on script errors. It takes 1.5 to 3 minutes, because phpBB allows one post every 15 seconds. It leaves soft-deleted test topics and one private message. Each run adds one failed login. After 3, phpBB asks for a captcha. Empty the table `phpbb_login_attempts` now and then. Last run: 48 of 48 pass. Run it with `BF_USER=alice run.sh user-journey.mjs`. In a Claude cloud session use `.claude/skills/phpbbtest/run-user-journey.sh`. |
| `posting.mjs` | Reply page: the editor, no option boxes, a picture upload, saving the post. |
| `pictures.mjs <photo.jpg path>` | A picture in the text: preview, the menu, the description, Preview, delete. Needs `photo.jpg`. |
| `files.mjs <this folder>` | A PDF and a ZIP (picker and drop) go to the file list, a picture goes in the text, the post shows both. |
| `sizes.mjs <this folder>` | Uploads of 30 KB to 3.6 MB pictures (chunked uploads, server compression). |
| `edit.mjs <post id>` | Opening and saving an old post keeps its text exactly. |
| `smilies.mjs` | Smilies and emoji in topic, search, review, preview and signature pages. |
| `inputs.mjs` | A focused text field lights up its border only: no outline, no halo (theme fields and the editor dialog field). |
| `fonts.mjs [admin]` | Which font every element has, and which fonts are drawn. |
| `axe.mjs` | axe-core (WCAG A, AA, AAA, best practice) on six pages, also with the picture menu and link dialog open. |
| `buttons.mjs` | AAA for buttons at rest: contrast, 44 by 44 px target, name. |
| `states.mjs` | AAA for buttons in hover, focus, pressed: text and icon contrast, focus line. |

Notes:
- phpBB refuses a form that is sent in the same second the page was made, so tests wait 1.5 seconds before they upload.
- `states.mjs` forces the hover, focus and active states with the Chrome DevTools protocol.
- Screenshots land in this folder (ignored by git).
