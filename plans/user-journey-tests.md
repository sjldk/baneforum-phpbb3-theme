# Plan: user interface tests for a standard user

Goal: prove that normal use of the board works in a real browser, as a registered member with no special rights
(`alice`, from `docker/dummy-data.sh`), and as a guest. The existing browser tests check one part of the theme each
(editor, dialogs, contrast). None of them walks through a visit from start to end.

## Frameworks and tools (nothing new is added)

| Tool | Used for | Why |
|---|---|---|
| `puppeteer-core` 24 | Drives Chrome (Firefox with `BROWSER=firefox`) | Already in `scripts/browser-tests/package.json`. Real keyboard and pointer. |
| Node 22, plain ES modules | The test scripts, `.mjs` | The existing style: `check(name, ok)` prints `PASS` / `FAIL`. No test runner to learn. |
| `run.sh` | Starts headless Chrome, runs the script in a `node:22-slim` container | Already there. The host needs only Docker and Chrome. |
| `docker/test-env.sh` | Starts the board and fills it with `alice`, `bob`, `carol`, forums and topics | Already there. Gives a standard user with no admin rights. |

A new framework (Playwright Test, Cypress) was left out on purpose: it would be a second harness next to 30 working
scripts, and the owner prefers scripts.

## Scenarios (file: `scripts/browser-tests/user-journey.mjs`)

1. **Guest** (own browser context): index lists the forums; a topic can be read; like buttons are read-only;
   "Post a reply" sends the guest to the login page.
2. **Log in and out**: a wrong password shows an error and stays on the login page; the right one shows the user name
   in the navigation bar; Log out returns to the guest view.
3. **Browse**: index → forum → topic by clicking; the breadcrumbs lead back; a hot topic has pagination that works.
4. **Search**: search for a word from a known topic; the topic is in the results and opens.
5. **New topic**: write a title and text in the editor with the keyboard (bold with `**`), preview, submit;
   the topic page shows the formatted text.
6. **Reply and quote**: reply to the new topic; quote a post; the quote shows in the editor and in the posted reply.
7. **Edit own post**: open, change a word, save; the change shows, and "last edited" appears.
8. **Like**: like another member's post; the count goes up and the button is pressed; click again removes it.
9. **Delete own post**: the delete dialog opens, Cancel keeps the post, confirm removes it (cleans up the test topic).
10. **Control panel and messages**: the user control panel opens, a private message to `bob` can be sent.
11. **Dark theme**: the switch turns the theme and the choice survives a reload.
12. **Phone width** (390 px): the index, a topic and the reply page have no sideways scroll.

Each scenario is independent enough to name its own failure, and the script cleans up the topic it makes.
After every page change the script collects `pageerror` and console errors, and fails if there are any.

## Running

```bash
docker/test-env.sh                                   # board with dummy data (once)
BF_USER=alice scripts/browser-tests/run.sh user-journey.mjs
```

Exit state is printed as `PASS` / `FAIL` lines. A last line says how many failed.

## Limits

- Only Chrome is tested by default. The Firefox run is the same script with `BROWSER=firefox`.
- The scripts name the dummy topics from `docker/dummy-data.php`, so they cover the test board only. The production
  copy needs other topic names.
- Contrast and other accessibility checks stay in the `axe*.mjs` scripts. This one checks that things work.
