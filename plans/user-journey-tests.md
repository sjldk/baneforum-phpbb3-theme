# Plan: UI tests for a normal user

## Goal

Check that normal use of the board works in a real browser.
The test acts as a guest and as a member with no special rights (`alice`).
The older browser tests each check one part of the theme. No test walks through a whole visit.

## Tools

No new tools. The test uses what the repo already has.

| Tool | Use |
|---|---|
| `puppeteer-core` | Controls Chrome with a real keyboard and mouse. |
| Node 22, plain `.mjs` files | The test script. It prints `PASS` or `FAIL` for each check. |
| `scripts/browser-tests/run.sh` | Starts Chrome and runs the script. |
| `docker/test-env.sh` | Starts the test board with the users `alice`, `bob` and `carol` and some topics. |

We did not add Playwright Test or Cypress. They would be a second system next to the 30 scripts we have.
The owner prefers scripts.

## What the test does

The file is `scripts/browser-tests/user-journey.mjs`.

1. **Guest:** sees the forums, reads a topic, sees read-only like buttons. "Post a reply" shows the login form.
2. **Login and logout:** a wrong password gives an error. The right password shows the user name. Logout works.
3. **Browse:** index, forum, topic by clicking. A long topic has pages. The breadcrumb goes back.
4. **Search:** a search finds a topic and the result opens.
5. **New topic:** write a title and text with the editor, check the preview, post it.
6. **Reply and quote:** quote a post and post the reply.
7. **Edit:** change the reply and save it.
8. **Like:** like another member's post, then undo it.
9. **Delete:** the dialog opens. Cancel keeps the post. Confirm deletes it. The test topic is removed.
10. **Control panel and message:** the control panel opens. A private message to `bob` is sent.
11. **Dark theme:** the switch works and the choice stays after a reload.
12. **Phone width (390 px):** the index, a topic and the reply page do not scroll sideways.

The test also fails if a page has a script error.

## How to run

On a normal computer:

```bash
docker/test-env.sh
BF_USER=alice scripts/browser-tests/run.sh user-journey.mjs
```

In a Claude cloud session, use the skill `phpbbtest` (`.claude/skills/phpbbtest/SKILL.md`).

## Limits

- Only Chrome was tested. Firefox should work with `BROWSER=firefox`.
- The test uses topic names from `docker/dummy-data.php`. It works on the test board only.
- It checks that things work. Contrast and other accessibility checks are in the `axe*.mjs` scripts.
