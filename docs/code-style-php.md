# Code style (PHP)

Set by the owner. PHP follows the phpBB coding guidelines for extensions, plus our rules for comments.
Checked by `scripts/php-check.sh all` (syntax, code standard, extension tests). Everything runs in a container, so the host needs no PHP.

| Rule | Tool |
|---|---|
| phpBB's coding standard for extensions (release 3.3.19, copied unchanged to `tools/php/phpbb-standard/`): tabs, Allman braces (every brace on its own line), lower case keywords, `else if` (two words, as phpBB does), no unused `use`, namespaced classes | `phpcs` with `tools/php/ruleset.xml` |
| The rules for comments below | `phpcs`, same ruleset |
| Test files and command line scripts (`scripts/`, `docker/`) may run code and define a class with no namespace | ruleset exclude patterns |

`scripts/php-check.sh fix` repairs the layout that `phpcbf` can repair. It never writes comments.

## Comments (PHP and JavaScript)

The same rules apply to the JavaScript in `packages/bf-editor` (see `packages/bf-editor/docs/code-style.md`).

| Rule | PHP | JavaScript |
|---|---|---|
| A file starts with a comment on what the file is for | `/** */` with a title line and `@license` | `//` or `/* */` at the top |
| Every class, interface, function, method and field has a doc comment with a description in words: what it is for, and why when that is not obvious. A list of tags alone is not enough. | `Squiz.Commenting.*`, `Generic.Commenting.DocComment` | `bf-comments/doc-comment` (ESLint) |
| Every parameter and every return value is documented with its type | `@param type $name` and `@return type` | `@param {type} name` and `@returns {type}`, also checked by `tsc` |
| A comment gives the reason, the limit or the trap, not a retelling of the line below it. Keep the density of the code around it. | review | review |
| No code that is commented out (git keeps it). No TODO or FIXME left in comments: write it in a plan. | `Squiz.PHP.CommentedOutCode`, `Generic.Commenting.Todo`, `Generic.Commenting.Fixme` | review |
| Short sentences and common words | review | review |

A one line block is fine for a field: `/** The votes of this page, by post id. */`.

## Where we differ from the strict reading of the tools

| Choice | Why |
|---|---|
| Doc types are `int` and `bool`, not `integer` and `boolean` | phpBB core and our JavaScript use the short names. The two Squiz rules that ask for the long names are off. |
| The `$event` of a listener method has no native type, and is documented with `@param \phpbb\event\data $event` | This is how phpBB writes listeners. A native type would change behaviour in a way we cannot test in every case. |
| Scripts in `scripts/` and `docker/` may leave scalar parameters untyped | They run against a database, so a type change cannot be checked here. |
| In a test file the header comment comes first, then the `use` lines, then `require` | Otherwise the checker does not see the header as the file comment. |
| A one line doc block is allowed: `/** The votes of this page. */` | Short and clear. |
