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

Everything is committed and pushed. The tree is clean after the last "cp".

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

## This session (2026-10-22)

| What | State |
|---|---|
| Firefox | Editor smoke test ran in Firefox 157 (Puppeteer, WebDriver BiDi). No FAIL lines in the last 40 lines seen, full output not checked. `run.sh` takes `BROWSER=firefox`, `connect.mjs` is the shared helper. **Board tests in Firefox have not run yet.** |
| Test board (8080) | **Broken**: empty `config.php`, leftover tables. Fix: first trap in the phpbb skill. The permission check refused the database drop. |
| Production copy board (8081) | Works. Production tree in `local-data/phpbb`, files in `local-data/production/files`, database clone `phpbb_try`. Login `Baneforum.dk` / `adminadmin`. Not clicked through yet. |
| `docs/production-install.md` | New. Deploy steps. Not tested on a server. |
| `.claude/skills/phpbb/SKILL.md` | New. Boards, traps, tests. Add new findings there. |
| Picture click | Thumbnails and linked pictures now open in a new tab (`attachment.html`, `render/attachments.js`). Built, not yet checked in a browser. |

**Push:** the last 7 commits were not pushed (no SSH agent on this machine: `ssh-add ~/.ssh/id_github_rsa`, then `git push`). One commit message has a typo ("bræt" for "board").

**Next:** fix the test board, run `posting`, `inputs`, `files`, `edit` and `axe` in Firefox (also against 8081), then the rest of phase 9.

## Rules the owner set (also in the docs)

- Follow the web standards and MDN. Use the proper HTML element. Use Invoker Commands (`command`, `commandfor`) and the Popover API where they fit.
- Browsers: Blink and Gecko, current version and one back. WebKit only if free. No fallbacks for older ones.
- Every `bf-` component has its markup and CSS as one template in a shadow root (`src/bf-editor.html`, `.css`, built into `template.js`).
- JavaScript strings are always backticks (ESLint enforces it). Braces everywhere, blank line above `if`, `for`, `return` and so on. Biome formats.
- No npm package in production code without approval.
- WCAG AAA wherever it costs little. Test with the scripts, do not guess.
- "cp" means commit and push, in logical commits. Never a Co-Authored-By line.

## Things to know

Most of these now live in `.claude/skills/phpbb/SKILL.md`. Keep that file as the one source.

- **The test board is disposable.** After `docker compose up --force-recreate web` the entrypoint drops old tables and installs again. `phpbb_prod` (a copy of the production database) lives in the same database container. Do not run `docker compose down -v` unless you can import the backup again (`local-data/`, git-ignored).
- **phpBB refuses a form sent in the same second the page was made.** Tests wait 1.5 seconds before an upload.
- **phpBB checks picture size before any extension runs.** So on the board and on production `img_max_width`, `img_max_height`, `max_filesize` (and `max_filesize_pm`) must be 0, and the extension does the shrinking.
- **The attachment panel of phpBB is kept** (hidden unless there are files that are not in the text). It holds the hidden fields that are sent with the form. Plupload still does the uploading, the editor hands it the files.
- `bf-phpbb.js` holds back phpBB's error dialog while an editor upload runs, because the picture shows its own error.
- The theme loads a StatCounter script from `overall_footer.html` (a tracker). Not changed. Ask the owner.
- Facebook and Google login buttons stay (14 production users are linked to them). They have new button styles in `login_body_oauth.html`.

## Open items

| Item | Notes |
|---|---|
| Phase 9 | Keyboard walkthrough, screen reader notes, zoom and reflow, phones at 320, 375, 414 and 768 px (iOS fields 16 px), reduced motion, bundle size (budget 150 KB gzip, `bf-editor.js` is about 260 KB before gzip), **Firefox test run** (the owner wants it, planned here; check ProseMirror selection inside a shadow root and the dialog `close` event). |
| Phase 10 | `exports`, README, licence check, no phpBB in the core. Move `scripts/browser-tests` and the Firefox run into CI if wanted. |
| Signatures | The signature textarea (`#signature`) has no editor yet. Signatures take no Markdown on production (`media_embed_allow_sig` 0, Markdown not allowed in signatures). |
| Production steps (owner) | Copy `extensions/baneforum/imagecompress` to `ext/baneforum/imagecompress`, enable it in the ACP, set picture width and height limits to 0 (and `max_filesize_pm` to 0). Check PHP has GD with JPEG and PNG and what `memory_limit` is. Deploy the theme. |
| Smilies | Existing posts are not changed in the database. The render script swaps smilie pictures for emoji on screen. A bulk change is optional later. |
| Corpus | 59 posts whose rendering differs from phpBB's (see the log, phase 2) are not reviewed yet. |
| Editor strings | Only Danish and English. Other languages fall back to English. Add a language in `src/labels.js`. |
| Heading order | One axe warning inside post content (a Markdown heading after an h3 post title). Content, not theme. |
| Not checked | ACP and MCP pages, other browsers, real production content, phones. |

## Files worth knowing

| Path | What |
|---|---|
| `.claude/skills/phpbb/SKILL.md` | phpBB traps, the two boards, test commands |
| `docs/production-install.md` | Steps for the production deploy |
| `docker/docker-compose.prod.yml`, `docker/prod-try.sh` | The production copy board |
| `docs/editor-progress.md` | The full log and decisions, newest at the bottom |
| `packages/bf-editor/src/` | The editor. `elements/bf-editor.js` wires everything. `upload.js`, `attachment-menu.js`, `link-*.js`, `embeds/`, `render/` |
| `packages/bf-editor/docs/` | Code style, third party list, phase 0 findings |
| `baneforum/theme/js/bf-phpbb.js` | The phpBB adapter. Read this to see how the editor meets phpBB |
| `baneforum/template/` | Template overrides: posting, attachment cards, navigation, login |
| `baneforum/theme/baneforum_common.css` | Buttons AAA, attachment cards, picture style, posting page |
| `extensions/baneforum/imagecompress/` | Server side picture compression, with `tests/compressor_test.php` |
| `scripts/browser-tests/` | Browser tests, the AAA audits, the font audit |
