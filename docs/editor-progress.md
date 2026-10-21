# Progress log: Baneforum editor

Plan: `~/.claude/plans/let-s-plan-make-a-modular-torvalds.md` (approved 2026-10-21).
Goal: replace the phpBB post editor with a ProseMirror editor (`bf-` custom elements), Markdown for new text, legacy BBCode on load.

## Status

| Phase | What | Status |
|---|---|---|
| 0 | Test bench: Markdown extension in Docker, server behaviour checked | Done |
| 1 | Package scaffold, Node build in Docker, contracts and fakes, tests | Done |
| 2 | Schema, Markdown codec, legacy BBCode codec, smilie map, corpus tests | Done (first version, see open items) |
| 3 | Toolbar and editor element | Done (without link and image buttons, which come in phases 4 and 6) |
| 4 | Links (dialog, new window, rendered posts) | Done |
| 5 | YouTube embed | Done |
| 6 | Image upload, Facebook style | Open |
| 7 | phpBB adapter in the theme | Open |
| 8 | Smilie conversion and rendered-post scripts | Open |
| 9 | Quality: accessibility, phones, size, Firefox test run | Open |
| 10 | Packaging for reuse | Open |

## Decisions

| Date | Decision |
|---|---|
| 2026-10-21 | Convert old BBCode posts to Markdown when edited. Unsupported tags stay as raw text. |
| 2026-10-21 | Drop the smilie picker. Every smilie, phpBB smilie picture, phpBB emoji picture and text smilie (`:)`) becomes a real Unicode emoji. In saved posts a small render script does it on screen. In the editor it happens when a post is loaded and while typing. No bulk change of the database. |
| 2026-10-21 | Core package in `packages/bf-editor`, no phpBB code inside. Thin adapter in the theme. |
| 2026-10-21 | Markdown reader and writer: our own, no micromark (replaces the first choice, to keep npm code out of production). |
| 2026-10-21 | The production `alfredoramos/markdown` extension stays. Not replaced. |
| 2026-10-21 | Custom elements use the prefix `bf-`. |
| 2026-10-21 | Standing rule: use the proper HTML element wherever one exists. Dialogs use `<dialog>` (opened with `showModal()`, closed with `<form method="dialog">`). A custom `bf-` element is only for what HTML has no element for. |
| 2026-10-21 | Standing rule: use the Invoker Commands API (`command` and `commandfor` on `<button>`) where it fits, so markup does the wiring and script does less. Toolbar buttons send `--name` commands to the editing surface. The dialog's Cancel button uses `command="close"`. Browser support: see the browser rule below. |
| 2026-10-21 | No npm packages in production if it can be avoided. A new production dependency needs approval first. `test/dependencies.test.js` enforces it. What ships: `docs/third-party.md` (in `packages/bf-editor/docs/`). |
| 2026-10-21 | SOLID: small interfaces (`Codec`, `UploadHandler`, `EmbedProvider`, `LinkPolicy`, `Command`), the core never imports the host. |

## Log

| Date | Entry |
|---|---|
| 2026-10-21 | Phase 0 done. Findings in `packages/bf-editor/docs/phase0-findings.md`. Backslash escapes do not work on this stack. phpBB renders Unicode emoji as images from a CDN. A bare YouTube link stays a plain link. |
| 2026-10-21 | Phase 1 done. `scripts/bf-editor.sh install/build/test` runs npm in a `node:22-slim` container. 6 tests pass. |
| 2026-10-21 | Production database backup placed in `local-data/db/` (git-ignored). Its header shows `utf8mb4`, so emoji are stored correctly on production. This closes the open `utf8mb4` item. |
| 2026-10-21 | Production images are being downloaded into `~/Downloads/phpbb images/files` and should go to `local-data/production/files/`. |

| 2026-10-21 | Production backup imported into a second database `phpbb_prod` in the Docker db container. `scripts/export_corpus.php` unparses every post and PM into `local-data/corpus/posts.jsonl` (git-ignored). 30,374 texts (29,203 posts, 1,171 PMs). |

| 2026-10-21 | Phase 2 first version. `src/schema.js`, `src/bbcode/scan.js`, `src/markdown/read.js` (micromark) and `write.js`, `src/codecs/markdown-bbcode.js`, `src/smilies.js`. 34 unit tests pass. |
| 2026-10-21 | Corpus check on all 30,374 real texts: no crashes, 7 not stable on a second round trip, 1 text becomes empty. phpBB's own renderer shows the same visible text for 30,267 (99.65%). 107 differ: 27 are only a shortened link label, 21 are quotes or lists, 59 are other (to review). |

| 2026-10-21 | Render script `bf-render.js` (3 KB, no ProseMirror) built from `src/render.js` and copied to `baneforum/theme/js/` by `scripts/bf-editor.sh build`. Loaded in `overall_footer.html`. It swaps `img.smilies` and `img.emoji` for the plain emoji character and converts text smilies in post bodies and signatures, except in links and code. 42 tests pass. Checked in a browser: post with `:)`, `:D` and a CDN emoji shows only native emoji. |

| 2026-10-21 | Phase 3. `<bf-editor>`, `<bf-toolbar>`, `<bf-editable>` (no `div`), `src/commands.js` (bold, italic, strike, normal, quote), `src/plugins.js` (keys, history, typing shortcuts: `**x**`, `*x*`, `~~x~~`, `> `, smilie codes), `src/bf-editor.css`. 55 unit tests pass. Browser check in headless Chrome (`demo/smoke.html`): 14 checks pass (toolbar role, 44 px buttons, one tab stop, arrow keys, bold button and Ctrl+I, quote load, `bf-change` event). Demo page: `demo/index.html`. |
| 2026-10-21 | Colour scheme and dark mode. The editor names no theme colour: `bf-editor.css` has `--bf-*` defaults (in `:where()`, so any host rule wins) with a light set, a dark set for `prefers-color-scheme: dark` and for `data-theme="dark"`. `baneforum/theme/bf-editor-theme.css` is the only file that maps `--bf-*` to the palette. `palette.css` now has `--accent-base` (the brand) and `--accent` (fill colour, lighter in dark), and a ready `:root[data-theme='dark']` block. It is not switched on. Calculated dark contrast: text 13 to 15:1, muted 9 to 10:1, accent on paper 6.9:1, focus on paper 6.2:1. Checked in Chrome: the editor follows the palette in light and dark. |
| 2026-10-21 | Emoji in saved posts are now a plain character, not a `<span role="img">`. Screen readers say the emoji name. |

| 2026-10-21 | Applied the element rule to what exists. The toolbar was a custom `<bf-toolbar>`. It is now a `<menu role="toolbar">` with one `<li><button>` per command, driven by a plain `Toolbar` class (`src/toolbar.js`). Only `<bf-editor>` and its `<bf-editable>` surface remain custom. 55 unit tests and 14 browser checks still pass. |

## Element audit

| Need | Element used |
|---|---|
| Toolbar | `<menu role="toolbar">`, `<li>`, `<button>` |
| Paragraph, quote, line break | `<p>`, `<blockquote>`, `<br>` |
| Bold, italic, strike, link | `<strong>`, `<em>`, `<del>`, `<a>` |
| Unsupported markup chips | `<code>` (inline), `<pre>` (block) |
| Link dialog (phase 4) | `<dialog>`, `<form method="dialog">`, `<label>`, `<input type="url">` |
| Upload progress (phase 6) | `<progress>`, status text in `<output>` |
| Image with caption (phase 6) | `<figure>`, `<figcaption>` |
| Editing surface | `<bf-editable>` (no HTML element is a rich text field) |
| Video player (phase 5) | `<bf-youtube>` with a real `<button>` and a fallback `<a>` |

| 2026-10-21 | Linter, formatter and type check. Biome (`biome.json`, tabs, single quotes) and `tsc --checkJs` (`tsconfig.json`, strict, but `noImplicitAny` is off for now). `scripts/bf-editor.sh lint|format|typecheck|check`. `check` runs all of them plus the tests and passes. |
| 2026-10-21 | Replaced micromark with our own Markdown reader. 42 npm packages gone from the dependency tree. Corpus result unchanged: 30,267 of 30,374 identical, now 1 text that is not stable (was 7). 55 tests pass. |
| 2026-10-21 | Found and fixed a test bench fault: CLI scripts run in the container as root left root-owned cache files, and the web server then ran with Markdown off. Run phpBB CLI tools as `www-data` (`docker compose exec --user www-data`). `docker/purge-cache.sh` now does. |

| 2026-10-21 | House JS style (`packages/bf-editor/docs/code-style.md`). Braces everywhere, `} else {`, a blank line above `if`, `for`, `while`, `do`, `switch`, `try` and `return`. Biome cannot do the blank lines, so ESLint runs for those two rules only (dev tool, not shipped). `format` now runs both. About 224 style fixes applied. 56 tests, type check, corpus run and 14 browser checks all unchanged. |
| 2026-10-21 | JSDoc on all functions, `noImplicitAny` switched on (strict is now fully strict). |

| 2026-10-21 | Biome config moved to the repo root and now also formats and lints the theme CSS (`baneforum/theme/*.css`) and `docker/*.yml`. `scripts/bf-editor.sh` mounts the whole repo. Two CSS rules off on purpose (`noDescendingSpecificity`, `noImportantStyles`). 7 CSS files reformatted to tabs. Screenshots of index, topic, member list and control panel are byte for byte identical before and after. |

## How to rerun the corpus check

```
scripts/bf-editor.sh exec node tools/convert-corpus.mjs /local-data/corpus/posts.jsonl /local-data/corpus/converted.jsonl
docker cp scripts/render_compare.php docker-web-1:/tmp/render_compare.php
docker compose -f docker/docker-compose.yml exec --user www-data -T web php /tmp/render_compare.php < local-data/corpus/converted.jsonl > local-data/corpus/compare.json
```

## Production facts (from the backup)

| Fact | Value |
|---|---|
| phpBB version, charset | 3.3.19, `utf8mb4` |
| Markdown | `alfredoramos/markdown` active. Allowed in posts and PMs, not in signatures. |
| **MediaEmbed** | `phpbb/mediaembed` is active. Old posts embed videos with `[youtube]url[/youtube]` (644 uses) and `[media]url[/media]` (about 440). A bare YouTube link is not the format production uses. Decided in phase 5: new videos are saved as a bare address (see the log). |
| Posts using each BBCode | quote 5,055 (17%), inline attachment 2,983 (21,065 tags in total), url 1,015, youtube 539, b 469, media 417, i 350, img 285, u 160, color 57, list 55, size 49, code 10. No `[s]` strike tag at all. |
| Markdown in real use | bold `**` in 111 posts, headings 16, `>` quote lines 303 (partly prose), tables 2. |
| Quotes | 4,082 have no attributes, 2,017 have `post_id time user_id`, a few have `msg_id` (PMs). |
| Smilie table | Only 20 smilies exist on production (`:twisted: :evil: :lol: :P :x :cool: ...`). `:)`, `:-)`, `:D` and `;)` are **not** smilies there, so today they show as plain text. Converting them to emoji is an improvement, not a restore. |
| Smilies | `:-)` 2,953, `:)` 2,285, `:D` 755, `;)` 613, `;-)` 556, `:?` 223, `:lol:` 188, `8-)` 144, `:(` 121. 660 texts already contain Unicode emoji. |
| Attachments | 24,127 rows. Inline `[attachment=N]` is the main image pattern. |
| Images | `[img]` points mostly at `lh3.googleusercontent.com`. |
| PHP 8.5 | phpBB 3.3.19 vendor code (Guzzle) prints deprecation notices on PHP 8.5 in the CLI. The board itself works. |

## Dark mode status

| Part | State |
|---|---|
| Palette recipe for dark (`palette.css`) | Ready, off |
| Editor and toolbar | Follow the palette, checked in dark |
| Theme CSS | All colours are palette variables, so they follow |
| Prosilver's own colours (input fields, some hover and link colours) | Still light only. Needs overrides before dark mode can go live. |
| Background photo, logo, header image | Light only, decide later |
| Switch (system setting or a user toggle) | Not built |

## Open items


- Literal `*`, `_`, `~`, `[` cannot be escaped on this stack. Current choice: no protection (a literal pair such as `*word*` becomes italic). Only line starts that would become headings, lists or quotes get an invisible zero-width space.
- Review the 59 "other" corpus differences and the 7 unstable texts.
- `bf-render.js` is a built file that is committed in the theme. Rebuild with `scripts/bf-editor.sh build` after changing `src/`.
- Writer for new editor-made content (new quotes, embeds, uploads) is not golden-tested against the server yet.
- Load the production backup into a second test database and measure real post content: how many posts use which BBCode, how many use Markdown (phase 2 test data).
- Per-user and per-forum Markdown switches on production: not checked yet.
- Extension on PHP 8.5: it enables and renders in the test board. Longer use is untested.
- Uncommitted work in the working tree: theme changes since the last "cp", the Docker Markdown extension, `packages/bf-editor`, `scripts/`, `docs/`.

## How to look at the editor

```
scripts/bf-editor.sh build
cd packages/bf-editor && python3 -m http.server 8099
# open http://localhost:8099/demo/index.html  (demo)
# open http://localhost:8099/demo/smoke.html  (self-test, prints PASS or FAIL)
```

| 2026-10-21 | Phase 4. `src/link-policy.js` (only http, https, mailto; a bare `example.com` gets `https://`), `src/link-command.js` (`setLink`, `removeLink`, `createLinkCommand`, Ctrl+K, toolbar button 6), `src/link-dialog.js` (native `<dialog>` with `<form method="dialog">`, answer read from the submit, not the `close` event), paste of a web address links the selection or is written as a link (`plugins.js`). Rendered posts: `src/render/external-links.js` adds `target="_blank"`, `rel="noopener noreferrer"`, `data-bf-external` and a hidden "(opens in a new window)" (English or Danish by `<html lang>`) to links to other sites. CSS for the dialog, the hidden text and the arrow icon is in `bf-editor.css`. Checked on the Docker board: the two YouTube links in topic 1 are marked. 76 unit tests and 24 browser checks pass. |
| 2026-10-21 | Found: in headless Chrome 156 a `<dialog>` fires its `close` event only once per page when the test closes it with scripted clicks. The dialog therefore reads the button from the `submit` event. Real clicks were not checked in a headed browser. |
| 2026-10-21 | Invoker Commands applied. Toolbar buttons carry `commandfor` (the editing surface) and `command="--bold"` and so on. `<bf-editor>` listens for the `command` event. The link dialog's Cancel is `command="close"`. Save and Remove stay submit buttons of the `method="dialog"` form. 76 unit tests and 25 browser checks pass. |
| 2026-10-21 | Browser support is the current version and one version back. Removed the toolbar's click fallback and its `bf-command` event. |
| 2026-10-21 | Browser support rule: Blink (Chrome, Edge) and Gecko (Firefox) are supported, current version and one back. WebKit (Safari) is welcome if it costs nothing, but nothing is built or tested for it. No fallbacks for older versions. Test with Chrome now. Firefox checks are still to do. |
| 2026-10-21 | Philosophy: follow the web standards and the MDN documentation. If we do that, we are almost as good as we can be. Use what MDN documents as supported. No browser-specific code, no workarounds for one engine, no testing of every browser. Check MDN before choosing an API. |
| 2026-10-21 | A Firefox test run is wanted, but later. Planned for phase 9. It will rerun `demo/smoke.html` and re-check the link dialog `close` event. |
| 2026-10-21 | Component structure rule: every `bf-` component has its markup and CSS as one template string in a shadow root, not built with `createElement` chains. The HTML and CSS are real files (`src/bf-editor.html`, `src/bf-editor.css`) that the build reads as text into `src/template.js`, so Biome still checks them. Script only finds the elements and hooks up events. Ids are private to the shadow root, so `commandfor` needs no per-editor counters. |
| 2026-10-21 | Shadow DOM applied to `<bf-editor>`. The toolbar and dialog markup moved into `bf-editor.html` (icons are inline SVG there, `icons.js` is gone). `toolbar.js` and `link-dialog.js` now take the elements from the template. Page CSS no longer reaches in (checked). The theme sets `--bf-*` on `bf-editor` and they pass through. `data-theme` dark mode on an ancestor is not read inside the shadow root (`:host-context` is Chrome only), the theme palette flips the `--bf-*` values instead. Saved-post CSS (hidden text, new window arrow) is now `bf-render.css`, the only stylesheet the theme loads. 76 unit tests and 26 browser checks pass. Risk to check in the Firefox run: ProseMirror selection handling inside a shadow root. |
| 2026-10-21 | House style: strings in JavaScript are always template literals (backticks), never `'` or `"`. ESLint `quotes: backtick` enforces it and `eslint --fix` converted all of `src`, `test`, `tools` and the build files. Import paths and property keys stay as they are. The demo pages (`demo/*.html`) are not linted and still use single quotes. |
| 2026-10-21 | Phase 5. Saved form for a new YouTube video: the address as typed, alone in its own paragraph. Production has `media_embed_parse_urls=1`, so the server embeds it. Old `[youtube]` and `[media]` posts are loaded as players and saved exactly as they were. `src/embeds/youtube.js` (provider: watch, youtu.be, shorts, live, embed, music, start time as `t=90`, `1m30s` or `start=`), `src/embeds/paragraph.js` (a paragraph with only a video address becomes an `embed` node), `<bf-youtube>` (shadow DOM, play button, `<template>` with the iframe, loads `youtube-nocookie.com` only on click, the link stays inside as the no-JavaScript fallback). Pasting a video address into an empty paragraph makes a player. A video address with blank lines around it is written back with blank lines. |
| 2026-10-21 | Rendered posts. The MediaEmbed output (`span[data-s9e-mediaembed=youtube]` with a lazy iframe) loads a picture from `i.ytimg.com` as soon as it is near the screen. `src/render/youtube.js` replaces it with `<bf-youtube>`, and also wraps a plain link that is alone in its paragraph (also phpBB's shortened `start ... end` text). Checked on the Docker board: 3 players, 0 iframes, 0 `ytimg` in the page. Added `phpbb/mediaembed` 2.1.0 to the test board (same as production). 93 unit tests and 32 browser checks pass. `bf-render.js` is now 7 KB. |
| 2026-10-21 | The test board lost its install when the web container was recreated (config.php gone, database kept). Fix: drop and create the `phpbb` database, then `docker compose up -d --force-recreate web`. `phpbb_prod` is separate and was not touched. |
