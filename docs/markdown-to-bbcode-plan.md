# Plan: convert stored Markdown posts to BBCode (stages 0 to 3 done on the copy, stage 4 waits for the owner)

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

## Rehearsal on the production copy (2026-10-24)

The import is in `markdown-converter/` (see its README for how to run it): `cli/bf-markdown-import-cli.php` for a server with a command line, and a page `upload/bf-markdown-import.php` for one without. It is a one-off, not a cron job: it is safe to run again, but the work is 275 messages and a person must read the differences.
It runs inside the board's container and reads the JSON lines of `packages/bf-editor/tools/convert-corpus.mjs`.

Result on `phpbb_try` (a copy of the 2026-10 production backup):

| # | Count | Meaning |
|---|---|---|
| 1 | 275 | Markdown messages: 272 posts and 3 private messages |
| 2 | 249 | look the same to a reader after the conversion: converted without a decision |
| 3 | 26 | look different: read one by one (below) |
| 4 | 24 | of those accepted after reading (all posts) |
| 5 | 2 | not accepted: a post that needs a hand edit (29475) and a private message (1441) |
| 6 | 2 | accepted at first, then put back by a partial rollback: the two table posts (21053, 21104). A later change (below) made 21104 convert cleanly. |

Of the 26 that look different (25 posts and 1 private message):

| # | Group | Posts | Decision |
|---|---|---|---|
| 1 | Horizontal rule `---`: a line before, the three dashes as text after (BBCode has no rule) | 6806, 9287, 23611, 24780, 25835, 27779, 28318 | Accept |
| 2 | Backticks typed as an apostrophe (`app`er`): Markdown swallowed them as "inline code", the conversion shows them as typed | 22732, 22743, 23737, 23965, 24686, 28161 | Accept |
| 3 | A `~170 meter` for "about": Markdown ate the tildes as subscript, the conversion restores them | 21420, 23882, 27744 | Accept |
| 4 | Numbered lines that were an automatic list are plain numbered lines | 23133, 28063, 28862, 29681 | Accept |
| 5 | `[code]` box header "Code: Select all" | 28512 | Accept |
| 6 | A relative address shows as the full address (same target) | 24761 | Accept |
| 7 | Tables. First a table became a `[code]` box, which lost the table. Then the table BBCodes were added (see "Tables" below): the tables now render as tables. | 21104 | Converted (looks the same). |
| 7b | The footnote in the showcase post "Markdown er nu muligt": `[1]` as a link before, the literal `[^1]` after. The table in it is fine now. | 21053 | **The owner decides**: accept it with the footnote as text, edit by hand, or leave it. |
| 8 | A `[size]` tag around a Markdown `**bold**` across a line break: the `**` stays in the text (a converter edge case) | 29475 | **Leave**: edit by hand |
| 9 | A private message with no Markdown structure that the script can see | pm 1441 | **Leave**: read it by hand (its text is never in a report) |

So 270 posts and 2 private messages are converted on the copy, 272 rows in all, and 3 rows stay as they were (21053, 29475, pm 1441). The checks:
- every converted row is in the backup table `phpbb_bf_markdown_backup`, and no row changed without a backup
- the post time, edit time and edit count of every converted post are the same as in `phpbb_prod` (no "edited" shown)
- a second run converts nothing
- a partial rollback (`--rollback --only=post:21053,post:21104`) gave texts that are byte for byte the production originals

### Tables (added 2026-10-24)

phpBB has no table BBCode, but the text formatter library inside it has the definitions ready (`TABLE`, `THEAD`, `TBODY`, `TR`, `TH`, `TD`, in its repository file). The extension `baneforum/editor` switches them on next to `[s]` (`add_bbcodes()` in `event/listener.php`).
The converter writes a Markdown table with a delimiter row as `[table][tr][th]...[/th][/tr]...[/table]`, with `align=left|center|right` from the `:-:` marks. Bars with no delimiter row stay a `[code]` box.
The editor shows a `[table]` as BBCode text (it has no table editor) and writes it back unchanged (tested).
**The editor extension must be enabled on the board before the import**, or phpBB would drop the table tags.

### Run it (the copy now, production later)

1. Export the original text. On the copy this reads `phpbb_prod`:
   `docker exec -i -u www-data docker-web-1 php < markdown-converter/cli/bf-markdown-export-cli.php > corpus/posts.jsonl`
   For production, take a fresh export from the live data: on a server the script reads the board's own `config.php` (set `PHPBB_ROOT`), and `BF_EXPORT_DB` picks another database on the local test setup. Posts that change after the export are skipped by the import.
2. Convert (needs Node): `docker run --rm --user 1000:1000 -e HOME=/tmp -v REPO:/repo -v CORPUS:/corpus -w /repo/packages/bf-editor node:22-slim node tools/convert-corpus.mjs /corpus/posts.jsonl /corpus/converted.jsonl`
   then keep only the Markdown lines: `grep '"markdown":true' converted.jsonl > md_only.jsonl`
3. Dry run (writes nothing), then read the report: `php /tmp/bf-markdown-import-cli.php < md_only.jsonl > report.json`
4. Apply, with the rows that you have read: `php /tmp/bf-markdown-import-cli.php --apply --accept=post:6806,post:9287,... < md_only.jsonl`
5. Put back: `php /tmp/bf-markdown-import-cli.php --rollback` (all) or `--rollback --only=post:21053` (some).

### What is still open for stage 4 (production)

- Show the owner the counts and this table, and wait for the go. A full database dump first, stored outside the repo.
- Maintenance mode while it runs (it is a few seconds for 271 rows), then purge the cache and open the posts above.
- The two posts with tables and the `[size]` post need a hand edit before the Markdown extension is removed. After it is removed they would show raw Markdown.
- Nothing has been done on `phpbb_prod` or on the live board.

## Open points

- Whether to add `[hr]` and a table BBCode so those 10 messages look the same.
- How phpBB 3.3.19 saves a post in code (read `phpbb\textformatter\s9e` and `includes/functions_posting.php` before writing the import).
