---
name: phpbbtest
description: Start the Docker phpBB test board and run the browser tests (user-journey.mjs) inside a Claude cloud session (claude.ai/code, the Android or web app). Docker needs workarounds there. Use when asked to run, start or test the board, the theme or the browser tests in a cloud session. On a normal computer use docker/test-env.sh and scripts/browser-tests/run.sh. The phpbb skill has the phpBB traps.
---

# Test board and browser tests in a Claude cloud session

A cloud session has Docker. But containers have no direct internet. All traffic goes through a proxy.
So `docker/test-env.sh` and `scripts/browser-tests/run.sh` fail here.
Two scripts in this folder do the same job. They contain the workarounds. They do not change the repo.

```bash
.claude/skills/phpbbtest/build-image.sh        # once per session, 1 to 3 minutes
.claude/skills/phpbbtest/run-user-journey.sh   # about 2 minutes, prints PASS or FAIL, exit code 1 if a check fails
```

Last result: 48 of 48 checks pass (`scripts/browser-tests/user-journey.mjs`, user `alice`, Chrome 153).

You can give another script from `scripts/browser-tests`: `run-user-journey.sh <script.mjs>`.
Only `user-journey.mjs` was tried. Scripts that upload files (`posting.mjs`, `pictures.mjs`) need `HOST_DIR` and the
files from `fixtures.sh`. These were not tried.

## Step 0: check the network policy

The environment setting **Network access** must allow `deb.debian.org` and `download.phpbb.com`.
Find it in the cloud environment menu in the session title bar. Choose Edit.
Without this, the build stops at the apt step. The proxy answers 403.
403 means "not allowed by policy". Do not look for a way around it. Ask the owner to allow the host.
Either use a wider access level, or add the host under Allowed domains and tick "Allow package managers".
A change applies to new sessions only.

Test it: `curl -s -o /dev/null -w '%{http_code}\n' https://deb.debian.org/` should print 200.

`github.com` archive downloads stay blocked (403). `git clone` of public repos works. The script uses `git clone`.

## What build-image.sh does

| Problem in a cloud session | What the script does |
|---|---|
| No Docker daemon is running. It also stops between turns. | Starts `dockerd`. If `docker ps` fails later, run the script again. The image stays. |
| Docker Hub answers 429 (too many requests). | Pulls `mariadb:11`, `php:8.5-apache` and `node:22-slim` in a loop. It waits 20 seconds between tries. |
| Containers cannot reach the proxy and do not trust its certificate. | Builds with `--network host`. Copies `/root/.ccr/ca-bundle.crt` into the image. Sets `http_proxy` and `https_proxy`. The proxy port is in `$HTTPS_PROXY`. It is different in each session. |
| The proxy refuses plain `http://` (405). | Changes apt to `https://deb.debian.org`. |
| `github.com/.../archive/*.tar.gz` gives 403. | Uses `git clone --depth 1 --branch <version>` for the Markdown and mediaembed extensions. Then it copies them into the image. The versions come from the `ARG` lines in `docker/Dockerfile`. |

The script changes a temporary copy of `docker/Dockerfile`.
If that file changes so much that the edits no longer match, the script stops with a message.
Then fix the patterns in `build-image.sh`.

The result is the image `docker-web:latest`. `docker compose up --no-build` uses it.

## What run-user-journey.sh does

| Problem | What the script does |
|---|---|
| `run.sh` needs `google-chrome` and a Node container with internet. | Uses the Chromium in `/opt/pw-browsers/` (port 9223) and the Node of the host. It runs `npm install` once in `scripts/browser-tests`. |
| After the dummy data, the index shows only "Your first forum". | The index is cached. The script runs `dummy-data.sh`, and then `purge-cache.sh`. The order matters. |
| Failed logins are counted. After 3, phpBB asks for a captcha. | Empties `phpbb_login_attempts` before the test. The test adds one failed login in every run. |

## Facts about the test

- It logs in as `alice`, password `adminadmin`. `docker/dummy-data.sh` makes this user. It has no special rights.
- The test takes 1.5 to 3 minutes. phpBB allows one post every 15 seconds (`flood_interval`). The test waits.
- It leaves soft-deleted topics named `UI test <number>` and one private message `UI test message`. This does no harm.
- It uses a fresh browser context. A login from an earlier run would break the login step.
- Console errors named `net::ERR_...` are ignored. The sandbox cannot reach third-party hosts.
- Chromium starts with `--no-sandbox`, because the session runs as root.

## If something fails

| Symptom | Cause and fix |
|---|---|
| `Cannot connect to the Docker daemon` | The daemon stopped. Run `build-image.sh` again. It starts the daemon. |
| `429 Too Many Requests` when pulling | Docker Hub limit. The script tries again. Wait. |
| Proxy answers `403` for `deb.debian.org` | Network policy. See step 0. |
| The build says "docker/Dockerfile changed" | Fix the `swap(...)` patterns in `build-image.sh`. |
| `FAIL login: the user name is in the navigation bar` | Too many failed logins. Empty `phpbb_login_attempts`. |
| The index shows only "Your first forum" | Cache. Run `docker/purge-cache.sh`. |
| A `FAIL` on a page that worked before | It may be a real change in the theme. The text after `::` in the FAIL line shows what the page said. |
| The script hangs and prints nothing | The browser may be dead. Start a new one on another port. Run with `PORT=<port>`. |

Add new findings to this file in the same commit.
