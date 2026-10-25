# Plan: tables, bullet lists and numbered lists in the Baneforum editor

> Note, 2026-10-25: the Markdown reader (`src/markdown/`), the converter and `markdown.mjs` were removed. Mentions of them below are history.

## Context

The editor (`packages/bf-editor`, built on ProseMirror) can do bold, italic, strikethrough, quote, link, attachments and video. It cannot show
or edit **lists and tables**: a `[list]` or `[table]` in a post becomes a `raw_block`, a block that is kept as text and cannot be edited
(`src/schema.js`, `src/codecs/bbcode.js`). You want Word-style tables (pick a size from a grid, first row is the header, at most 20 columns)
and bullet and numbered lists. The board side is already done: the table BBCodes are switched on in the `baneforum/editor` extension, and the
Markdown conversion writes `[table]` and `[list]`.

## Your answers

- Add `prosemirror-schema-list` and `prosemirror-tables` (the repo requires the owner's approval for new dependencies).
- The matrix is 20 columns by 20 rows. Columns are never more than 20, also when adding a column later.
- After a table is inserted a small bar edits it: add row above or below, add column left or right, delete row, column or table.

## Design

**Document model** (`src/schema.js`): `bullet_list`, `ordered_list` (keeps the marker: `1`, `a`, `A`, `i`, `I`, so `[list=a]` survives), `list_item`
(one paragraph, then optional nested lists), and the table nodes `table`, `table_row`, `table_header`, `table_cell` from `prosemirror-tables`
(`tableNodes()`, cells hold inline text only, because the server's `[td]` does not make paragraphs). Cells keep `colspan`, `rowspan` and `align`.

**BBCode in and out** (`src/codecs/bbcode.js`, `src/bbcode/write.js`):
- Reading: `[list]`/`[list=1]` with `[*]` items become real lists, `[table][tr][th|td]` become a real table (`[thead]`/`[tbody]` are flattened).
  A list or table that the editor cannot represent (for example an item with a quote inside) stays a `raw_block`. Nothing is ever lost.
- Writing: one canonical format, the same text that `src/markdown/to-bbcode.js` already writes (`[list]\n[*]a\n[/list]`, `[table]\n[tr][th]…`). A test makes
  the converter and the writer agree, so an old Markdown post that is opened and saved gives the same text as the import.
- A post that is only opened and saved again keeps its text exactly (the textarea is written only when the writer changes something). A list or table
  that is edited is written in the canonical format: odd spacing in an old list may change.

**Lists**: toolbar buttons Bullet list and Numbered list (toggle, `aria-pressed`, shortcuts Ctrl+Shift+8 and Ctrl+Shift+7), from `prosemirror-schema-list`:
Enter splits an item, Enter in an empty item leaves the list, Tab sinks and Shift+Tab lifts an item, Backspace at the start lifts it.
Typing `- ` or `* ` or `1. ` at the start of a line starts a list (`src/plugins.js`, `wrappingInputRule`, like the existing Markdown-style typing rules).

**Tables**:
- Toolbar button Table opens a popover with the picker. The picker is a **20 by 20 grid** that follows the pointer and the arrow keys, with a live label
  ("5 columns × 3 rows") and, as the keyboard and screen reader way, two number fields (Columns 1 to 20, Rows 1 to 20) with an Insert button.
- Insert makes the chosen size, **the first row is header cells (`[th]`)**, the cursor goes into the first cell.
- While the cursor is in a table a bar shows the table commands: add row above/below, add column left/right (disabled at 20 columns), delete row/column/table.
  Tab and Shift+Tab move between cells, Tab in the last cell adds a row, as in Word. Arrow keys leave the table at its edges (gap cursor).
- A pasted table wider than 20 columns is cut to 20, with a message that says so.

**Look**: table, header, cell, list and the selected-cell colour in `src/bf-editor.css` (inside the editor's shadow DOM, with the dark theme tokens that the
editor already uses). On the page, `baneforum_common.css` gets table borders and `overflow-x: auto` for wide tables on a phone, in light and dark.
All words in `src/labels.js` in Danish and English (`test/labels.test.js` checks both exist). Icons are inline SVG in `src/bf-editor.html`, like the others.

## Work, in order

1. **Dependencies and model (about 1 day)**: install the two packages, add them to `test/dependencies.test.js` and `docs/third-party.md` (version, what for, size).
   Schema nodes, codec read and write for lists and tables, round-trip tests (nested lists, `[list=a]`, aligned cells, a table with `colspan`, `[thead]`).
2. **Lists in the editor (about 1 day)**: commands in `src/commands.js`, plugins and key maps in `src/plugins.js`, toolbar buttons, input rules, labels, icons, tests.
3. **Tables in the editor (about 2 days)**: `insertTable(rows, columns)` with the limits, the picker popover (a small element like `link-dialog.js`), the table bar,
   `tableEditing()` plugin, Tab handling, paste cap, tests.
4. **Look and responsive (about 0.5 day)**: `bf-editor.css`, `baneforum_common.css`, dark mode, phone width.
5. **Browser tests and docs (about 1 day)**: new `scripts/browser-tests/tables-lists.mjs`, axe on the posting page with the picker open, update `docs/editor-progress.md`
   and the trap table in `.claude/skills/phpbb/SKILL.md`. Rebuild with `scripts/bf-editor.sh build` (the built `bf-editor.js` is committed).

Total about 5 to 6 working days. After step 2 you have lists, after step 3 tables.

## Critical files

- `packages/bf-editor/src/schema.js`, `src/codecs/bbcode.js`, `src/bbcode/write.js`, `src/bbcode/scan.js` (read: `[*]` is already a known tag)
- `packages/bf-editor/src/commands.js`, `plugins.js`, `toolbar.js`, `bf-editor.html`, `bf-editor.css`, `labels.js`, `elements/bf-editor.js`
- `packages/bf-editor/src/markdown/to-bbcode.js` (the canonical table and list text; the writer must match it)
- `packages/bf-editor/package.json`, `test/dependencies.test.js`, `docs/third-party.md`
- `baneforum/theme/js/bf-editor.js` (built), `baneforum/theme/baneforum_common.css`
- Reuse: `src/link-dialog.js` (popover and focus pattern), `src/views.js`, the jsdom fakes in `test/fakes/`, the existing `wrappingInputRule` use in `plugins.js`

## Flagged places

| # | Where | Problem | What I will do |
|---|---|---|---|
| 1 | Bundle size | The two packages add about 40 KB to `bf-editor.js` (now about 270 KB, loaded where people write) | Measure, write it in `docs/third-party.md`. |
| 2 | Accessibility of the grid | 400 grid cells cannot all be 44 pixels (AAA target size) | The two number fields are the equivalent way. The grid is a pointer convenience, with keyboard arrows too. Axe plus a keyboard walk. |
| 3 | Old lists in stored posts | A list is read as a real list, and written in the canonical format if you edit the post | Unrepresentable ones stay `raw_block`. Unchanged posts are not rewritten. Test on the 79 drafts and the converted posts. |
| 4 | Server rendering | Tables need the table BBCodes (done in `baneforum/editor`); lists are native | The editor extension must be enabled on every board. In the install notes. |
| 5 | Phones | A 20 column table cannot fit a phone | `overflow-x: auto` on the page; the editor scrolls sideways inside the table. |
| 6 | Pasted tables from Word or the web | Pasted HTML tables with merged cells or nested tables | Keep `colspan` and `rowspan`, flatten nested tables to text, cap at 20 columns. |
| 7 | Cells hold inline text only | No lists or several paragraphs in a cell | Matches the server's `[td]`. Say so in the docs. |
| 8 | Markdown posts | A Markdown post opened in the editor now shows real lists and tables | A gain, but re-test `markdown.mjs` (6 checks already fail on the test board for a setup reason, flagged in the earlier plan). |
| 9 | Safari | Latest two versions of Edge, Chrome, Firefox, Safari | Tested in Chrome and Firefox here. A WebKit run is not set up. |

## Verification

1. `scripts/bf-editor.sh test` (all existing 128 plus the new tests) and `check` (lint, types).
2. Browser test `tables-lists.mjs` on the test board: pick 3 by 2 with the pointer, type in cells, Tab through them, add a row and a column, delete a row, post,
   and check the page has a `<table>` with `<th>` in the first row; make a bullet list, a numbered list, a nested list and post.
3. Keyboard only: the whole flow with the number fields, no pointer. 20 columns allowed, 21 refused, add-column disabled at 20.
4. Open the same posts again in the editor and save: the text is unchanged. Open an old Markdown post with a list and a table.
5. axe (A, AA, AAA) on the posting page, light and dark, with the popover open and with the table bar visible.
6. Phone width and dark mode by eye. The production copy (`localhost:8081`): a real post with a list, a real post with a table.

## Limits

- Nothing is deployed to the real server. A release needs your go.
- The pending Markdown conversion work (table BBCodes, converter, import script) is uncommitted on the branch `worktree-markdown-oneoff`. This work builds on it, so commit that first
  ("cp"), then start this on a new branch from it.
- No table editor in the page text itself: cells are edited in place in the editor, not as BBCode text.
