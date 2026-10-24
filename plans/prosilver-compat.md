# Plan: make all Baneforum extensions work on vanilla prosilver, our own style and every style based on prosilver

Status: approved, phase 1 not started (a worktree and branch `worktree-prosilver-compat` exist, with no changes). Written 2026-10-24.

## Context

Our extensions were built next to our style, and some depend on it. I tested all of them on vanilla prosilver on the test board
(port 8080): pages load with no PHP errors and 135 of 135 unit checks pass, but only 6 of 11 extensions really work.
Goal: each extension does its whole job on **vanilla prosilver, on our Baneforum style (which has prosilver as its parent)
and on any style that is based on prosilver**. A completely unrelated style with no hook in prosilver is out of scope.
Includes dark mode, video cards and the full editor. Where compatibility cannot be promised, the plan says so (see "Flagged places").

**Support policy (decided):** the latest two versions of Edge, Chrome, Firefox and Safari. No fallbacks for older browsers; the extensions may use
`:has()`, `color-mix()`, container queries, logical properties, custom elements and ES2022 freely.

## Broken today (measured on prosilver)

| # | Extension | Now | Cause |
|---|---|---|---|
| 1 | latest | Missing | Draws at `bf_index_aside`, an event only in our `index_body.html` |
| 2 | forummenu | Missing | Draws at `bf_navbar_forums`, an event only in our `navbar_header.html` |
| 3 | darkmode | Button does nothing | The dark colours are in our theme (`dark_colours.css`, `palette.css`) |
| 4 | ytthumb | Nothing to show | The video card and `bf-render.js` come from our style |
| 5 | editor | Only `[s]` BBCode and the Markdown flag | The editor bundle and its adapter are our style's files |
| 6 | contact, featured, latest, likes, avatars | Look unfinished | CSS variables with no fallback (contact 11 of 11, featured 4 of 16, latest 3 of 12, likes 3 of 23, avatars 1 of 4) |
| 7 | censor, imagecompress | Work | |

## Design rules (for wide compatibility)

1. **Only core events that exist in every phpBB 3.3 style.** `overall_header_breadcrumb_append`, `index_body_forumlist_body_after`,
   `viewtopic_body_contact_fields_before`, `overall_header_head_append`, `overall_footer_after`, `posting_editor_*`. Our own events
   (`bf_index_aside`, `bf_navbar_forums`) are removed. Our `index_body.html` and `navbar_header.html` already contain the core ones.
2. **Every extension CSS value has a fallback**, `var(--x, value)`, and no extension CSS needs our theme to be present.
3. **Zero-specificity extras.** Anything an extension adds for a foreign style (dark colours) uses `:where()`, so a style's own rules
   always win and our style is not affected even if the file is loaded there too.
4. **Progressive enhancement.** The editor adapter and the video cards do nothing, and break nothing, if the form, the
   Plupload uploader or the thumbnail route is missing. The plain phpBB form and the normal video link stay as the fallback.
5. **Assets live with the extension that owns them**, one copy, built by `scripts/bf-editor.sh`. Our style loads them from there.
6. **The style test** is `T_THEME_NAME != 'baneforum'` (a core variable), used only to skip what our theme already has.

## Work, in order

### Phase 1: small fixes (~0.5 day)
- `latest`: rename `styles/all/template/event/bf_index_aside.html` to `index_body_forumlist_body_after.html`; remove `{% EVENT bf_index_aside %}`
  from `baneforum/template/index_body.html`; check the grid still puts the panel in the right column.
- `forummenu`: rename `bf_navbar_forums.html` to `overall_header_breadcrumb_append.html`; remove `{% EVENT bf_navbar_forums %}` from `navbar_header.html`.
- Fallbacks in `extensions/baneforum/*/styles/all/theme/*.css` (`contact.css`, `featured.css`, `latest.css`, `votes.css`, `avatars.css`), using
  the light values from `palette.css`.
- `featured`: a stand-alone layout when it is not inside our `.bf-index` grid.

### Phase 2: dark mode on any style (~1 day)
- Extend `scripts/dark-colours.py` (it already turns prosilver `colours.css` into dark rules) to also write a `:where(:root[data-theme="dark"])`
  block with the dark palette values from `palette.css`, so the generated file needs no theme variables.
- Output: `extensions/baneforum/darkmode/styles/all/theme/prosilver-dark.css`, loaded with `INCLUDECSS` when `T_THEME_NAME != 'baneforum'`.
- A style that inherits prosilver (child styles) gets it too.

### Phase 3: video cards and thumbnails (~1 day)
- `packages/bf-editor/build.mjs`: a third entry, the `<bf-youtube>` element + `useYoutubePlayers` + `useYoutubeThumbnails`, built to `bf-youtube.js` (~15 KB).
- `scripts/bf-editor.sh` copies it into `extensions/baneforum/ytthumb/styles/all/template/js/`. `ytthumb` loads it from `overall_footer_after.html`
  when the style is not ours (ours already has `bf-render.js`). The footer-link CSS from `bf-editor-theme.css` moves into the extension CSS.

### Phase 4: the full editor on any style (~3 to 5 days, the risky part)
- Move editor assets into `extensions/baneforum/editor/styles/all/...`: `bf-editor.js`, `bf-phpbb.js`, `bf-dialogs.js`, the editor CSS. The build copies there
  (not into `baneforum/theme/js/`). Our `posting_editor.html` and `overall_footer.html` load them from the extension. Own commit, own test run.
- On foreign styles wire into the core posting form with its events: load the module `bf-phpbb.js` (it binds to `#postform` and `textarea#message`),
  and hide the BBCode row, smilies box and side box with CSS scoped to `T_THEME_NAME != 'baneforum'`.
- Adapter hardening: bail out quietly if `#postform` / `textarea#message` is not found; no uploads button if Plupload is missing.
- Test on prosilver: typing, formatting, picture upload (chunking, hidden attachment fields), the topic review quote button, preview, editing an old Markdown
  post (`BF_MARKDOWN`), private messages, signature.
- First, check how to give a `type="module"` script an extension path (`INCLUDEJS` makes classic scripts only). Stop and report if phpBB's form fights the adapter.

### Phase 5: guard rails (~0.5 day)
- `scripts/prosilver-check.py` (a check that logs in to the test board on prosilver and loads every page; the draft of it was in the session temp folder and is not saved, so write it again from the list of pages and markers in this plan) and `scripts/prosilver-mode.sh on|off` (switches `default_style` and `override_user_style` on the test board: default style 1 and override 1 for prosilver; 2 and 0 to restore).
- A tiny child style of prosilver on the test board, to check that inheritance works.
- A "Design rules" row in `.claude/skills/phpbb/SKILL.md` (core events only; fallbacks on every `var()`); update `docs/production-install.md`.

## Flagged places (where compatibility can be a problem)

| # | Where | Problem | What I will do |
|---|---|---|---|
| 1 | A prosilver child style that overrides a template we hook into (for example its own `navbar_header.html` without `overall_header_breadcrumb_append`) | The extension's UI (forum menu) is silently missing | Document the core events each extension needs in `docs/production-install.md`; the check script lists missing events for a given style. |
| 2 | Safari | The oldest of the supported versions (latest two) decides which CSS is safe: `:has()` (15.4), `color-mix()` (16.2) and container queries (16) are fine for the latest two | Test in Safari/WebKit once at the end (I have Chrome and Firefox; WebKit via Playwright is not set up). |
| 3 | The editor on a prosilver child style with a changed posting form | The adapter binds to `#postform` and `textarea#message`; a child style that renames them gets the plain textarea | Graceful bail-out (design rule 4). |
| 4 | Other extensions that add toolbars (alfredoramos Markdown, BBCode helpers) | Two toolbars, or a clash with the editor | Test with Markdown enabled; hide only known toolbars; flag the rest. |
| 5 | Dark mode on a prosilver child style with its own colours | The generated dark colours come from prosilver's `colours.css`; colours the child style sets itself may stay light | Zero-specificity rules so nothing breaks; documented as "prosilver colours only". |
| 6 | Languages | Extension strings exist in `en` and `da`; other languages fall back to English | Fine; flag in the docs. |
| 7 | RTL languages | Mostly logical properties, but not tested | Flag as untested. |
| 8 | phpBB and PHP versions | `composer.json` says phpBB >= 3.3.0 and PHP >= 8.1; the events are used in 3.3.x only | Test on the installed 3.3.x; flag newer phpBB (4.x) as untested. |
| 9 | Prosilver updates | Core events or markup can change in a release | `scripts/prosilver-diff.sh` and the new check script show it. |
| 10 | Production-critical change | Phase 4 moves the assets our own posting page loads | Separate commit, tested alone, revertable alone. |
| 11 | `markdown.mjs` already fails on the test board | Cause is in the board's setup (not our code); the editor tests depend on it | Find and fix the cause in phase 4. |
| 12 | The thumbnail fetch (ytthumb) | Needs PHP `curl` and outgoing https; without them the card is a plain play button | Already the fallback; flag in the docs. |

## Critical files

- Extensions: `extensions/baneforum/{latest,forummenu,darkmode,ytthumb,editor,contact,featured,likes,avatars}/styles/all/...`
- Our style: `baneforum/template/index_body.html`, `navbar_header.html`, `posting_editor.html`, `overall_footer.html`
- Build: `packages/bf-editor/build.mjs`, `scripts/bf-editor.sh`, `scripts/dark-colours.py`
- Reuse: `scripts/browser-tests/{edit,posting,markdown,axe-more,darkmode}.mjs`

## Verification (after every phase)

1. `prosilver-mode.sh on`, then `prosilver-check.py`: the 3 failing checks turn green; later phases add checks for dark mode, video cards, the editor.
2. Our style (`prosilver-mode.sh off`): `axe-more.mjs` (guest and admin, light and dark), `darkmode.mjs`, `edit.mjs`, `posting.mjs`, `styleguide.mjs`; screenshots of the front page, a topic and the posting page show no change.
3. The child style of prosilver: the same check script.
4. The production copy (`localhost:8081`): front page, topic, posting page, thumbnail route.
5. Unit tests: `scripts/bf-editor.sh test` (123) and the PHP tests (135).
6. Phone width and dark mode on both styles for the pages that changed.

## Limits

- Scope: vanilla prosilver, our style, and styles based on prosilver (tested with a small child style). Styles with no hook in prosilver are out of scope.
- Browsers: the latest two versions of Edge, Chrome, Firefox and Safari. Tested here in Chrome and Firefox; Safari needs a WebKit run (flag 2).
- Nothing is deployed to the real server. A release needs your go.
- Effort: about 6 to 8 working days (0.5 + 1 + 1 + 3 to 5 + 0.5). Phases 1 to 3 give working latest, forummenu, dark mode and video cards. Phase 4 is the decision point.
