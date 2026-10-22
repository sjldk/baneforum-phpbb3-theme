# Handoff

Last updated 2026-10-22 (evening). Read this first. The long log is `docs/editor-progress.md`.

## What this repo is

The Baneforum phpBB 3.3 theme (`baneforum/`, style `baneforumblue`, child of prosilver), a post editor for it
(`packages/bf-editor/`, ProseMirror as `bf-` web components, writes Markdown, reads old BBCode) and three phpBB
extensions in `extensions/baneforum/` (`imagecompress`, `likes`, `censor`). The Docker test board (`docker/`) mirrors
production: phpBB 3.3.19, PHP 8.5, the Markdown and MediaEmbed extensions.

## How to run things

| Task | Command |
|---|---|
| Start the test board, set it up, fill it with dummy data | `docker/test-env.sh` (http://localhost:8080, `admin` / `adminadmin`, users alice, bob, carol with the same password) |
| Purge the phpBB cache after a template change | `sh docker/purge-cache.sh` |
| Editor build, tests, lint | `scripts/bf-editor.sh build` / `test` / `check`. Build before you commit a change in `packages/bf-editor/src`: the built copies in `baneforum/theme/js/` are committed. (`check` reports old errors, none in files touched today.) |
| Browser tests | `scripts/browser-tests/run.sh posting.mjs` (12 checks), `dialogs.mjs` (5 checks). See `scripts/browser-tests/README.md`. Chrome runs on the host. |
| Compare computed styles before and after a CSS change | `run.sh snap.mjs out.json "<selectors>"` on 25 pages. A 1px width difference on the preferences page is noise. |
| Pack the extensions as zips for another board | `scripts/package-extensions.sh [--bump patch\|minor\|major] [name ...]`. The zips go to `dist/` (git-ignored). |
| Production copy board (8081) | See the phpbb skill (`.claude/skills/phpbb/SKILL.md`) |

Push: if it fails with "publickey", unlock the SSH key (`ssh-add ~/.ssh/id_github_rsa`).

## Where we are

| Area | State |
|---|---|
| Editor (phases 0 to 8) | Done for posts, replies, edits and PMs. Signatures open. Phase 9 (keyboard walkthrough, screen reader, zoom, phones, size budget, Firefox board tests) is next. Phase 10 (packaging for reuse) open. |
| Theme | Under active polish. See "Today". |
| Extensions | `likes` and `censor` are new and enabled on the test board. Not installed on production. |
| Replacing prosilver CSS | `buttons.css` and `forms.css` are ours now. Nine prosilver files still load. See "Next". |

## Today (2026-10-22), checked in Chrome on the test board unless noted

**Posting page**
- The option checkboxes (BBCode, smilies, URLs, signature, "Disable Markdown") are gone from `posting_editor.html`. The panel stays for notify, lock, sticky type, delete and edit reason. The editor is always on (`bf-phpbb.js` no longer waits for the Markdown box).
- Quote: the cursor sits on a new line after the quote (`bf-editor` `focusEnd()`, called when the URL has `mode=quote`).
- The Quote buttons of the topic review work again. The template override had dropped phpBB's `editor.js`. It is back, and `bf-phpbb.js` sends `insert_text()` to the editor (`insertText()`).
- Topic review is a `<details>` bar with a chevron (`posting_topic_review.html`). Closed by default.
- Form rows are a CSS grid from 43.8125em (`fieldset.fields1/2 dl`), labels centred against the field. The subject field starts after its label and fills the row.

**Dialogs and notices**
- Messages and questions are native `<dialog>` elements (`#phpbb_alert` and `#phpbb_confirm` in `overall_footer.html`, `js/bf-dialogs.js`, `dialog.phpbb_alert` CSS). Post delete and restore ask in them, then the page reloads.
- Deleted-post notice: red box with round corners, Delete (filled) and Restore (outline). "Deleted post:" is visually hidden.

**Look**
- `--border-control` (0.15rem) is the border of every control: text fields, selects, checkboxes, radio buttons, post buttons, pagination, like buttons.
- Post buttons: light tint, hover with the control border. Pagination looks the same. Radio buttons and selects are styled like the checkboxes and fields.
- Topic and forum lists: the title is 19px in the accent colour, the line under it, the counts and the last post are 13px and soft.
- Square corners on a small screen for wrap, header and navbars. No "Online" ribbon. Copyright removed from the footer. The admin link is an icon in the footer bar. The back-to-top arrow sits in the gap between posts. Topic and forum lists have smaller, calmer text.

**Accessibility**
- axe-core (A, AA, AAA) finds nothing on the pages we touched: `run.sh axe-pages.mjs`. Fixed today: contrast beside a post, names for the quote links of the topic review, the dialog's close cross, and the icon-only menu links on a phone (`js/bf-a11y.js`).
- Not met on purpose: AAA target size 44px. Text fields are about 34px, like and dialog buttons about 36px (AA minimum 24px is met). Still to do: screen reader, keyboard walkthrough of the dialog, zoom, dark mode.

**Extensions**
- `likes`: votes are stored as a keyed hash of member and post (`voter_key.php`, key file `store/baneforum_votes.key`), with no user id and no time. Nobody can see who voted. The collapse note sits in the toolbar. Icons bounce on click. The buttons are smaller. **Boards that already have the extension must purge it and enable it again (the first migration changed).** Back up the key file.
- `censor`: replaces phpBB's word censor, same ACP list, leaves URLs alone. Test: `docker compose exec web php ext/baneforum/censor/tests/censor_test.php`.

**CSS ancestry**
- `baneforum/theme/buttons.css` and `forms.css` replace prosilver's files (same rules, in rem, no vendor prefixes). `overall_header.html` loads them in the same place as the old links. Checked with `snap.mjs`: no differences.

## Next

| Item | Note |
|---|---|
| Replace the other prosilver CSS files | `content.css` next, then `colours.css`, `common.css`, `cp.css`, `links.css`, `base.css`, `utilities.css`, `icons.css`, `normalize.css`. Check each with `snap.mjs` before and after, and keep the same position in `overall_header.html`. |
| Optimise the CSS | After all files are ours: merge our overrides into the replaced files, drop dead rules and `!important`, deduplicate. The user asked for this. |
| `dl`/`dt` layouts | Form rows are a grid now. Topic rows and other lists still use prosilver's floats and flex. |
| Pagination "…" dropdown | Prosilver fills it dark when open. Not restyled. |
| Not looked at | The like bounce while moving, topic lists at narrow widths, dark mode of today's changes, other forms with the new grid (login, user control panel), the dialogs on a phone. |
| Editor phase 9 | See the table above. |
| Likes | Production board and notifications. A who-voted list is deliberately not wanted. |
| Hidden "Unread" text for screen readers | Needs copies of `viewforum_body.html` and `forumlist_body.html`. |
| Prosilver `px` values | About 690 left. Replacing the files removes them. |

## Things to know

- `extensions/baneforum` is owned by `sjl` now (it was `www-data`). A new extension folder inside the container needs `docker exec -u root` and `chown 1000:1000`.
- Switch the test board between prosilver and our theme with `UPDATE phpbb_config SET config_value=(SELECT style_id FROM phpbb_styles WHERE style_path='baneforum') WHERE config_name='default_style'` and the same for `phpbb_users.user_style` (use `prosilver` for the other way). It is on our theme now.
- Post 105 on the test board has demo votes (6 dislikes), so the collapse shows.
- Two old git stashes (`stale-working-before-merge`, `before pull`) are covered by the commits. Drop them when you agree.
- Traps found are in the phpbb skill. Add new ones there.
