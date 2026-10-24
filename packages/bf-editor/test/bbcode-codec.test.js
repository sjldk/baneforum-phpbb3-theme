import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBBCodeCodec } from '../src/codecs/bbcode.js';
import { assertImplements } from '../src/contracts.js';
import { schema } from '../src/schema.js';

const codec = createBBCodeCodec(schema);
// A post that was written in Markdown is read as Markdown and saved as BBCode.
const markdown = createBBCodeCodec(schema, { markdown: true });
const roundTrip = (text) => codec.serialize(codec.parse(text));
const convert = (text) => markdown.serialize(markdown.parse(text));
const types = (text) => codec.parse(text).children.map((node) => node.type.name);

test(`the codec satisfies the Codec contract`, () => {
	assertImplements(`Codec`, codec);
});

test(`BBCode formatting reads and writes unchanged`, () => {
	const text = `a [b]bold[/b] and [i]it[/i] and [s]gone[/s] and [url=https://example.com]site[/url]`;
	assert.equal(roundTrip(text), text);
});

test(`BBCode text is not read as Markdown`, () => {
	for (const text of [
		`**not bold**`,
		`*not italic*`,
		`# not a heading`,
		`- not a list`,
		`> not a quote`,
		`[not](https://a.test)`,
	]) {
		assert.equal(roundTrip(text), text, text);
		assert.equal(codec.parse(text).firstChild.type.name, `paragraph`, text);
	}
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

test(`BBCode inside a quote is read`, () => {
	const doc = codec.parse(`[quote="x"][b]b[/b][/quote]`);
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
		`[code]\ncode\n[/code]`,
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

test(`spaces inside the markers are kept`, () => {
	assert.equal(roundTrip(`x [b] bold [/b] y`), `x [b] bold [/b] y`);
});

test(`typed entities and backslashes stay as typed`, () => {
	assert.equal(roundTrip(`a &amp; b \\* c`), `a &amp; b \\* c`);
});

test(`empty and broken input gives a valid document`, () => {
	assert.equal(codec.parse(``).childCount, 1);
	assert.equal(roundTrip(`[quote]unclosed`), `[quote]unclosed`);
});

test(`writing then reading gives the same document (stable)`, () => {
	for (const text of [`a [b]x[/b] :) [quote=u]q[/quote] z`, `[b]a[/b]\n[i]b[/i]`, `x\n\ny`]) {
		const once = roundTrip(text);
		assert.equal(roundTrip(once), once, text);
	}
});

test(`bold that spans a blank line gives a paragraph on each side`, () => {
	assert.equal(roundTrip(`[i]one\n\ntwo[/i]`), `[i]one[/i]\n\n[i]two[/i]`);
});

test(`a link whose text is its address is written as [url]address[/url]`, () => {
	assert.equal(roundTrip(`see [url]https://example.com/a[/url] now`), `see [url]https://example.com/a[/url] now`);
	assert.equal(roundTrip(`word[url]https://example.com/a[/url]`), `word[url]https://example.com/a[/url]`);
	assert.equal(roundTrip(`[url=https://example.com/a]text[/url]`), `[url=https://example.com/a]text[/url]`);
});

test(`a bare address in the text stays bare`, () => {
	assert.equal(roundTrip(`see https://example.com/a now`), `see https://example.com/a now`);
});

test(`a line that looks like Markdown is plain text, so a list in BBCode is only [list]`, () => {
	assert.equal(roundTrip(`Hej\n- one\n- two`), `Hej\n- one\n- two`);
	assert.equal(roundTrip(`Ulemper:\n        - bruger`), `Ulemper:\n        - bruger`);
});

test(`Markdown is converted to BBCode when the post is Markdown`, () => {
	assert.equal(
		convert(`**bold** *italic* [link](https://example.com) and ~~gone~~`),
		`[b]bold[/b] [i]italic[/i] [url=https://example.com]link[/url] and [s]gone[/s]`,
	);
	assert.equal(convert(`a [b]bold[/b] and **more**`), `a [b]bold[/b] and [b]more[/b]`);
});

test(`a Markdown heading becomes a size and bold`, () => {
	assert.equal(
		convert(`# Big\n\ntext\n\n## Less\n\n#### Small`),
		`[size=150][b]Big[/b][/size]\n\ntext\n\n[size=130][b]Less[/b][/size]\n\n[b]Small[/b]`,
	);
	assert.equal(convert(`Title\n=====`), `[size=150][b]Title[/b][/size]`);
});

test(`a Markdown list becomes [list], nested and numbered`, () => {
	assert.equal(convert(`Hej\n\n- one\n- two **b**`), `Hej\n\n[list]\n[*]one\n[*]two [b]b[/b]\n[/list]`);
	assert.equal(convert(`1. a\n2. b`), `[list=1]\n[*]a\n[*]b\n[/list]`);
	assert.equal(convert(`- a\n\n1. b`), `[list]\n[*]a\n[/list]\n[list=1]\n[*]b\n[/list]`);
	assert.equal(convert(`- a\n  - b\n- c`), `[list]\n[*]a\n[list]\n[*]b\n[/list]\n[*]c\n[/list]`);
});

test(`Markdown code becomes [code]`, () => {
	assert.equal(convert(`\`\`\`\nlet a = 1;\n\`\`\``), `[code]\nlet a = 1;\n[/code]`);
	assert.equal(convert(`    indented\n    code`), `[code]\nindented\ncode\n[/code]`);
});

test(`a Markdown table becomes [table] with a header row`, () => {
	assert.equal(
		convert(`| a | b |\n|---|---|\n| 1 | 2 |`),
		`[table]\n[tr][th]a[/th][th]b[/th][/tr]\n[tr][td]1[/td][td]2[/td][/tr]\n[/table]`,
	);
});

test(`a colon in the delimiter row of a table sets the alignment`, () => {
	assert.equal(
		convert(`| L | C | R | N |\n|:--|:-:|--:|---|\n| 1 | 2 | 3 | 4 |`),
		`[table]\n[tr][th align=left]L[/th][th align=center]C[/th][th align=right]R[/th][th]N[/th][/tr]\n[tr][td align=left]1[/td][td align=center]2[/td][td align=right]3[/td][td]4[/td][/tr]\n[/table]`,
	);
});

test(`a table cell holds formatting, an escaped bar and a short row is filled`, () => {
	assert.equal(
		convert(`| a | b |\n|---|---|\n| **x** \\| y |\n`),
		`[table]\n[tr][th]a[/th][th]b[/th][/tr]\n[tr][td][b]x[/b] | y[/td][td][/td][/tr]\n[/table]`,
	);
});

test(`bars without a delimiter row are not a table: they stay as [code]`, () => {
	assert.equal(convert(`| a | b |\n| 1 | 2 |`), `[code]\n| a | b |\n| 1 | 2 |\n[/code]`);
});

test(`a [table] that was written as BBCode reads and writes unchanged`, () => {
	const text = `[table]\n[tr][th]a[/th][th align=center]b[/th][/tr]\n[tr][td]1[/td][td]2[/td][/tr]\n[/table]`;
	assert.equal(roundTrip(text), text);
});

test(`a Markdown link that names its address elsewhere is written as [url]`, () => {
	assert.equal(
		convert(`See [the shop][s1] and [Other][].\n\n[s1]: https://a.test/shop\n[other]: https://b.test/ "Title"`),
		`See [url=https://a.test/shop]the shop[/url] and [url=https://b.test/]Other[/url].`,
	);
	assert.equal(convert(`No [such][x] link`), `No [such][x] link`);
});

test(`a Markdown quote becomes [quote]`, () => {
	assert.equal(convert(`> one\n> **two**`), `[quote]\none\n[b]two[/b]\n[/quote]`);
});

test(`an attachment inside Markdown is kept`, () => {
	assert.equal(
		convert(`- see [attachment=0]a.jpg[/attachment]`),
		`[list]\n[*]see [attachment=0]a.jpg[/attachment]\n[/list]`,
	);
});

test(`converted text is stable: reading it as BBCode gives the same text`, () => {
	for (const text of [`# T\n\n- a\n- b\n\n**x** and [y](https://z.test)`, `> q`]) {
		const once = convert(text);
		assert.equal(roundTrip(once), once, text);
	}
});
