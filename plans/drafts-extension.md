# Plan: a drafts extension for long articles (`baneforum/drafts`)

Status: planned, not started. Written 2026-10-24. Pick up with: read this file, then run Phase 0 (the spike).

## Context

You write articles that take hours. You want to save a draft, close the page, and pull it up again later, and to be sure a
draft is never posted by mistake. phpBB has drafts, but they were made for short posts. I looked at how they work (`posting.php`
lines 795 to 830 and 912, `ucp_main_drafts.html`, the production copy's 79 drafts from 54 members) and at our editor adapter
(`baneforum/theme/js/bf-phpbb.js`). This plan improves on core drafts, and it keeps what core already gives: the 79 existing
drafts and the drafts list in the control panel.

## What core drafts do today, and why that fails for an article

| # | Core behaviour | Problem for a long article |
|---|---|---|
| 1 | "Save draft" is a form post, then a confirm page, then a 3 second redirect | You leave the editor. The page reloads. Nothing saves while you write. |
| 2 | Saving **deletes the attachments** of the post (`attachment_manager->delete`) | Pictures in a draft are lost. |
| 3 | Drafts exist only for a new topic or a reply, never for **editing a published post** | You edit a live post directly, with no safe working copy. |
| 4 | Nothing saves automatically | A crash, a closed tab or an expired session loses hours of work. |
| 5 | The form token lives 2 hours (`form_token_lifetime = 7200`) and the session 1 hour | After a long writing session the post is refused with "form invalid". |
| 6 | One list in the control panel, no mark on the editing page | Nothing says "this is a draft, it is not posted". |
| 7 | `max_post_chars = 60000` | A very long article can be refused at the end. |

## Decisions already made (your answers)

- Include: **attachments in drafts**, **drafts of published posts**, and **a clear sign that a draft is not posted yet**, so none is posted by mistake.
- Not included: version history (can come later).
- Always included: automatic saving on the server while you write, a keep-alive so a long session never expires, restore after a crash,
  a drafts list inside the editor.

## Design

**Store.** Keep the core table `phpbb_drafts` as the one store (text, subject, forum, topic, time). So the 79 existing drafts keep working, and the control
panel list and the core "load" link (`posting.php?...&d=ID`) keep working. The extension adds two small tables:
`bf_draft_meta` (draft id, kind: post / reply / quote / edit, post id for an edit, a revision counter, the post's edit time when the copy was made)
and `bf_draft_attach` (draft id, attachment id). Both are created by migrations and removed on a full uninstall only.

**Routes** (all need login, the `u_savedrafts` permission, and a form token): `drafts/save` (create or update, with the revision counter),
`drafts/list`, `drafts/delete`, and `drafts/ping` (keep-alive that also returns a fresh form token for the posting form).

**Editor side.** A module `bf-drafts.js` in the extension. It loads after `bf-phpbb.js` and talks to the editor (a change event and the text), and to
the form. It does:
- **Autosave**: 3 seconds after you stop typing, and at most every 30 seconds while you type. The status bar shows "Saved 12:03" or "Not saved yet".
- **Local safety copy** in `localStorage` on every change. If the browser or the server was offline, the next visit offers the newer copy.
- **Keep-alive** every 5 minutes: it keeps the session alive and swaps in a fresh `form_token` and `creation_time` in the form, so Post still works after hours.
- **Conflict**: two tabs or devices with the same draft. A revision mismatch keeps both versions and asks which to keep (never a silent overwrite).
- **Drafts list in the editor**: a panel with title, forum or topic, time and a size. Open, delete.

**Not posted yet (the safety you asked for).**
1. A fixed bar at the top of the editor, in a distinct colour and with an icon and words, not colour alone (AAA): "Draft, not posted yet" for a new topic, "Draft reply to <topic>, not posted yet", and for an edit of a published post
   "Working copy of your post. The published post is unchanged until you press Save changes".
2. A draft saved automatically is never published. Only the primary button publishes, and its label says "Post" or "Save changes".
3. When the page was opened from a draft, pressing Post asks once: "Publish this to <forum>?" with the forum and the title. (A setting can turn it off.)
4. The drafts list marks each item "Draft" and shows where it would go.

**Drafts of published posts.** On the edit page the editor saves a working copy (`kind = edit`, the post id). Opening the edit page again offers
"You have unsaved changes from 12:03: Restore or Discard". Save changes publishes and deletes the working copy. If the live post changed in the
meantime (compare the stored edit time) the bar warns.

**Attachments in drafts.** Uploaded pictures are linked to the draft in `bf_draft_attach`, and our save route never calls core's attachment delete.
Loading a draft puts those attachments back into the posting form (`attachment_data`). When a draft is posted, phpBB's normal attach code takes over. When a draft is deleted, its attachments are deleted with it.

**No JavaScript.** The core buttons and the confirm page stay as the fallback. The extension only adds to them.

## Work, in order

### Phase 0: spike, answer the unknowns (~0.5 day) before any code
1. How long do orphaned attachments (`is_orphan = 1`) live? The production copy holds 1056 of them, so some path does not clean them. Find every path that deletes them, to protect a draft's pictures.
2. How to put draft attachments back into the posting form on load (`$message_parser->attachment_data`, `get_submitted_attachment_data`, `core.posting_modify_*` events).
3. Does an AJAX call extend the phpBB session and can it return a new form token that the form accepts?
4. The control panel list: how an `edit` draft gets the right "Load" link (a template event, or filter edit drafts out of the core list).
5. Does the editor have a change event? If not, add one in `packages/bf-editor/src` (a small change, rebuilt with `scripts/bf-editor.sh build`).

### Phase 1: server (~1.5 days)
Extension `extensions/baneforum/drafts/` (like `latest` and `ytthumb`): `composer.json`, migrations, `config/services.yml`, `config/routing.yml` (the file is `routing.yml`, a known trap),
a `drafts` service (save, update with revision check, list, delete, link attachments), a controller, language files `da` and `en`, PHP unit tests in `tests/` in the style of `thumbs_test.php`.
Limits: size cap per draft, a per-user cap on drafts, one save per 2 seconds, and the `u_savedrafts` permission checked on every route.

### Phase 2: editor integration (~2 days)
`bf-drafts.js`, `drafts.css`, the status bar, the banner, autosave, local copy, keep-alive with the token swap, conflict dialog, restore prompt after a crash.
Reuse our dialog helper (`bf-dialogs.js`) and the focus and `aria-live` patterns of the editor. Texts in `da` and `en`.

### Phase 3: edit-post working copies (~1 day)
`posting.php?mode=edit` support through `core.posting_modify_template_vars`, the "restore or discard" prompt, the conflict check, publish and delete on Save changes.

### Phase 4: attachments in drafts (~2 days)
Link on save, restore on load, delete with the draft, protection from cleanup (result of spike 1). Test with several pictures, chunked upload, and a draft that is posted.

### Phase 5: lists and the safety marks (~1 day)
The drafts panel in the editor, the control panel list fix for edit drafts, the "Publish this to ...?" confirm, the "Draft" marks. Style for our theme and for prosilver
(the extension uses only core events and variables with fallbacks, as in the prosilver plan).

### Phase 6: tests and docs (~1.5 days)
New browser test `scripts/browser-tests/drafts.mjs` (type, wait for autosave, reload, restore; edit working copy; attachment survives; the confirm before publish; the token swap after a simulated expiry).
Run `axe-more.mjs` on the posting page in both themes, `edit.mjs`, `posting.mjs`, and the PHP tests. Add rows to `docs/production-install.md` and to the trap table in `.claude/skills/phpbb/SKILL.md`.

## Critical files

- New: `extensions/baneforum/drafts/` (migrations, service, controller, `bf-drafts.js`, `drafts.css`, language files, tests)
- Editor: `packages/bf-editor/src/` (a change event, only if the spike says it is missing), `baneforum/theme/js/bf-phpbb.js` (the adapter, read only unless needed)
- Style: `baneforum/template/posting_editor.html` and `posting_layout.html` (the core Save and Load buttons, kept as the fallback), `baneforum/theme/baneforum_common.css` only if the banner needs it
- Core, read only: `posting.php` (save at 795, load at 912, `S_SAVE_ALLOWED` at 1992), `includes/functions_posting.php` (orphans around 2183), `styles/prosilver/template/ucp_main_drafts.html`
- Reuse: `extensions/baneforum/ytthumb/` for the route, service and test layout; `extensions/baneforum/latest/` for the language files and CSS include

## Flagged places

| # | Where | Problem | What I will do |
|---|---|---|---|
| 1 | Orphaned attachments | If phpBB or a cron job deletes them, a draft loses its pictures | Spike 1 first. If a cleanup path exists, mark linked attachments so it skips them. |
| 2 | The keep-alive and the form token | A new token swapped into the form could be refused if the token is bound to something else | Spike 3. Fall back to a reload prompt that restores the text from the draft. |
| 3 | Two writers on one draft | Silent overwrite loses work | Revision counter and a conflict dialog. |
| 4 | `max_post_chars = 60000` | A long article can be too long to post | Show a character counter in the status bar with a warning near the limit. Raising the limit is a board setting for you to decide. |
| 5 | Autosave load on the server | Many writers saving every few seconds | A cap of one save per 2 seconds, small JSON, one row update. Measured in the browser test. |
| 6 | Privacy | Drafts hold unpublished text | Only the owner can read, save or delete a draft (checked on every route). Admins get no new view. |
| 7 | Edit drafts in the control panel list | The core list shows an edit draft as a reply draft | Spike 4. Fix the link, or filter them out of the core list. |
| 8 | The editor and the prosilver plan | Both plans touch where the editor files live | Drafts load their own module after the editor, so they do not depend on where the editor files are. Do the prosilver phase 4 move afterwards, or before, but not at the same time. |
| 9 | Browser support | Latest two versions of Edge, Chrome, Firefox and Safari | Plain `fetch`, `localStorage` and `aria-live`. Safari is tested once at the end (WebKit run not set up here). |
| 10 | Production | New database tables and a migration | A migration with a reverse step, a copy of `phpbb_try` to test on first, and nothing deployed without your go. |

## Verification

1. PHP unit tests of the service (revision check, size and rate limits, ownership, attachment links).
2. `drafts.mjs` in Chrome and in Firefox on the test board, then on the production copy (`localhost:8081`), which has real drafts.
3. The 79 existing core drafts still list and load, in the editor panel and in the control panel.
4. axe (A, AA, AAA) on the posting page in light and dark: the banner, the status bar and the drafts panel.
5. A manual long run: write for a while, close the tab, reopen, restore; leave the page open past the token lifetime on the test board (shorten `form_token_lifetime` for the test) and post.

## Limits

- Effort: about 9 to 10 working days (0.5 + 1.5 + 2 + 1 + 2 + 1 + 1.5). A first working autosave and restore exists after phase 2.
- Work happens in a new worktree and branch from `main`.
- Nothing is deployed to the real server. A release needs your go.
