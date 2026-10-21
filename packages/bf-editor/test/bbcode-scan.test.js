import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scanBBCode } from '../src/bbcode/scan.js';

const shape = (nodes) =>
	nodes.map((n) => (n.type === 'text' ? n.value : `${n.name}${n.attrs}(${shape(n.children).join('|')})`));

test('plain text is one text node', () => {
	assert.deepEqual(shape(scanBBCode('hello')), ['hello']);
});

test('tags nest and keep their attributes', () => {
	const tree = scanBBCode('a [quote="x" post_id=7]in [b]bold[/b][/quote] z');
	assert.deepEqual(shape(tree), ['a ', 'quote="x" post_id=7(in |b(bold))', ' z']);
});

test('source holds the whole tag', () => {
	const [tag] = scanBBCode('[attachment=3]photo.jpg[/attachment]');
	assert.equal(tag.source, '[attachment=3]photo.jpg[/attachment]');
	assert.equal(tag.attrs, '=3');
});

test('unknown brackets stay text', () => {
	assert.deepEqual(shape(scanBBCode('a [1] and [note] b')), ['a [1] and [note] b']);
});

test('an unclosed tag stays text and its content survives', () => {
	assert.deepEqual(shape(scanBBCode('x [b]open and [i]x[/i]')), ['x [b]open and ', 'i(x)']);
});

test('a stray closing tag stays text', () => {
	assert.deepEqual(shape(scanBBCode('a [/b] b')), ['a [/b] b']);
});

test('code content is not scanned', () => {
	const [tag] = scanBBCode('[code][b]not bold[/b][/code]');
	assert.equal(tag.name, 'code');
	assert.equal(tag.children[0].value, '[b]not bold[/b]');
});

test('tag names are case insensitive', () => {
	assert.deepEqual(shape(scanBBCode('[B]x[/B]')), ['b(x)']);
});
