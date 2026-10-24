# Markdown converter

Converts the posts and private messages that were written in Markdown to BBCode, once, on the live board. Background: `docs/markdown-to-bbcode-plan.md`.

| Folder or file | What it is |
|---|---|
| `upload/` | What goes on the server: the page `bf-markdown-import.php` and the folder `bf-markdown-import/` with the two files it needs. |
| `convert.sh` | Runs the editor's converter on your computer, in a Node container. |
| `work/` | Your working files. Git-ignored, because they hold real posts and private messages. |
| `cli/` | The same job for a server with a command line: `bf-markdown-export-cli.php` and `bf-markdown-import-cli.php`. |
| `tests/` | Checks that the upload folder is in order. Run with `scripts/php-check.sh test`. |

## Run it (server without a command line)

1. In the ACP, General, Board configuration: set "Allow Markdown in posts" and "Allow Markdown in private messages" to **No**. Keep "Allow Markdown" (the global one) **Yes**.
2. Take a full database backup with the host's tool.
3. Upload the **contents** of `markdown-converter/upload/` to the board folder (the one with `config.php`). Keep the folders. Nothing needs to be enabled.
4. Sign in as the founder and open `https://YOUR-BOARD/bf-markdown-import.php`.
5. On the page, step 2: download `markdown-rows.jsonl`. Put it in `markdown-converter/work/`.
6. Run `markdown-converter/convert.sh`. It makes `work/converted.jsonl`.
7. On the page, step 4: upload `converted.jsonl`.
8. Step 5: run the dry run, read the rows that look different (table below), tick the ones that are fine, tick the backup box, convert. Then run the dry run again: it must convert 0 rows.
9. Check some converted posts. Undo is step 6 on the page.
10. Delete `bf-markdown-import.php` and the folder `bf-markdown-import/` from the server, and the files in `work/`.

## Run it (server with a command line)

Use the two scripts in `cli/`, as the user that runs the board. `BOARD` is the board folder.

```
PHPBB_ROOT=BOARD php bf-markdown-export-cli.php > markdown-rows.jsonl      # then convert.sh, as above
PHPBB_ROOT=BOARD php bf-markdown-import-cli.php < converted.jsonl > report.json                      # dry run
PHPBB_ROOT=BOARD php bf-markdown-import-cli.php --apply --accept=post:1,post:2 < converted.jsonl     # convert (or --accept-all)
PHPBB_ROOT=BOARD php bf-markdown-import-cli.php --rollback [--only=post:1]                            # undo
```

If `report.json` holds "Unable to write to the cache directory", run it as the user that owns `BOARD/cache`.

## The rows that look different

What the dry run showed on the production copy (275 Markdown rows: 249 look the same, 26 look different). Read them again on the live board.

| Group | Copy: ids | Decision |
|---|---|---|
| Horizontal rule `---` becomes three dashes as text | 6806, 9287, 23611, 24780, 25835, 27779, 28318 | Accept |
| Backticks that Markdown swallowed as inline code show as typed | 22732, 22743, 23737, 23965, 24686, 28161 | Accept |
| `~170 meter` for "about": the tildes come back | 21420, 23882, 27744 | Accept |
| Numbered lines that were an automatic list become plain numbered lines | 23133, 28063, 28862, 29681 | Accept |
| The `[code]` box header "Code: Select all" | 28512 | Accept |
| A relative address shows as the full address | 24761 | Accept |
| Tables: right only if the editor extension is enabled | 21053, 21104 | Leave out, then open and save in the editor |
| A `[size]` tag around Markdown bold: `**` stays | 29475 | Leave out, then open and save in the editor |
| A private message with no visible structure | pm 1441 | Leave out, read by hand |

## After it

- Open each row you left out in the editor and press Save. The editor converts a Markdown post when it opens it. Read the result first.
- Disable the Markdown extension last. If a row is still Markdown, it may show raw `**` and `#`.
- Posts with a table need the editor extension enabled on the board (it registers the `[table]` BBCode).

## If something is wrong

Undo puts the old text back from the backup table. A row that a member edited after the conversion is left alone. Purge the cache afterwards (the page does it). If undo is not enough, restore the database backup from step 2.

## What was tested, and what not

Tested on the production copy (Docker): the page from the upload folder, start to end by a browser test (`scripts/browser-tests/markdown-import-web.mjs`), the command line scripts, undo, and that nothing but the converted rows changed. Not tested: your real server, private message texts, and a request time limit of 30 to 60 seconds on the host. A convert runs one row at a time, so a stopped run can be started again.
