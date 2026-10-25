# Handoff: user-journey test

## Status

The test is finished. It passes 48 of 48 checks on the test board (Chrome 153).
The work is in pull request #3.

## How to run it in a Claude cloud session

Use the skill `phpbbtest`. Read `.claude/skills/phpbbtest/SKILL.md`. In short:

```bash
.claude/skills/phpbbtest/build-image.sh
.claude/skills/phpbbtest/run-user-journey.sh
```

The environment must allow the hosts `deb.debian.org` and `download.phpbb.com`.
The skill explains why and how to check this.

## What went wrong on the first runs

These were errors in the test script. They are fixed. The theme had no errors.

- A login from an earlier run stayed in the browser. The test now uses a fresh browser context.
- phpBB ignores a search word that is in every post. The test now searches for "Typography".
- phpBB allows one post every 15 seconds. The test now waits.
- phpBB does not mark an edit of the last post as "edited" when the author edits it. That check was removed.
- Each run adds one failed login. After 3, phpBB asks for a captcha. Empty the table `phpbb_login_attempts` to fix it.

## Open points

- Firefox was not tested.
- The test leaves soft-deleted topics and one private message on the test board. This does no harm.
