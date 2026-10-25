---
name: phpbbtest
description: Raise the Docker phpBB test board and run the browser tests (user-journey.mjs) inside a Claude cloud session (claude.ai/code, the Android or web app), where Docker needs workarounds. Use when asked to run, start or test the board, the theme or the browser tests in a cloud session. On a normal computer use docker/test-env.sh and scripts/browser-tests/run.sh instead. Companion to the phpbb skill, which holds the phpBB traps.
---

# phpBB test board and browser tests in a Claude cloud session

A cloud session has Docker, but its containers have no direct internet. Everything goes through a proxy that
re-signs TLS. `docker/test-env.sh` and `scripts/browser-tests/run.sh` therefore fail here. Two scripts in this
folder do the same job with the workarounds built in. The repo is never changed by them.

```bash
.claude/skills/phpbbtest/build-image.sh        # once per session, 1 to 3 minutes
.claude/skills/phpbbtest/run-user-journey.sh   # about 2 minutes, prints PASS/FAIL, exit 1 if any fail
```

Last result: 48 of 48 checks pass (`scripts/browser-tests/user-journey.mjs`, as `alice`, Chrome 153).
Another script from `scripts/browser-tests` runs with `run-user-journey.sh <script.mjs>`. Only the user-journey test
was tried this way. Scripts that use `HOST_DIR` file uploads (`posting.mjs`, `pictures.mjs`, ...) need
`HOST_DIR` and `fixtures.sh` files, and were not tried.

## Before you start: the network policy

The environment's **Network access** (cloud environment menu in the session's title bar, then Edit) must allow
`deb.debian.org` and `download.phpbb.com`. With the default list, the build stops at the apt step with a 403 from
the proxy. That is a policy denial: do not look for a way around it, ask the owner to allow the host (a broader
level, or add it under Allowed domains with "Allow package managers" ticked). It applies to new sessions only.
`curl -s -o /dev/null -w '%{http_code}\n' https://deb.debian.org/` prints 200 when it is open.
`github.com` stays denied for archive downloads (403); `git clone` of public repos works, and the script uses that.

## What build-image.sh does and why

| Problem in a cloud session | What the script does |
|---|---|
| No Docker daemon running (it also stops between turns of the conversation) | Starts `dockerd` with `setsid nohup`. Run the scripts again after a pause if `docker ps` says it cannot connect. |
| Docker Hub answers 429 (shared address) | Pulls `mariadb:11`, `php:8.5-apache`, `node:22-slim` in a retry loop, 20 s apart. |
| Containers cannot reach the proxy or trust its CA | Builds with `--network host`, copies `/root/.ccr/ca-bundle.crt` in, sets `http_proxy`/`https_proxy`. The proxy port is read from `$HTTPS_PROXY` and changes between sessions. |
| The proxy answers plain `http://` with 405 | Switches apt to `https://deb.debian.org`. |
| `github.com/.../archive/*.tar.gz` gives 403 | Takes the Markdown and mediaembed extensions from `git clone --depth 1 --branch <version>` and `COPY`s them in. Versions are read from the `ARG` lines in `docker/Dockerfile`. |

It works on a temporary copy of `docker/Dockerfile` and stops with a message if that file has changed so much that
the edits no longer match. Then update the script. The result is the image `docker-web:latest`, which
`docker compose up --no-build` uses (project `docker`, service `web`).

## What run-user-journey.sh does and why

| Problem | What the script does |
|---|---|
| `run.sh` needs `google-chrome` and a networked Node container | Uses the Playwright Chromium under `/opt/pw-browsers/` with `--remote-debugging-port=9223` and the host's Node (`npm install` in `scripts/browser-tests` once). |
| The index shows only "Your first forum" after the dummy data | The index is cached. It runs `dummy-data.sh` and then `purge-cache.sh`, in that order. |
| A login attempt that failed counts forever | Empties `phpbb_login_attempts` first. The test's wrong-password check adds one per run, and after 3 phpBB asks for a captcha (the test then fails at login). |

## Facts about the test

- It logs in as `alice` (password `adminadmin`, made by `docker/dummy-data.sh`); a plain member with no rights.
- The test itself takes 1.5 to 3 minutes, because phpBB allows one post per 15 seconds (`flood_interval`), and the test waits.
- It leaves soft-deleted `UI test <number>` topics and a private message `UI test message` in the board. Harmless.
- Run it in a fresh browser context, not the shared profile: a leftover login breaks the login step. The script does.
- Network errors in the console (`net::ERR_...`) come from the sandbox not reaching third-party hosts and are ignored.
- Chromium was started with `--no-sandbox` because the session runs as root.

## If something fails

| Symptom | Cause and fix |
|---|---|
| `Cannot connect to the Docker daemon` | The daemon stopped. `build-image.sh` starts it again (the image stays). |
| `429 Too Many Requests` on a pull | Docker Hub rate limit. The script retries; wait. |
| `403` from the proxy for `deb.debian.org` | Network policy, see the top. |
| Build fails with "docker/Dockerfile changed" | Edit the `swap(...)` patterns in `build-image.sh`. |
| `FAIL login: the user name is in the navigation bar` | Failed-login counter, or a captcha. Empty `phpbb_login_attempts`. |
| Index shows only "Your first forum" | Cache. `docker/purge-cache.sh`. |
| A new `FAIL` on a page that worked | Maybe a real change in the theme. Look at the text after `::` in the FAIL line, it holds what the page showed. |
| The script hangs with no output | The browser died. Start a new one on another port and run with `PORT=<port>`. Results print as they happen. |

Add anything new you learn here, in the same commit.
