# Handoff

Last updated 2026-10-22. Read this first. The long log is `docs/editor-progress.md`.

## What this repo is

The Baneforum phpBB 3.3 theme (`baneforum/`), and a new post editor for it (`packages/bf-editor/`, a ProseMirror editor
as `bf-` web components). The editor writes Markdown, reads old BBCode, and sends pictures and files through
phpBB's own uploader. A Docker test board (`docker/`) mirrors production: phpBB 3.3.19, PHP 8.5, the Markdown
and MediaEmbed extensions.

## Where we are

| Phase | What | Status |
|---|---|---|
| 0 to 3 | Test board, package, codecs, toolbar | Done |
| 4 | Links (Ctrl+K dialog, paste, new window) | Done |
| 5 | YouTube player (`<bf-youtube>`, no request to Google until play) | Done |
| 6 | Pictures and files: picker, paste, drag and drop, preview, progress | Done |
| 7 | phpBB adapter (`baneforum/theme/js/bf-phpbb.js`) | Done for posts, replies, edits, PMs. Signatures open. |
| 8 | Smilies to emoji, render script | Done |
| 9 | Quality: keyboard walkthrough, screen reader, zoom, phones, size budget, Firefox run | **Next** |
| 10 | Packaging for reuse | Open |

Everything is committed and pushed after the last "cp". Test board (8080) works again.

## What works now (checked in Chrome on the test board)

- Editor on the reply, new topic and PM pages. The textarea stays as fallback and is hidden. The "Disable Markdown" box turns the editor off.
- A post that is opened and saved again keeps its text exactly (the textarea is only rewritten when the writer changes something).
- Pictures go in the text, with a menu on click (description, delete). Other files (PDF, ZIP) go to a list under the editor and under the post, as cards with an SVG file icon.
- The server makes pictures smaller: extension `extensions/baneforum/imagecompress` (JPEG and PNG, 1920 by 1200, turns photos upright by EXIF).
- The editor follows the board language (`<html lang>`): Danish and English built in.
- Posting page: no tabs, no side box, full width message box. Poll is a closed `<details>`.
- Buttons are WCAG AAA in the whole theme and the editor: 7:1 text, 44 px targets, 3px focus line, all states. axe-core finds nothing but one heading order warning inside post content.

## How to run things

| Task | Command |
|---|---|
| Test board | `docker compose -f docker/docker-compose.yml up -d --build`, then http://localhost:8080 |
| Editor build, tests, lint, types | `scripts/bf-editor.sh build` / `test` / `check` (Node runs in a container) |
| Purge phpBB cache after a template change | `sh docker/purge-cache.sh` |
| Editor demo page | `cd packages/bf-editor && python3 -m http.server 8099`, then `/demo/index.html` |
| Browser tests | see `scripts/browser-tests/README.md` (`fixtures.sh` once, then `run.sh <script>`) |

`scripts/bf-editor.sh build` also copies `bf-editor.js`, `bf-render.js` and `bf-render.css` into `baneforum/theme/`. Those copies are committed. Build before you commit a change in `packages/bf-editor/src`.

## Earlier this day (2026-10-22)

| What | State |
|---|---|
| Firefox | Editor smoke test ran in Firefox 157 (Puppeteer, WebDriver BiDi). No FAIL lines in the last 40 lines seen, full output not checked. `run.sh` takes `BROWSER=firefox`, `connect.mjs` is the shared helper. **Board tests in Firefox have not run yet.** |
| Production copy board (8081) | Works. Production tree in `local-data/phpbb`, files in `local-data/production/files`, database clone `phpbb_try`. Login `Baneforum.dk` / `adminadmin`. Not clicked through yet. |
| `docs/production-install.md` | New. Deploy steps. Not tested on a server. |
| `.claude/skills/phpbb/SKILL.md` | New. Boards, traps, tests. Add new findings there. |
| Picture click | Thumbnails and linked pictures now open in a new tab (`attachment.html`, `render/attachments.js`). Built, not yet checked in a browser. |

## Theme work, 2026-10-22 (after the editor work above)

All on the test board (http://localhost:8080). **Nothing here was checked in a browser by Claude.** Chrome is not
installed on this machine and the Firefox DevTools tool had no connection. The user looked at screenshots and
reported back. Check each item on the board before you trust it.

| Area | What changed | Where |
|---|---|---|
| Links (WCAG 1.4.1) | Titles in lists and links in posts: `--accent`. Links in posts are bold. Underline on hover. Standalone links need no underline. | `baneforum_colours.css` |
| Menus | No height cap and no scrolling inside menus | `baneforum_common.css` |
| Sizes | Fixed `px` in the theme CSS became `rem`, breakpoints became `em`. Kept: 1px lines, the 16px field minimum (iOS zoom), `px` inside SVG. Prosilver itself still has about 690 `px` values. | three CSS files |
| Icons | `.icon` is `1.25em`. Prosilver size classes (`icon-md` and so on) are `em` | `baneforum_common.css` |
| Status icons | Font Awesome 4.7 glyphs drawn from the row class on the `dl` (comment, folder, bullhorn, pin). Badges: padlock (locked), bolt (hot). The "mine" dot was removed. | `baneforum_common.css` |
| Unread rows | Bold title and a bar at the start of the row. Read and unread icons look the same. | `baneforum_common.css`, `baneforum_colours.css` |
| Hidden links | The arrow after a user name in "last post" and the red bubble after an unread title are hidden, with the whole link (no empty link to tab to). The jump to the latest or first unread post is gone. | `baneforum_common.css` |
| Post icons | `fa-file` and `fa-file-o` show as speech bubbles | `baneforum_common.css` |
| Row layout | Flex rows from 700 px: the title centres beside the icon. Page numbers sit in a grid cell beside the title. | `baneforum_common.css` |
| Form controls | `--color-control` (accent 65% with white, about 3.2:1) is the border of fields, selects and checkboxes. Checkboxes are custom. `--color-focus` is the full accent now. | `palette.css`, `baneforum_colours.css` |
| Fixes | No dashed blink on the post box. No border under the last row. No accent behind the list blocks (dark corners). User names have no group colour. User icon in the top bar when there is no avatar. | various |

**Open**

| Item | Note |
|---|---|
| Hidden "Unread" text for screen readers | Bold and the bar only show to sighted users. Needs copies of `viewforum_body.html` and `forumlist_body.html`. Not started. |
| Jump to the first unread post | Lost with the red bubble. Could make the title link there. |
| Prosilver `px` values | Not converted. About 690 values. Risky for the avatar and image offsets. |
| Checks not done | Dark mode, topics with many pages, memberlist checkboxes, admin control panel, the editor's own fields, radio buttons. |
| `--color-focus` change | Also changes the focus line on login buttons and attachment links. |
| Old GIFs | `baneforum/theme/images/*.gif` status images are unused now. |

**Dummy data:** `docker/dummy-data.sh` fills the test board with forums and topics in every status. Users `alice`, `bob`,
`carol`, password `adminadmin`. Log in as `admin` to see read and unread. It stops if the board is already filled.
If a new board has odd guest permissions after it, run `UPDATE phpbb_users SET user_permissions=''` and purge the cache.

**Push:** if the push fails with "publickey", run `ssh-add ~/.ssh/id_github_rsa` first (no SSH agent by default).
