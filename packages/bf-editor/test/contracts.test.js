// The contract checker, and that every fake in test/fakes/ satisfies its contract.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertImplements, contractNames } from '../src/contracts.js';
import { fakeCodec } from './fakes/fake-codec.js';
import { fakeEmbedProvider } from './fakes/fake-embed.js';
import { fakeLinkPolicy } from './fakes/fake-link-policy.js';
import { fakeUploadHandler } from './fakes/fake-upload.js';

test(`every fake satisfies its contract (Liskov: any implementation can stand in)`, () => {
	assertImplements(`Codec`, fakeCodec);
	assertImplements(`EmbedProvider`, fakeEmbedProvider);
	assertImplements(`LinkPolicy`, fakeLinkPolicy);
	assertImplements(`UploadHandler`, fakeUploadHandler());
});

test(`a missing member is reported by name`, () => {
	assert.throws(() => assertImplements(`Codec`, { id: `x`, parse() {} }), /Codec: missing serialize/);
});

test(`an unknown contract and a non-object are rejected`, () => {
	assert.throws(() => assertImplements(`Nope`, {}), /Unknown contract/);
	assert.throws(() => assertImplements(`Codec`, null), /expected an object/);
});

test(`all five contracts exist`, () => {
	assert.deepEqual([...contractNames].sort(), [`Codec`, `Command`, `EmbedProvider`, `LinkPolicy`, `UploadHandler`]);
});

test(`the fake uploader reports progress and a result`, async () => {
	const handler = fakeUploadHandler();
	const seen = [];
	const result = await handler.upload({ name: `a.png` }, { onProgress: (fraction) => seen.push(fraction) });
	assert.equal(result.name, `a.png`);
	assert.deepEqual(seen, [1]);
});
