# Working with the owner

The owner is not a native English speaker. In chat replies and in docs:

- Keep answers short. Say the result first, then only the details that are needed.
- Use simple, common words and short sentences. No idioms, no slang, no fancy words.
- Do not repeat what was already said. Do not narrate every step.
- Use a short list or a small table when it is easier to read than a paragraph.
- If a technical term is needed, use it, but do not add more advanced words around it.

The same applies to docs you write: README files, plans, handoffs, skills and PR descriptions. Use simple words and
short sentences. One idea per sentence. Explain a hard word the first time it is used.

Code and code comments keep the style they already have.

When you change code, follow `docs/coding-guidelines.md`.

**Hard rule: look at the real page after every visual change.** A visual change is a change to CSS, a template or the output of an
extension. Do this in the same turn, without being asked:

1. Purge the cache with `docker/purge-cache.sh`. The board on `http://localhost:8080` mounts the repo.
2. Take a screenshot of the real page and look at it. Wide, dark theme and phone width. For a repeatable run, use
   `PORT=9333 scripts/browser-tests/run.sh <script>.mjs` (for example `featured.mjs`).
3. Fix what you see. Then say what you checked, and what you did not.

A change is not done before this. "Not checked in the browser" is not an acceptable ending. If the browser fails, find another way.
