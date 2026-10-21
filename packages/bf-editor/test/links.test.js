import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { EditorState, TextSelection } from 'prosemirror-state';
import { createMarkdownBBCodeCodec } from '../src/codecs/markdown-bbcode.js';
import { assertImplements } from '../src/contracts.js';
import { createLinkCommand, currentLink, removeLink, setLink } from '../src/link-command.js';
import { defaultLinkPolicy } from '../src/link-policy.js';
import { createPlugins } from '../src/plugins.js';
import { useNewWindowLinks } from '../src/render/external-links.js';
import { schema } from '../src/schema.js';

const codec = createMarkdownBBCodeCodec(schema);

function stateWith(text, from, to = from) {
	const state = EditorState.create({ doc: codec.parse(text) });

	return state.apply(state.tr.setSelection(TextSelection.create(state.doc, from, to)));
}

function apply(command, state) {
	let next = state;
	command(state, (tr) => {
		next = state.apply(tr);
	});

	return next;
}

test(`the default policy satisfies the LinkPolicy contract`, () => {
	assertImplements(`LinkPolicy`, defaultLinkPolicy);
});

test(`policy: web and mail addresses pass, scripts do not`, () => {
	const { normalize } = defaultLinkPolicy;
	assert.equal(normalize(`https://example.com/a?b=1`), `https://example.com/a?b=1`);
	assert.equal(normalize(`  http://example.com `), `http://example.com`);
	assert.equal(normalize(`example.com/page`), `https://example.com/page`);
	assert.equal(normalize(`mailto:a@example.com`), `mailto:a@example.com`);
	assert.equal(normalize(`javascript:alert(1)`), null);
	assert.equal(normalize(`data:text/html,x`), null);
	assert.equal(normalize(`two words.com`), null);
	assert.equal(normalize(`word`), null);
	assert.equal(normalize(``), null);
});

test(`policy: web links open in a new window, mail links do not`, () => {
	assert.deepEqual(defaultLinkPolicy.attributes(`https://example.com`), {
		target: `_blank`,
		rel: `noopener noreferrer`,
	});
	assert.deepEqual(defaultLinkPolicy.attributes(`mailto:a@example.com`), {});
});

test(`link mark shows as an <a> that opens in a new window`, () => {
	const [tag, attrs] = schema.marks.link
		.create({ href: `https://example.com` })
		.type.spec.toDOM(schema.marks.link.create({ href: `https://example.com` }));
	assert.equal(tag, `a`);
	assert.equal(attrs.target, `_blank`);
	assert.equal(attrs.rel, `noopener noreferrer`);
});

test(`setLink links the selected text and writes Markdown`, () => {
	const state = apply(setLink(schema, `https://example.com`), stateWith(`hello world`, 1, 6));
	assert.equal(codec.serialize(state.doc), `[hello](https://example.com) world`);
});

test(`setLink with no selection writes the address as the link`, () => {
	const state = apply(setLink(schema, `https://example.com`), stateWith(`ab`, 2));
	assert.equal(codec.serialize(state.doc), `a[https://example.com](https://example.com)b`);
});

test(`setLink with the cursor inside a link changes the whole link`, () => {
	const state = apply(setLink(schema, `https://new.example`), stateWith(`[hello](https://old.example) x`, 3));
	assert.equal(codec.serialize(state.doc), `[hello](https://new.example) x`);
});

test(`currentLink finds the address under the cursor`, () => {
	assert.equal(currentLink(stateWith(`[hello](https://old.example) x`, 3), schema), `https://old.example`);
	assert.equal(currentLink(stateWith(`plain`, 2), schema), ``);
});

test(`removeLink with the cursor inside takes off the whole link`, () => {
	const state = apply(removeLink(schema), stateWith(`[hello](https://old.example) x`, 3));
	assert.equal(codec.serialize(state.doc), `hello x`);
});

test(`removeLink does nothing where there is no link`, () => {
	assert.equal(removeLink(schema)(stateWith(`plain`, 2)), false);
});

test(`the link command asks, cleans the answer and applies it`, async () => {
	const asked = [];
	const command = createLinkCommand(schema, {
		ask: async (current) => {
			asked.push(current);

			return { href: `example.com` };
		},
	});
	assertImplements(`Command`, command);
	const view = { state: stateWith(`hello`, 1, 6) };
	view.dispatch = (tr) => {
		view.state = view.state.apply(tr);
	};
	assert.equal(command.run(view.state), true);
	command.run(view.state, view.dispatch, view);
	await new Promise((resolve) => setImmediate(resolve));
	assert.deepEqual(asked, [``]);
	assert.equal(codec.serialize(view.state.doc), `[hello](https://example.com)`);
});

test(`the link command drops an address the policy refuses`, async () => {
	const command = createLinkCommand(schema, { ask: async () => ({ href: `javascript:alert(1)` }) });
	const view = { state: stateWith(`hello`, 1, 6) };
	view.dispatch = (tr) => {
		view.state = view.state.apply(tr);
	};
	command.run(view.state, view.dispatch, view);
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(codec.serialize(view.state.doc), `hello`);
});

test(`the link command does nothing when the dialog is cancelled`, async () => {
	const command = createLinkCommand(schema, { ask: async () => null });
	const view = { state: stateWith(`hello`, 1, 6) };
	view.dispatch = () => assert.fail(`must not change the document`);
	command.run(view.state, view.dispatch, view);
	await new Promise((resolve) => setImmediate(resolve));
});

const page = (html, lang = `en`) => {
	const dom = new JSDOM(`<html lang="${lang}"><body>${html}</body></html>`, {
		url: `https://baneforum.dk/viewtopic.php`,
	});

	return dom.window.document;
};

test(`render: a link to another site gets a new window, rel, and a hidden warning`, () => {
	const doc = page(`<p><a class="postlink" href="https://example.com/x">site</a></p>`);
	assert.equal(useNewWindowLinks(doc), 1);
	const link = doc.querySelector(`a`);
	assert.equal(link.target, `_blank`);
	assert.equal(link.rel, `noopener noreferrer`);
	assert.ok(link.hasAttribute(`data-bf-external`));
	assert.equal(link.querySelector(`.bf-visually-hidden`).textContent.trim(), `(opens in a new window)`);
});

test(`render: the warning follows the page language`, () => {
	const doc = page(`<a href="https://example.com">x</a>`, `da`);
	useNewWindowLinks(doc);
	assert.match(doc.querySelector(`.bf-visually-hidden`).textContent, /åbner i et nyt vindue/);
});

test(`render: links on the same site, mail links and anchors stay as they are`, () => {
	const doc = page(
		`<a href="/viewtopic.php?t=1">a</a><a href="https://baneforum.dk/x">b</a><a href="mailto:a@b.dk">c</a><a href="#top">d</a>`,
	);
	assert.equal(useNewWindowLinks(doc), 0);
	assert.equal(doc.querySelector(`[target]`), null);
});

test(`render: running twice does not add a second warning`, () => {
	const doc = page(`<a href="https://example.com" rel="nofollow">x</a>`);
	useNewWindowLinks(doc);
	assert.equal(useNewWindowLinks(doc), 0);
	assert.equal(doc.querySelectorAll(`.bf-visually-hidden`).length, 1);
	assert.equal(doc.querySelector(`a`).rel, `nofollow noopener noreferrer`);
});

function pasteInto(state, text) {
	const plugin = createPlugins(schema, []).find((candidate) => candidate.props.handlePaste);
	const view = { state, dispatch: (tr) => (view.state = view.state.apply(tr)) };
	const handled = plugin.props.handlePaste(view, { clipboardData: { getData: () => text } });

	return { handled, view };
}

test(`paste: an address over selected text links the text`, () => {
	const { handled, view } = pasteInto(stateWith(`hello world`, 1, 6), `https://example.com/x`);
	assert.equal(handled, true);
	assert.equal(codec.serialize(view.state.doc), `[hello](https://example.com/x) world`);
});

test(`paste: an address with no selection is written as a link`, () => {
	const { handled, view } = pasteInto(stateWith(`a`, 2), `https://example.com`);
	assert.equal(handled, true);
	assert.equal(codec.serialize(view.state.doc), `a[https://example.com](https://example.com)`);
});

test(`paste: ordinary text and unsafe addresses are left to the editor`, () => {
	assert.equal(pasteInto(stateWith(`a`, 2), `just words`).handled, false);
	assert.equal(pasteInto(stateWith(`a`, 2), `see https://example.com now`).handled, false);
	assert.equal(pasteInto(stateWith(`a`, 2), `javascript:alert(1)`).handled, false);
});
