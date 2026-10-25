# Handoff: user-journey browser test

> The steps below were turned into scripts: see the skill `.claude/skills/phpbbtest/SKILL.md`. Use that first.

For whoever (or whichever session) picks up PR #3 (`claude/ui-test-plan-451cpx`). Start by reading
`plans/user-journey-tests.md` (the plan) and `scripts/browser-tests/user-journey.mjs` (the test).

## State (updated)

**The test has now been run: 48 of 48 checks pass** on the test board in Chrome 153 (Playwright's Chromium), in a cloud
session with `deb.debian.org` and `download.phpbb.com` allowed. What it took:

- The image was built from a scratch copy of `docker/Dockerfile` (not committed): `--network host`, the proxy CA copied
  in, `http_proxy`/`https_proxy` set (the proxy port changes between sessions), apt switched to `https://`, and the
  two extension tarballs from `github.com/.../archive/...` (403 through the proxy) replaced by `git clone --depth 1
  --branch 1.5.0` / `2.1.0` copied in. Then `docker compose up -d --no-build`, `docker/purge-cache.sh`,
  `docker/dummy-data.sh`, and `docker/purge-cache.sh` again (the index was cached from before the dummy data).
- `run.sh` was not used (no `google-chrome`, and its Node container has no network). Instead: Chromium started with
  `--remote-debugging-port=9223`, then `cd scripts/browser-tests && npm install && PORT=9223 BF_USER=alice node user-journey.mjs`.
- Fixes made to the script while running it: the main page uses a fresh browser context (a leftover login broke the
  login step); network errors (`net::ERR_*`, the sandbox cannot reach third-party hosts) are not counted as script errors;
  searching a word that is in every post fails ("too common"), so it searches `Typography`; phpBB's flood interval
  (15 s) is waited out between posts; the first post of a topic is only deletable after the reply is gone; an edit of
  the last post by its author is not marked "edited" by phpBB, so that check was removed; results print as they happen.
- One failed login per run is counted by phpBB. After 3 it asks for a captcha. Reset with
  `delete from phpbb_login_attempts; update phpbb_users set user_login_attempts=0`.

The rest of this file is the original handoff, kept for the steps and the Docker background.

## State (original)

- Done: the plan, the test script and a README row are written, committed and pushed. Draft PR:
  https://github.com/sjldk/baneforum-phpbb3-theme/pull/3. The repo has no CI.
- **Not done: the script has never been run.** Only `node --check` passed. All selectors and page flows are
  guesses from reading the templates and the existing tests. Expect several fixes on the first real run.
- Not run because the cloud session could not build `docker/Dockerfile`: its network policy blocked
  `deb.debian.org` (proxy answers 403, a policy denial, not a fault).

## Next steps

1. **Start the new environment with network access that allows the build.** In the environment settings (cloud
   environment menu in the session's title bar, then Edit) choose a broader Network access level, or add
   `deb.debian.org`, `download.phpbb.com` and `github.com` under Allowed domains with "Allow package managers"
   ticked. Docs: https://code.claude.com/docs/en/cloud-environments#network-access
2. Check out the branch: `git fetch origin claude/ui-test-plan-451cpx && git checkout claude/ui-test-plan-451cpx`.
3. Start Docker if there is no daemon: `setsid nohup dockerd >/tmp/dockerd.log 2>&1 </dev/null &`, then wait about
   10 seconds for `docker ps` to work. (In the old session it was installed but not running, and it stopped when
   the shell that started it ended, hence `setsid`.)
4. Docker Hub rate-limits pulls from shared addresses (HTTP 429). If a pull fails, retry in a loop with a pause
   for `mariadb:11`, `php:8.5-apache` and `node:22-slim`. It worked after a few minutes.
5. Start the board: `docker/test-env.sh` (builds, installs phpBB, fills it with `alice`, `bob`, `carol` and dummy
   topics; password `adminadmin`). The first start takes a few minutes. Board: http://localhost:8080.
6. Run: `BF_USER=alice scripts/browser-tests/run.sh user-journey.mjs`.
   `run.sh` needs `google-chrome`. This cloud image has no such command, only Playwright's Chromium under
   `/opt/pw-browsers/`. Either put a `google-chrome` wrapper on `PATH` that execs that Chromium, or start Chromium
   yourself with `--remote-debugging-port=9222` and run the node script from `scripts/browser-tests` directly
   (`HOST_DIR` set to that folder, `npm install` there first).
7. Fix the script until every check passes or fails for a real reason. Likely weak spots:
   - the login error selector (`.error, .errorbox`) and the logged-in name selector;
   - the search form submit selector;
   - the new-topic page: the `a[href*="mode=post"]` link, the Preview button, the `#preview .content` selector;
   - the editor focus and typing (`bf-editor`), which depends on the shadow DOM;
   - the like buttons after click (the page may reload or update in place);
   - the delete dialog (`#phpbb_confirm`, `input[name="confirm"]`), copied from `dialogs.mjs`;
   - the private message form (`#username_list`, the add button) and the success message text;
   - the dark-theme switch (`.bf-theme-switch__button`, hidden until the script runs);
   - topic names from `docker/dummy-data.php` (`General talk`, `Hot topic, unread`,
     `Unread topic you posted in`).
8. Check that the script cleans up after itself on the test board (it deletes its topic's posts, but not the private
   message), and that a failed run does not leave a stray topic that breaks the next run.
9. Mark the PR ready for review when it passes, and update the "Not tested yet" paragraph in its description.

## Docker build workaround (only if the policy still blocks the normal build)

Containers cannot reach the session proxy or trust its CA by default (see `/root/.ccr/README.md`). What worked
until the 403 policy denial was building from a scratch copy of `docker/` (not committed) with:

- `docker build --network host`, with the proxy CA copied in as `ca.crt` and installed in an early layer;
- `ENV http_proxy/https_proxy=http://127.0.0.1:<port>` (read the port from `$HTTPS_PROXY`; it changed between
  sessions) and `SSL_CERT_FILE`/`CURL_CA_BUNDLE` pointing at the copied CA;
- apt sources switched to `https://` (the proxy answers plain HTTP with 405);
- the image tagged `docker-web:latest`, then `docker compose -f docker/docker-compose.yml up -d --no-build`.

With `deb.debian.org` allowed this should get past the apt step. It is a workaround for a restricted network only;
on a machine with normal internet access `docker/test-env.sh` needs none of it.

## Things to know

- Never run `docker compose down -v` or touch the `phpbb_prod` database (see `.claude/skills/phpbb`).
- The test board's login is `admin` / `adminadmin`; the script uses `alice` (a normal member) through `BF_USER`.
- phpBB refuses a form sent in the same second the page was made, so the script waits 1.6 seconds before submits.
- Add anything new learned about phpBB or the board to the right table in `.claude/skills/phpbb/SKILL.md`, in the
  same commit (the repo's own rule).
