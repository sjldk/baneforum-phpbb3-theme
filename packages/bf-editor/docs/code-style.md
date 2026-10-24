# Code style (JavaScript)

The rules for comments are the same as for PHP (`docs/code-style-php.md` in the repo root).

Set by the owner. Enforced by `scripts/bf-editor.sh check` (Biome, ESLint, TypeScript, tests).

| Rule | Tool |
|---|---|
| Tabs, 120 columns, for JavaScript, JSON and the theme's CSS | Biome (`biome.json` in the repo root) |
| Strings are always template literals (backticks), never `'` or `"`. Import paths and property keys cannot be, and stay as they are. | ESLint `quotes: backtick` |
| Braces around every `if`, `else`, `for`, `while`, even for one line | ESLint `curly` (`eslint.config.js`) |
| `} else {` on one line | Biome formatter |
| A blank line above `if`, `for`, `while`, `do`, `switch`, `try` and `return`, unless it is the first line of its block | ESLint `padding-line-between-statements` |
| Blank line below those blocks too | ESLint `padding-line-between-statements` |
| JSDoc on functions, parameters and fields, checked by `tsc --checkJs` in strict mode (including `noImplicitAny`) | TypeScript |
| A file starts with a comment on what the file is for | ESLint `bf-comments/file-comment` (`tools/eslint-comments.mjs`) |
| Every function, class, method and field at the top of a file or class has a `/** */` comment with a description in words (not only tags) | ESLint `bf-comments/doc-comment` (source and tools; tests need only the file comment) |
| A comment gives the reason, the limit or the trap, not a retelling of the code. No commented-out code, no TODO or FIXME. Short sentences, common words. | review |
| The proper HTML element wherever one exists. Custom `bf-` elements only where HTML has none. | review |

`scripts/bf-editor.sh format` applies the fixes (ESLint first, then Biome).

## CSS

Biome formats and checks `baneforum/theme/*.css` and `packages/bf-editor/src/bf-editor.css` with the same tab indent. Two CSS lint rules are off on purpose: `noDescendingSpecificity` (the theme overrides prosilver, so a later rule with a lower specificity is normal) and `noImportantStyles` (the type scale needs `!important` to beat prosilver's selectors).
