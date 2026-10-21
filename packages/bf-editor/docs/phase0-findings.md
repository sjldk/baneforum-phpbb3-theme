# Phase 0 findings: how the production Markdown stack behaves

Tested on the Docker board: phpBB 3.3.19, `alfredoramos/markdown` 1.5.0 (s9e Litedown), PHP 8.5.
Reproduce with `scripts/post_test.py 'message'`, which posts as admin and prints the rendered HTML.

| Input | Rendered by the server | Consequence for the editor |
|---|---|---|
| `**b** *i* ~~s~~ [t](url)` | `<strong>`, `<em>`, `<del>`, `<a class="postlink">` | Bold, italic, strike and link all map directly. |
| `line one⏎line two` | `<br>` inside one `<p>` | One newline is a line break. Matches the plan: Shift+Enter writes a single newline. |
| blank line | new `<p>` | Enter writes a blank line. |
| `[quote="admin" post_id=1 user_id=2]**b** in quote[/quote]` | `<blockquote cite=..><div><cite>..</cite><p><strong>b</strong>..` | Markdown works inside a BBCode quote. phpBB itself emits a `<div>` inside the blockquote. We cannot change that on the server. |
| bare YouTube URL | plain `<a class="postlink">`, no player | The server does not embed. The inline player must come from our client script. Detection rule: a paragraph whose only child is a YouTube link. |
| `😀` | `<img class="emoji smilies" src="//cdn.jsdelivr.net/gh/twitter/twemoji@latest/...svg">` | `utf8mb4` works. But phpBB renders Unicode emoji as images from a third-party CDN with an unpinned version. The render script should swap `img.emoji` back to the native character (its `alt`). |
| `:)` and `:D` | `<img class="smilies" alt=":)">` | The render script maps `alt` codes to emoji, as planned. |
| `[b]bb[/b]` and `[url=..]` next to `**md**` | `<strong class="text-strong">`, `<a class="postlink">`, `<strong>` | BBCode and Markdown mix in one post. |
| `\*not italic\*`, `\_u\_`, `\[a\]` | the backslashes stay visible: `\*not italic\*` | **Backslash escapes do not work on this stack.** The writer cannot escape literal `*`, `_`, `~` or `[` with a backslash. See the open question below. |
| `&amp;` typed by the user | `&amp;amp;` (shown as `&amp;`) | HTML entities are not decoded either. Text is escaped once and shown as typed. |
| `<b>raw</b>` | escaped, shown as text | Raw HTML is never rendered. Good. |
| `2 * 3 * 4`, `snake_case_word` | unchanged | Asterisks and underscores surrounded by spaces or inside words are safe. |
| `# not heading? and - not list?` | `<h1 class="markdown">` | A line starting with `# ` becomes a heading. The writer must avoid starting a paragraph with `# `, `- `, `* `, `1. ` or `> ` unless the editor means it. |

Other facts:
- The posting form has `<input type="checkbox" name="disable_markdown" id="disable_markdown">`. The adapter reads it.
- The extension loads its own `editor.js` (tab indent in code blocks) and CSS on the posting page.
- The message textarea is `#message` (`name="message"`) inside `form#postform`. The upload URL is the posting URL (`./posting.php?mode=reply&t=1`).
- The theme's textarea already carries the placeholder "Brug for at vedhæfte filer? Træk filerne herind." (drag files in).

## Open question for phase 2: literal markers

Since backslash escapes do not work, text the user types that would be read as formatting needs another route. Options to test in phase 2:
1. Invisible zero-width space inside the marker (`*` + U+200B + text). Works everywhere, invisible, but pollutes copy and paste.
2. Put the literal text in a code span, which changes how it looks.
3. Accept the loss: in a WYSIWYG editor, typing `*word*` already turns into italic through the input rule, so a literal pair of asterisks is rare. Only the cases the server would read wrongly need protection.

My recommendation is option 3 plus option 1 for the few unavoidable cases, tested against the server in the golden tests.
