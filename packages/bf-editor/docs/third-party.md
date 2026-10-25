# Third-party code in production

Rule from the owner: no npm packages in production if it can be avoided. A new production dependency must be approved before it is added. `test/dependencies.test.js` fails if one appears without being listed there.

## What ships

| File | Our code | Third-party code |
|---|---|---|
| `bf-render.js` (shown on every page, 2.7 KB) | all of it | none |
| `bf-editor.js` (loaded where people write, 239 KB, 76 KB gzipped) | 21 KB | ProseMirror, about 217 KB |

The third-party code in `bf-editor.js`, all MIT licensed, built into the one file (no `node_modules` in production):

| Package | Version | Part |
|---|---|---|
| prosemirror-view, -model, -transform, -state | 1.42, 1.25, 1.12, 1.4 | The editor core |
| prosemirror-commands, -history, -keymap, -inputrules | 1.7, 1.5, 1.2, 1.5 | Editing commands, undo, keys, typing shortcuts |
| prosemirror-dropcursor, -gapcursor | 1.8, 1.4 | Drop marker and cursor next to blocks |
| prosemirror-schema-list | 1.5 | Bullet and numbered lists: wrap, split an item on Enter, indent and outdent. Approved by the owner 2026-10-24. |
| prosemirror-tables | 1.8 | Tables: cell selection, moving between cells with Tab, add and delete rows and columns. Approved by the owner 2026-10-24. |
| orderedmap, rope-sequence, w3c-keyname | 2.1, 1.3, 2.2 | Small helpers that ProseMirror itself needs |

## What does not ship

Build and check tools only: esbuild, Biome, TypeScript, jsdom. They run in the Node container and nothing from them is in the built files.

## Removed

micromark, mdast-util-from-markdown, mdast-util-gfm-strikethrough and micromark-extension-gfm-strikethrough (42 packages with their helpers) were used to read Markdown. They were replaced by our own Markdown reader, and that reader is removed now. The editor reads BBCode only.
