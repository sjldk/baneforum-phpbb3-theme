import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMarkdownBBCodeCodec } from '../src/codecs/markdown-bbcode.js';
import { assertImplements } from '../src/contracts.js';
import { schema } from '../src/schema.js';

const codec = createMarkdownBBCodeCodec(schema);
const roundTrip = (text) => codec.serialize(codec.parse(text));
const types = (text) => codec.parse(text).children.map((node) => node.type.name);

test(`the codec satisfies the Codec contract`, () => {
	assertImplements(`Codec`, codec);
});

test(`Markdown formatting reads and writes unchanged`, () => {
	assert.equal(
		roundTrip(`**bold** *italic* ~~strike~~ [link](https://example.com)`),
		`**bold** *italic* ~~strike~~ [link](https://example.com)`,
	);
});

test(`legacy BBCode becomes Markdown`, () => {
	assert.equal(
		roundTrip(`a [b]bold[/b] and [i]it[/i] and [url=https://example.com]site[/url]`),
		`a **bold** and *it* and [site](https://example.com)`,
	);
});

test(`a single newline is a line break, a blank line a new paragraph`, () => {
	assert.equal(roundTrip(`one\ntwo\n\nthree`), `one\ntwo\n\nthree`);
	assert.deepEqual(types(`one\ntwo\n\nthree`), [`paragraph`, `paragraph`]);
});

test(`a quote keeps its author and attributes`, () => {
	const text = `[quote="admin" post_id=1 time=2 user_id=3]hello[/quote]\nreply`;
	const doc = codec.parse(text);
	assert.equal(doc.firstChild.type.name, `blockquote`);
	assert.equal(doc.firstChild.attrs.author, `admin`);
	// Written the way phpBB's own quote button writes it: content on its own lines.
	assert.equal(codec.serialize(doc), `[quote="admin" post_id=1 time=2 user_id=3]\nhello\n[/quote]\nreply`);
});

test(`Markdown inside a quote is read`, () => {
	const doc = codec.parse(`[quote="x"]**b**[/quote]`);
	assert.equal(doc.firstChild.firstChild.firstChild.marks[0].type.name, `strong`);
});

test(`an inline attachment and an image survive`, () => {
	const text = `see [attachment=0]a.jpg[/attachment] and [img]https://x.test/a.png[/img]`;
	assert.equal(roundTrip(text), text);
});

test(`a video tag becomes an embed and is saved as it was`, () => {
	const text = `[youtube]http://www.youtube.com/watch?v=rrUe_7NY0g4[/youtube]`;
	const doc = codec.parse(text);
	assert.equal(doc.firstChild.type.name, `embed`);
	assert.equal(doc.firstChild.attrs.provider, `youtube`);
	assert.equal(codec.serialize(doc), text);
});

test(`markup the editor cannot show is kept as it is`, () => {
	for (const text of [
		`a [u]under[/u] b`,
		`a [color=red]red[/color] b`,
		`[list]\n[*]one\n[*]two\n[/list]`,
		`# Heading`,
		`\`\`\`\ncode\n\`\`\``,
	]) {
		assert.equal(roundTrip(text), text, text);
	}
});

test(`smilie codes become emoji`, () => {
	assert.equal(roundTrip(`hi :) and :D`), `hi 🙂 and 😀`);
});

test(`a URL with a smilie-like part is left alone`, () => {
	assert.equal(roundTrip(`see http://example.com/a:D`), `see http://example.com/a:D`);
});

test(`spaces move outside the markers and are kept`, () => {
	assert.equal(roundTrip(`x [b] bold [/b] y`), `x  **bold**  y`);
});

test(`a paragraph that would turn into a list is protected`, () => {
	const doc = schema.nodes.doc.create(null, [schema.nodes.paragraph.create(null, schema.text(`- not a list`))]);
	assert.equal(codec.serialize(doc), `​- not a list`);
});

test(`typed entities and backslashes stay as typed`, () => {
	assert.equal(roundTrip(`a &amp; b \\* c`), `a &amp; b \\* c`);
});

test(`empty and broken input gives a valid document`, () => {
	assert.equal(codec.parse(``).childCount, 1);
	assert.equal(roundTrip(`[quote]unclosed`), `[quote]unclosed`);
});

test(`writing then reading gives the same document (stable)`, () => {
	for (const text of [`a [b]x[/b] :) [quote=u]q[/quote] z`, `**a**\n*b*`, `x\n\ny`]) {
		const once = roundTrip(text);
		assert.equal(roundTrip(once), once, text);
	}
});

test(`italic that spans blank lines is marked paragraph by paragraph`, () => {
	assert.equal(roundTrip(`[i]one\n\ntwo[/i]`), `*one*\n\n*two*`);
});

test(`a bare address is kept bare, or given link syntax when glued to a word`, () => {
	assert.equal(roundTrip(`see [url]https://example.com/a[/url] now`), `see https://example.com/a now`);
	assert.equal(roundTrip(`word[url]https://example.com/a[/url]`), `word[https://example.com/a](https://example.com/a)`);
});

test(`a list keeps the blank lines it had in front of it`, () => {
	assert.equal(roundTrip(`Hej\n- one\n- two`), `Hej\n- one\n- two`);
	assert.equal(roundTrip(`Hej\n\n- one\n- two`), `Hej\n\n- one\n- two`);
});

test(`an indented line inside a paragraph is not protected`, () => {
	assert.equal(roundTrip(`Ulemper:\n        - bruger`), `Ulemper:\n        - bruger`);
});
