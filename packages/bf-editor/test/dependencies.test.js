// Production dependencies need the owner's approval. A new one fails this test until it is
// added to the list below on purpose, and listed in docs/third-party.md.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const approved = [
	`prosemirror-commands`,
	`prosemirror-dropcursor`,
	`prosemirror-gapcursor`,
	`prosemirror-history`,
	`prosemirror-inputrules`,
	`prosemirror-keymap`,
	`prosemirror-model`,
	`prosemirror-state`,
	`prosemirror-transform`,
	`prosemirror-view`,
];

test(`the shipped code depends only on approved packages`, async () => {
	const { dependencies = {} } = JSON.parse(await readFile(`package.json`, `utf8`));
	assert.deepEqual(Object.keys(dependencies).sort(), approved);
});
