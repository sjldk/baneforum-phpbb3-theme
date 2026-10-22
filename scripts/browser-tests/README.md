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
| `dialogs.mjs` | Delete and restore of a post ask in a native `<dialog>` on the same page: opens as a modal, Escape cancels, confirming deletes and restores. Makes a throwaway reply. |
| `snap.mjs <out.json> <selector>...` | Computed styles of the matching elements on 25 pages. Run it before and after a CSS change and compare the two files. Used when a prosilver CSS file is replaced by our own. |
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
