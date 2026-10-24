# Production install

Steps to put the Baneforum theme, the new editor and the image extension on the live board.
Follow them in order. Tick each box. Do the whole list on a copy of the board first if you can.

Production runs phpBB 3.3.x with `alfredoramos/markdown` and `phpbb/mediaembed`.
The theme needs no change to those two extensions.

## What goes live

| Part | Source in this repo | Target on the server |
|---|---|---|
| Theme and editor | `baneforum/` | `styles/baneforum/` |
| Image extension | `extensions/baneforum/imagecompress/` | `ext/baneforum/imagecompress/` |
| Censor extension | `extensions/baneforum/censor/` | `ext/baneforum/censor/` |
| Likes extension | `extensions/baneforum/likes/` | `ext/baneforum/likes/` |
| Featured posts extension | `extensions/baneforum/featured/` | `ext/baneforum/featured/` |
| Letter avatars | `extensions/baneforum/avatars/` | `ext/baneforum/avatars/` |
| Appearance switch (light and dark theme) | `extensions/baneforum/darkmode/` | `ext/baneforum/darkmode/` |

`baneforum/theme/bf-editor.js`, `bf-render.js` and `bf-render.css` are built files. They are committed.
You do not need Node on the server.

## 1. Before you start

- [ ] Back up the database (ACP, Maintenance, Database, Backup, or `mysqldump`). Keep the file off the server.
- [ ] Back up `styles/baneforum/` and `files/` (a copy of the folders is enough).
- [ ] Check the repo is on the commit you want: `git log -1`, and `git status` is clean.
- [ ] Choose a quiet time. The change needs a cache purge, which makes the first page loads slower.

## 2. Check the server

- [ ] PHP 8.1 or newer (the extension requires it).
- [ ] The GD extension has JPEG and PNG support. Run `php -r 'var_dump(gd_info());'` and look for `JPEG Support` and `PNG Support` as `true`. You can also read it in ACP, General, Server configuration, PHP information.
- [ ] Note `memory_limit`. A big photo needs about 5 bytes per pixel in GD (a 4000 by 3000 picture needs about 60 MB). A picture that needs more than the limit is stored as it was, not shrunk. 256M is a safe value.
- [ ] `upload_max_filesize` and `post_max_size` are large enough for the biggest file you want. The editor sends big files in chunks, so these can stay modest.

## 3. Copy the files

From the repo root, with the server as `SERVER` and the board in `/var/www/baneforum` (change both):

```bash
rsync -av --delete baneforum/ SERVER:/var/www/baneforum/styles/baneforum/
rsync -av extensions/baneforum/imagecompress/ SERVER:/var/www/baneforum/ext/baneforum/imagecompress/
rsync -av extensions/baneforum/censor/ SERVER:/var/www/baneforum/ext/baneforum/censor/
rsync -av extensions/baneforum/likes/ SERVER:/var/www/baneforum/ext/baneforum/likes/
rsync -av extensions/baneforum/featured/ SERVER:/var/www/baneforum/ext/baneforum/featured/
rsync -av extensions/baneforum/darkmode/ SERVER:/var/www/baneforum/ext/baneforum/darkmode/
rsync -av extensions/baneforum/avatars/ SERVER:/var/www/baneforum/ext/baneforum/avatars/
```

- [ ] Both folders are owned by the web user (for example `www-data`), the same as the rest of the board.
- [ ] `--delete` removes files on the server that are not in the repo. Check the dry run first (`-n`) if someone edited the style on the server.

## 4. Enable in the ACP

- [ ] Customise, Manage extensions: enable **Baneforum image compress** and **Baneforum censor**. The censor keeps the ACP word list but leaves URLs alone. Check `alfredoramos/markdown` and `phpbb/mediaembed` stay enabled.
- [ ] Featured posts (**Baneforum featured posts**): shows up to 5 posts with pictures in a column beside the forum list on the front page. It needs the style's `index_body.html` (it has the place for it), so install the style first. It ranks by likes if **Baneforum likes** is enabled, and by newest otherwise. Only members who can read and download in a forum see its posts. Nothing to configure.
- [ ] Letter avatars (**Baneforum letter avatars**): a member with no avatar gets a round letter, the first letter of the name, in the colour that belongs to that letter (12 colours, the same every time). It is a span with CSS, not an image, in posts and private messages. Nothing to configure.
- [ ] Appearance switch (**Baneforum appearance switch**): adds an "Appearance" link to the top bar. The choice is kept in the visitor's browser (`localStorage`, key `bf-theme`), so there is nothing on the server and no setting.
- [ ] Likes: the votes hold a keyed hash, never a user id, so nobody can see who voted. The key is the file `store/baneforum_votes.key`, made on the first vote. Include it in backups. Without it, old votes still count but nobody's own vote is recognised, so they can vote again.
- [ ] Customise, Styles, Install styles: install **baneforumblue** if it is not installed. If it is already installed, open Customise, Styles, and click Refresh on it so phpBB reads the new templates.
- [ ] Make it the default style, or keep the old one default until you have tested.

## 5. Change the attachment settings

The editor and the image extension need phpBB's own picture limits turned off.
phpBB checks the size of a picture before any extension runs, so the extension cannot shrink a picture that phpBB has already refused.

ACP, General, Attachment settings:

| Setting | Value |
|---|---|
| Maximum file size | 0 |
| Maximum file size for private messages | 0 |
| Maximum image width and height (the two image limits) | 0 |
| Maximum number of attachments per post | 40 (or what you want) |

- [ ] Open Extension groups and check that Images, Archives, Documents and Downloadable files are allowed in posts.
- [ ] Anyone who must not upload large files now has no phpBB limit. The extension keeps pictures small (1920 by 1200, JPEG quality 85). PDFs and ZIP files keep their size. If you want a limit for those, set it on the server in PHP (`upload_max_filesize`).

## 6. Clear the cache

- [ ] ACP, General, Purge the cache. Or on the server: `php bin/phpbbcli.php cache:purge`.
- [ ] Hard reload the browser (Ctrl+Shift+R) before you test.

## 7. Test after the deploy

Do this as an admin and as a normal member.

| Check | What you should see |
|---|---|
| Front page and a topic | New theme, no broken pictures or fonts |
| Reply page | The new editor, not a plain box. The "Disable Markdown" box turns it off |
| Type `**bold**` and post | Bold text in the post |
| Open an old post for edit and save without a change | The text stays exactly the same |
| Add a photo from a phone or camera (over 2 MB) | The picture shows in the text. The file on the server is smaller, upright |
| Add a PDF | A card with a file icon under the editor and under the post |
| Paste a YouTube link | A play button. No request to Google before you click play |
| New private message | The editor is there and pictures work |
| Login page | Facebook and Google buttons still work |
| Phone | The posting page fits the screen |

## 8. If something is wrong

| Problem | Fix |
|---|---|
| Plain text box, no editor | Hard reload. Purge the cache. Check the browser console for an error from `bf-editor.js` |
| "Image too large" or "too big" error on upload | Step 5 is not done: a size or pixel limit is not 0 |
| Pictures are not smaller | The extension is not enabled, GD has no JPEG or PNG, or `memory_limit` is too low. Look in `store/` or the PHP error log |
| Template error after the copy | Purge the cache. Refresh the style in the ACP |
| Everything is broken | Switch the default style back to the old one (ACP, Styles). Disable the extension. Restore the folder backup from step 1 |

To go back fully: restore `styles/baneforum/`, remove `ext/baneforum/`, restore the database backup only if you changed settings that you want back.

## 9. Not changed by this install

- Existing posts are not changed in the database. Smilies in old posts become emoji on screen only (a script in `bf-render.js`).
- Signatures have no editor. They stay a plain box.
- `overall_footer.html` still loads the StatCounter script. Decide later if it stays.
