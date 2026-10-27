# Coding guidelines

For anyone who changes code in this repo. Read it once, then use it as a checklist.
It collects the rules the code already follows. Two parts have their own files:
`docs/code-style-php.md` (PHP and comments) and `packages/bf-editor/docs/code-style.md` (JavaScript).
The phpBB traps we found are in `.claude/skills/phpbb/SKILL.md`. Add new ones there.

## 1. Main rules

1. **Match the code around you.** Same naming, same comment density, same idiom.
2. **Keep it small.** Use the browser's own element or phpBB's own feature when one exists. Add a new part only when nothing fits.
3. **Ask before you add a dependency.** The editor has a fixed list of npm packages. A new one needs the owner's approval (see section 4).
4. **Comments give the reason, the limit or the trap.** Do not retell the line below. Every file, class and function has a short comment.
5. **No dead code.** No commented-out code, no TODO or FIXME. Git keeps old code. Write open work in a plan in `plans/`.
6. **Do not change what is not yours to change.** See section 9.
7. **Check your work** before you commit (section 7).

## 2. Where code goes

| Part | Folder | What it is |
|---|---|---|
| The style | `baneforum/` | `template/` (Twig), `theme/` (CSS, JS, images). A child of prosilver. |
| The editor | `packages/bf-editor/` | The editor as web components (ProseMirror). It reads and writes BBCode. |
| The glue between phpBB and the editor | `baneforum/theme/js/bf-phpbb.js` | The only file that knows phpBB, jQuery and Plupload. |
| phpBB extensions | `extensions/baneforum/<name>/` | One folder for each extension. |
| Test board | `docker/` | A disposable phpBB for tests. |
| Scripts | `scripts/` | Shell and helper scripts. Browser tests are in `scripts/browser-tests/`. |
| Docs | `docs/`, `plans/` | Facts in `docs/`. Work that is planned in `plans/`. |

`local-data/` is never committed. It holds production copies.

## 3. Theme: CSS and templates

**CSS**
- Use units `rem`, and `em` in media queries. Keep `1px` borders, the 16 px minimum for form fields (so iOS does not zoom) and `px` inside SVG.
- Do not write a colour value in a theme rule. Use the variables from `palette.css`. The main CSS file has no hex colours and about 147 `var(--...)`.
- Dark mode is `data-theme="dark"` on `<html>`. It works by changing the variables. `dark_colours.css` is made by `scripts/dark-colours.py`. Do not edit it by hand.
- Text and background keep at least 7:1 contrast (WCAG AAA). Buttons are at least 44 by 44 px.
- A link that works as a button never has an underline. Add a new button-like link to the list in `baneforum_common.css` (search "RULE: a link that works as a button").
- A new CSS file must be added to `@import` in `stylesheet.css`.
- Biome formats CSS: tabs, 120 columns.
- Look at `baneforum/theme/styleguide.html` after a style change. Add every new part of the theme to it.

**Templates**
- A file in `baneforum/template/` replaces the prosilver file of the same name. When you change one, read the prosilver original of the same phpBB version.
- After a phpBB update, run `scripts/prosilver-diff.sh <version>` to see what prosilver changed.
- Purge the cache after a template change (`docker/purge-cache.sh`).
- Texts come from `lang()`. The style has no language files, so `posting_editor.html` picks Danish or English with `S_USER_LANG`. Keep that for a few short texts only.
- Use the proper HTML element (`details`, `dialog`, `button`). A custom `bf-` element is only for what HTML does not have.

## 4. Editor (`packages/bf-editor`)

- **The core knows no host.** Nothing in `src/` may mention phpBB, jQuery or Plupload. A test checks this (`architecture.test.js`). Host code goes in `bf-phpbb.js`.
- **Pass things in.** The core gets its codec, commands and upload handler from outside. It does not import a concrete host part.
- **BBCode is the saved format.** Read BBCode exactly: a character is markup only if BBCode says so.
- **Dependencies.** Production dependencies are on a list in `test/dependencies.test.js` and in `docs/third-party.md`. A new one fails the test until the owner approves it and you add it to both.
- **Style.** Strings in backticks, braces on every `if`, a blank line around blocks. ESLint and Biome enforce it. See the JavaScript style file.
- **The built file is committed.** After a change in `src/`, build it and commit `baneforum/theme/js/bf-editor.js` (and `bf-render.js`, `bf-render.css` if they change). `scripts/bf-editor.sh build` does it in Docker.
- **A new toolbar bar** is a `<menu role="toolbar">` with the same look as the main toolbar. No own colours, border or button size.
- **Tests** are in `test/`, one file for each part. They use Node's test runner and a fake DOM (`jsdom`).

## 5. phpBB extensions

- **Layout:** `composer.json`, `config/services.yml`, `config/routing.yml` (this exact name), `event/listener.php`, `language/da/` and `language/en/`, `migrations/`, `styles/all/template/event/`, `tests/`.
- **Namespace** `baneforum\<name>`. Language keys start with `BF_`. Permission names start with `ACL_U_BANEFORUM_`.
- **Language:** every text has a Danish and an English entry. Never write a visible text in PHP code.
- **Templates** add to phpBB through event files (`styles/all/template/event/`). Do not copy a core template.
- **Database:** a change needs a new migration (`m<number>_<name>.php`). Never change an old migration. Cast ids to `int` and escape strings with the phpBB database class.
- **Permissions:** check them on the server. A hidden button is not protection.
- **Do not depend on our style.** Extensions should work on any prosilver-based style (see `plans/prosilver-compat.md`).
- **Tests** are plain PHP scripts in `tests/`. They run without phpBB where they can (a stand-in class), and say in the header how to run them.
- **Style:** `docs/code-style-php.md`. Tabs, Allman braces, `else if`, doc comment on everything.
- A new extension folder in `extensions/baneforum/` is owned by `www-data` in Docker. See the phpBB skill for the fix.

## 6. Scripts

- Shell: start with `#!/bin/bash`, a comment on what it does and how to call it, then `set -euo pipefail`.
- Scripts that need Node or PHP run it in a container (`bf-editor.sh`, `php-check.sh`). The host needs only Docker.
- Browser tests are `.mjs` files that print `PASS` or `FAIL` for each check and share `connect.mjs` and `login.mjs`. A test cleans up what it creates, or its header says what it leaves. Add a row to `scripts/browser-tests/README.md`.
- Never use `docker compose down -v`. Never drop the database `phpbb_prod`.

## 7. Check before you commit

| Changed | Run |
|---|---|
| Editor (`packages/bf-editor`) | `scripts/bf-editor.sh check` (Biome, ESLint, TypeScript, tests), then `build` |
| PHP | `scripts/php-check.sh all` |
| CSS or templates | Purge the cache, open the style guide page, run the browser tests `axe-more.mjs`, `darkmode.mjs`, `buttons.mjs` |
| Anything the user sees | `scripts/browser-tests/user-journey.mjs` as `alice` |

In a Claude cloud session use the skill `phpbbtest`. It builds the test board and runs `user-journey.mjs`.

**Look at the real page before you call a visual change done.**
- Do not say "Docker is not available" before you read the `phpbbtest` skill and run its `build-image.sh`. A plain `docker ps` fails in a cloud session until the script starts the daemon.
- Take a screenshot of the real page on the test board and look at it. Do this for every CSS or template change, and fix what you see.
- A screenshot of a mock page is not a check. If you share one, say in the caption that it is a mock.
- Say clearly what you did not check (for example a provider the test board does not have, dark mode, a phone).

## 8. Git

- **Commit messages:** start with the area and a colon (`Tema:`, `Docker:`, `Skill:`), then what changed and why. The owner writes them in Danish. English is fine.
- **One topic in each commit and pull request.**
- Commit the built editor files together with the source change.
- Never commit `local-data/`, `node_modules/`, `dist/` or database backups.
- When you learn something about phpBB that cost time, add one line to the phpBB skill in the same commit.

## 9. Do not change without the owner

- The StatCounter tracker in `overall_footer.html`.
- The Facebook and Google login buttons (14 production users use them).
- The database `phpbb_prod`. Work in `phpbb_try`.
- Production values such as `server_name` and the cookie domain.
- The list of editor dependencies.

## 10. Docs and chat

The owner is not a native English speaker. Use simple words and short sentences in docs, plans, PR descriptions and replies.
One idea in each sentence. Explain a hard word the first time. See `CLAUDE.md`.
