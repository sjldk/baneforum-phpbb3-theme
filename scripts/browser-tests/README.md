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
| `snap.mjs <out.json> <selector>...` | Computed styles of the matching elements on 25 pages. Run it before and after a CSS change and compare the two files. Used when a prosilver CSS file is replaced by our own. |
| `markdown.mjs` | A post written in Markdown is converted to BBCode when opened, still shows the same after an unchanged save, and is plain BBCode when opened again. Makes one throwaway reply. |
| `tables-lists.mjs` | Lists and tables in the editor with the real keyboard and pointer: `- ` makes a list, Enter and Tab, the table picker (grid and number fields, 21 refused), Tab through cells and adds a row, add column stops at 20, delete table, axe (A, AA, AAA) in both themes with the table bar and the picker open. |
| `edit-roundtrip.mjs <post id>...` | Opens posts in the editor, presses Save with no change, and compares the text before and after (never prints it). A BBCode post must not change. A Markdown post is converted once, then a second save changes nothing. Saves the posts, so use it on a copy. Works on any board with `BASE`, `BF_USER`, `BF_PASS`. |
| `markdown-import-web.mjs` | The Markdown import page (`markdown-converter/upload/bf-markdown-import.php`), start to end on the production copy: founder login, export, a wrong token is refused, upload, dry run, convert needs the backup box, convert, second dry run converts nothing, put one row back, put all back. Needs `CONVERTED=<file inside this folder>` (the converter output, with real posts: git-ignored as `tmp-*.jsonl`, delete it afterwards). Saves two pictures of the page. Changes the copy, and puts it back. |
| `markdown-switch.mjs` | Does a new post with Markdown get parsed as Markdown? It posts a reply the way the old editor does (without `disable_markdown`) and says if the stars became bold. Used to prove the board's Markdown switches. Needs `BASE`, `BF_USER`, `BF_PASS` and `TOPIC` for a board other than the test board. Makes one throwaway reply. |
| `user-journey.mjs` | A standard member's visit, start to end (as `alice`, needs `docker/dummy-data.sh`): guest view, wrong and right login, logout, browse and pagination, search, new topic with preview, quote and reply, edit, like, delete through the dialog, control panel, private message, dark theme, phone width, and no script errors on any page. Takes 1.5 to 3 minutes, because it waits out phpBB's 15 second flood interval between posts. Makes a topic and a message; deletes the topic's posts (soft delete). Each run adds one failed login (the wrong-password check); after 3 phpBB asks for a captcha, so empty `phpbb_login_attempts` in the board's database now and then. Last run: 48 of 48 pass. Run as `BF_USER=alice run.sh user-journey.mjs`, or in a Claude cloud session with `.claude/skills/phpbbtest/run-user-journey.sh`. |
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
