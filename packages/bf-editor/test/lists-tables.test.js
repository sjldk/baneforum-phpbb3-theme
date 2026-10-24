// Lists and tables: read from BBCode (and from Markdown) into real nodes, written back as BBCode.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBBCodeCodec } from '../src/codecs/bbcode.js';
import { schema } from '../src/schema.js';

const codec = createBBCodeCodec(schema);
const markdown = createBBCodeCodec(schema, { markdown: true });
const roundTrip = (text) => codec.serialize(codec.parse(text));
const kinds = (text, using = codec) => using.parse(text).children.map((node) => node.type.name);

test(`a bullet list is a list, and it is written back as it was`, () => {
	const text = `[list]\n[*]one\n[*]two\n[/list]`;
	assert.deepEqual(kinds(text), [`bullet_list`]);
	assert.equal(roundTrip(text), text);
});

test(`a numbered list keeps its marker`, () => {
	for (const marker of [`1`, `a`, `A`, `i`, `I`]) {
		const text = `[list=${marker}]\n[*]one\n[*]two\n[/list]`;
		assert.deepEqual(kinds(text), [`ordered_list`]);
		assert.equal(codec.parse(text).firstChild.attrs.marker, marker);
		assert.equal(roundTrip(text), text);
	}
});

test(`a list in a list is nested in its item`, () => {
	const text = `[list]\n[*]a\n[list=1]\n[*]x\n[*]y\n[/list]\n[*]b\n[/list]`;
	const list = codec.parse(text).firstChild;
	assert.equal(list.childCount, 2);
	assert.deepEqual(
		list.firstChild.children.map((node) => node.type.name),
		[`paragraph`, `ordered_list`],
	);
	assert.equal(roundTrip(text), text);
});

test(`an item holds formatting, links and line breaks`, () => {
	const text = `[list]\n[*]a [b]bold[/b] and [url=https://example.com]link[/url]\n[*]one\ntwo\n[/list]`;
	assert.equal(roundTrip(text), text);
	assert.equal(codec.parse(text).firstChild.lastChild.firstChild.childCount, 3);
});

test(`a list written with other spacing is a list, and is written in the usual way`, () => {
	assert.deepEqual(kinds(`[list][*]a[*]b[/list]`), [`bullet_list`]);
	assert.equal(roundTrip(`[list][*]a[*]b[/list]`), `[list]\n[*]a\n[*]b\n[/list]`);
	assert.equal(roundTrip(`[list]\n  [*] a \n  [*] b\n[/list]`), `[list]\n[*]a\n[*]b\n[/list]`);
});

test(`a list the editor cannot show exactly stays a raw block, unchanged`, () => {
	for (const text of [
		`[list]\n[*]a [quote]q[/quote]\n[/list]`,
		`[list]\nwords before\n[*]a\n[/list]`,
		`[list=disc]\n[*]a\n[/list]`,
		`[list]\n[/list]`,
	]) {
		assert.deepEqual(kinds(text), [`raw_block`], text);
		assert.equal(roundTrip(text), text);
	}
});

test(`text around a list stays as paragraphs`, () => {
	const text = `Before\n\n[list]\n[*]a\n[/list]\n\nAfter`;
	assert.deepEqual(kinds(text), [`paragraph`, `bullet_list`, `paragraph`]);
	assert.equal(roundTrip(text), text);
});

test(`a table has header cells and cells, and is written back as it was`, () => {
	const text = `[table]\n[tr][th]a[/th][th]b[/th][/tr]\n[tr][td]1[/td][td]2[/td][/tr]\n[/table]`;
	const table = codec.parse(text).firstChild;
	assert.equal(table.type.name, `table`);
	assert.deepEqual(
		table.firstChild.children.map((cell) => cell.type.name),
		[`table_header`, `table_header`],
	);
	assert.deepEqual(
		table.lastChild.children.map((cell) => cell.type.name),
		[`table_cell`, `table_cell`],
	);
	assert.equal(roundTrip(text), text);
});

test(`a cell keeps align, colspan and rowspan`, () => {
	const text = `[table]\n[tr][th align=center colspan=2]wide[/th][/tr]\n[tr][td align=left]a[/td][td align=right rowspan=2]b[/td][/tr]\n[tr][td]c[/td][/tr]\n[/table]`;
	assert.equal(roundTrip(text), text);
});

test(`a cell holds formatting and line breaks`, () => {
	const text = `[table]\n[tr][th][b]x[/b][/th][/tr]\n[tr][td]one\ntwo [url=https://a.test]link[/url][/td][/tr]\n[/table]`;
	assert.equal(roundTrip(text), text);
});

test(`thead and tbody are only wrappers: the table is written without them`, () => {
	const text = `[table][thead][tr][th]a[/th][/tr][/thead][tbody][tr][td]1[/td][/tr][/tbody][/table]`;
	assert.deepEqual(kinds(text), [`table`]);
	assert.equal(roundTrip(text), `[table]\n[tr][th]a[/th][/tr]\n[tr][td]1[/td][/tr]\n[/table]`);
});

test(`a table the editor cannot show exactly stays a raw block, unchanged`, () => {
	for (const text of [
		`[table]\n[tr][td colspan=2]a[/td][/tr]\n[tr][td]b[/td][/tr]\n[/table]`,
		`[table]\n[tr][td]a [quote]q[/quote][/td][/tr]\n[/table]`,
		`[table]\nwords\n[tr][td]a[/td][/tr]\n[/table]`,
		`[table]\n[/table]`,
	]) {
		assert.deepEqual(kinds(text), [`raw_block`], text);
		assert.equal(roundTrip(text), text);
	}
});

test(`a table in a quote is a table`, () => {
	const text = `[quote]\n[table]\n[tr][th]a[/th][/tr]\n[/table]\n[/quote]`;
	assert.deepEqual(
		codec.parse(text).firstChild.children.map((node) => node.type.name),
		[`table`],
	);
	assert.equal(roundTrip(text), text);
});

test(`a Markdown list and table are real nodes, and they are saved as the import writes them`, () => {
	for (const [source, kind] of [
		[`- one\n- two`, `bullet_list`],
		[`1. one\n2. two`, `ordered_list`],
		[`| a | b |\n|---|:-:|\n| 1 | 2 |`, `table`],
	]) {
		assert.deepEqual(kinds(source, markdown), [kind], source);
		const saved = markdown.serialize(markdown.parse(source));
		// What the editor writes is what the converter writes, and what the converter writes reads back the same.
		assert.equal(saved, roundTrip(saved), source);
	}
});
