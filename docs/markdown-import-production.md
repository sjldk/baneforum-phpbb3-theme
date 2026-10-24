# Run sheet: convert the stored Markdown posts on the live board

Stage 4 of `markdown-to-bbcode-plan.md`. It changes the live database, so go through it in order and stop when a check fails.
Every step says where it runs. `BOARD` is the folder of the live board (the folder with `config.php` and `ext/`). `WEB_USER` is the user the web
server runs as (often `www-data`). Nothing here needs a password typed into a command: the scripts read `config.php`.

The corpus file holds real posts and private messages. Keep it private, and delete it when you are done.

## Variant: convert first, install the editor later

You can run the conversion before the editor extension is on the board. The converter writes only core phpBB BBCode (`[b]`, `[i]`,
`[list]`, `[quote]`, `[size]`, `[url]`, `[code]`, `[color]`, `[u]`) for 273 of the 275 rows on the copy. Two rows use `[table]`, which only
our extension registers. Without it a table would be saved as plain text, so the import sees different words and skips the row. Do not
`--accept` those two. They stay Markdown until the editor is installed.

What changes in the steps:

| # | Step | Change |
|---|---|---|
| 1 | Install the editor extension | Skip for now. Copy only one file, `extensions/baneforum/editor/markdown_detector.php`, to `BOARD/ext/baneforum/editor/markdown_detector.php`. Both scripts load it from there. It needs no enabling, and a later install of the whole extension folder overwrites it. |
| 2 to 8 | Dump, export, convert, dry run, apply, purge, spot-check | As written below. Read the dry run for rows that use `[table]`: they must not be converted. |
| 9 | Hand edits | Wait until the editor extension is installed and enabled. The editor reads a Markdown post as Markdown and saves it as BBCode. This applies to the 2 table posts, the 3 rows that look different, and any post edited between the export and the import. |
| 10 | Disable the Markdown extension | Only after step 9. Until then those few posts need it. I have not proven what they look like with it off: on the copy a test showed no change, which I cannot explain. Rehearse this on the copy before you do it live. |

Then install the editor and the other extensions (`production-install.md`) at your own pace.

## Step 0: stop new Markdown posts (do this first)

In the ACP, General, Board configuration: set "Allow Markdown in posts" and "Allow Markdown in private messages" to No (and in signatures, if
it is on). Leave the global "Allow Markdown" on, so old posts still render. On the production copy (extension 1.2.0) this was tested: a new reply
with `**bold**` stays as typed, and old Markdown posts look the same as before. It makes the job fixed: no new Markdown can appear between the
export and the import. Test: `scripts/browser-tests/markdown-switch.mjs`. The setting names in the database are `allow_post_markdown`,
`allow_pm_markdown` and `allow_sig_markdown`. Not tested: private messages and signatures (read from the extension's code only).

## Before you start

| # | Check | Where |
|---|---|---|
| 1 | The board has PHP 8 on the command line (`php -v`) | server |
| 2 | You can run commands as `WEB_USER` (`sudo -u WEB_USER ...`) | server |
| 3 | The Markdown extension (`alfredoramos/markdown`) is still enabled. Do not remove it until step 10. | ACP |

## Steps

**1. Put the current editor extension on the board and enable it.** The converted posts use `[table]` and `[list]`, and the extension registers
the table BBCodes. Without it a converted table shows as raw text. From the repo, `scripts/publish.sh` makes the folder to copy (see
`docs/production-install.md`). Then in the ACP: Customise, Manage extensions, enable "Baneforum editor". Then purge the cache (step 4 of the
install notes, or `sudo -u WEB_USER php BOARD/bin/phpbbcli.php cache:purge`).
*Check:* post a test reply with `[table][tr][th]a[/th][/tr][/table]` in a test forum and see a table. Delete the test reply.

**2. Take a full database dump, stored outside the web folder and outside the repo.** On the server:

```
cd BOARD
sudo -u WEB_USER php -r 'include "config.php"; echo "$dbhost\n$dbname\n$dbuser\n";'   # only to see which database it is; do not copy the password
mysqldump --single-transaction --default-character-set=utf8mb4 -h DBHOST -u DBUSER -p DBNAME > /safe/place/phpbb-before-markdown-$(date +%F).sql
```

*Check:* the file is not empty (`ls -l`), and you can see `CREATE TABLE` lines in it (`grep -c 'CREATE TABLE' file`).

**3. Export the original text of every post and private message.** On the server, as `WEB_USER`:

```
cd BOARD
sudo -u WEB_USER env PHPBB_ROOT=BOARD php /path/to/export_corpus.php > /safe/place/posts.jsonl
```

*Check:* one line per post and message (`wc -l`), no error text in the file. It reads the board's own database and writes nothing.

**4. Copy the corpus to your workstation and convert it.** Node runs in a container, as for the other checks. From the repo root:

```
mkdir -p ~/corpus && cp /safe/place/posts.jsonl ~/corpus/posts.jsonl      # copy it from the server first (scp)
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/repo" -v "$HOME/corpus:/corpus" -w /repo/packages/bf-editor \
    node:22-slim node tools/convert-corpus.mjs /corpus/posts.jsonl /corpus/converted.jsonl
grep '"markdown":true' ~/corpus/converted.jsonl > ~/corpus/md_only.jsonl
wc -l ~/corpus/md_only.jsonl
```

*Check:* `md_only.jsonl` has the rows with Markdown (on the copy it was 275). Copy `md_only.jsonl` back to the server, next to the import script.

**5. Dry run on the live board.** It writes nothing. On the server, as `WEB_USER`:

```
sudo -u WEB_USER env PHPBB_ROOT=BOARD php /path/to/markdown_import.php < /safe/place/md_only.jsonl > /safe/place/report.json
```

Read the `counts` at the top of the report: `would_convert` is what step 7 changes, `looks_different` are rows that you must read before
they are allowed. A row is only touched when its stored text still holds Markdown, nobody has edited it since the export, and the new text
renders to the same words as the old one.
*Check:* `would_convert` is about 270 posts and 2 private messages (the copy gave 270 and 2, plus 3 that look different). If the numbers are
far from that, stop and look at the report.

**6. Look at the rows that look different.** On the copy these were post 21053 (a footnote), post 29475 (a `[size]` tag around Markdown bold) and
one private message. The report lists the ids, and for posts a short text excerpt. Open each post on the board and decide. Leave them out of the
import and fix them by hand later (step 9). Private message texts are never printed, only their ids.

**7. Turn the board off, apply, turn it on.** ACP, General, Board settings, "Disable board". Then on the server, as `WEB_USER`:

```
sudo -u WEB_USER env PHPBB_ROOT=BOARD php /path/to/markdown_import.php --apply < /safe/place/md_only.jsonl > /safe/place/report-apply.json
```

Each row is saved in its own transaction, and the old text goes to the table `PREFIX_bf_markdown_backup` first. The edit time and the edit
count stay as they were, so no post shows "edited". It takes about a minute for 270 rows. Then purge the cache and turn the board on:

```
sudo -u WEB_USER php BOARD/bin/phpbbcli.php cache:purge
```

*Check:* in `report-apply.json`, `counts.converted` is the `would_convert` number from step 5, and `looks_different` lists the same rows as in step 6
(they were not allowed, so they are unchanged).

**8. Spot-check.** Open ten converted posts, among them one with a table, one with a numbered list and one with bold text. Open one private
message as its owner if you can. They must look the same as before. Open one old post in the editor and press Save: the text must not change.

**9. Hand edits.** Edit the rows from step 6 in the editor. They are plain posts and the editor reads them as Markdown.

**10. Only after steps 8 and 9: remove the Markdown extension.** Disable it in the ACP, check the board again, and only then delete it. After
it is gone any post that is still Markdown would show raw `**` and `#`.

## If something is wrong

| # | Problem | What to do |
|---|---|---|
| 1 | A few posts look wrong | `sudo -u WEB_USER env PHPBB_ROOT=BOARD php /path/to/markdown_import.php --rollback --only=post:123,post:456 < /dev/null` puts them back from the backup table. |
| 2 | Many posts look wrong | `... --rollback < /dev/null` puts every converted row back. If that does not work either, restore the dump from step 2. |
| 3 | After any rollback | Purge the cache (`sudo -u WEB_USER php BOARD/bin/phpbbcli.php cache:purge`), or the board keeps showing the converted text. |
| 4 | The import stops half way | Run step 5 again. Rows that are already converted are skipped, so it is safe to repeat, also `--apply`. |
| 5 | A converted table shows as raw text | The editor extension is not enabled, or the cache was not purged. Enable it, purge the cache. |

## When you are finished

Delete `posts.jsonl`, `converted.jsonl` and `md_only.jsonl` from the server and the workstation. Keep the database dump for some weeks. The
table `PREFIX_bf_markdown_backup` can be dropped when you are sure (`DROP TABLE`), after the dump is old enough that you would not restore it.
