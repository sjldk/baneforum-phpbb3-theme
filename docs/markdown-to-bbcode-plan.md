# Plan: convert stored Markdown posts to BBCode (potential, stage 0 done)

Decision (2026-10-23): BBCode is the saved format. The editor reads Markdown and BBCode and writes BBCode.
A Markdown post is converted when someone edits it (see "Step 0"). This plan is for converting the rest in the database, so
that we do not depend on the `alfredoramos/markdown` extension.

## Why edit-only is not enough

A Markdown post is stored with Markdown elements (bold, headings, `>` quotes) in its saved XML. Without the extension phpBB
does not know them. We expect plain text and lost formatting until someone edits the post. Not tested yet: test it on the test board first.
The edit box still shows the original Markdown text, so on-edit conversion keeps working after the extension is gone.

## Stages

| # | Stage | What happens | Touches production? |
|---|---|---|---|
| 0 | Editor | The editor reads Markdown and BBCode, writes BBCode. A Markdown post is converted when it is edited. **Done 2026-10-23** (needs the `baneforum/editor` extension on the board). | No |
| 1 | Find | A read-only query lists posts and PMs whose saved XML has Markdown elements (bold, headings, `>` quotes, tables). Counts and ids. | No |
| 2 | Convert | A script takes each post's original text from the XML and runs the editor's converter in Node. It writes the new text to a JSON file. | No |
| 3 | Rehearse | Run the import on the production copy board (database `phpbb_try`, port 8081). A report compares how each post renders before and after. Read every difference. | No, the copy only |
| 4 | Run on production | Database dump. Maintenance mode. Import. Purge the cache. Spot-check posts. Open the board. | Yes, needs the owner's go |
| 5 | Remove the extension | Disable it, check the board, then remove it. | Yes, needs the owner's go |

## How the import writes a post

- It parses the new BBCode with phpBB's own text formatter and saves through phpBB's storage code (text, checksum, BBCode fields). It does not write XML by hand.
- It leaves the edit time and edit count alone, so posts do not show "edited by".
- Before overwriting it copies the old stored text into a backup table (`post_id`, old text, old checksum). Rollback of one post, or all, is one `UPDATE` from that table.
- It selects only posts that still have Markdown elements. A rerun skips finished posts.
- It works in batches of a few hundred.
- Private messages (`phpbb_privmsgs`) get the same pass. Signatures do not: Markdown was never allowed there.

## Safety rules

- `phpbb_prod` stays untouched. Everything is rehearsed on `phpbb_try` first (see the phpbb skill).
- A full database dump before stage 4, stored outside the repo. The backup table is a second safety net.
- Stage 4 is a deploy. Show the counts and the diff report and wait for the owner's go.
- Posts the converter cannot handle (for example the 2 tables, odd nesting) are listed and left unchanged until decided.

## BBCode that phpBB does not have

| Markdown | Becomes |
|---|---|
| Heading | `[size=130][b]...[/b][/size]` |
| List, code block, quote | `[list]`, `[code]`, `[quote]` |
| Table | `[code]` block, or by hand (2 posts in the 2026-10 corpus) |
| Strike `~~x~~` | `[s]` only if a custom BBCode exists, else left as plain text with a note in the report |

No custom BBCodes are added unless the owner asks for `[h2]` and `[table]`.

## What stage 0 and the corpus check found

- The extension on production is 1.2.0 and stores no per-post Markdown flag (1.5.0 on the test board has `enable_markdown`). So a post is Markdown if its stored XML holds Markdown elements: `STRONG`, `EM`, `DEL`, `H1` to `H6`, `HR`, `TABLE`, `C`, `SUB`, `SUP`, a list item that is not `[*]`, a link written as `[text](address)`, an image written as `![]()`, or a code fence. Result on the production copy: 272 posts and 3 private messages (1.0% of 30,374).
- The converter output is stable (read as BBCode it gives the same text). Rendered with Markdown off, 30,329 of 30,374 messages look the same as before. The 45 that differ: 8 horizontal rules, 6 inline code, 3 sub or superscript, 2 tables, 12 YouTube links that become a player, 4 long links shortened one character differently, and a few lists inside italics or with odd numbering.
- Stage 1 and 2 are therefore small: about 275 messages.

## Open points

- Whether to add `[hr]` and a table BBCode so those 10 messages look the same.
- How phpBB 3.3.19 saves a post in code (read `phpbb\textformatter\s9e` and `includes/functions_posting.php` before writing the import).
