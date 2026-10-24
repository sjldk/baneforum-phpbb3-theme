// YouTube: reading addresses and start times, turning a lone address into a player, and the page player.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { EditorState, TextSelection } from 'prosemirror-state';
import { createBBCodeCodec } from '../src/codecs/bbcode.js';
import { assertImplements } from '../src/contracts.js';
import { parseStart, playerUrl, youtubeProvider } from '../src/embeds/youtube.js';
import { createPlugins } from '../src/plugins.js';
import { useYoutubePlayers } from '../src/render/youtube.js';
import { schema } from '../src/schema.js';

const codec = createBBCodeCodec(schema);
const id = `dQw4w9WgXcQ`;

test(`the provider satisfies the EmbedProvider contract`, () => {
	assertImplements(`EmbedProvider`, youtubeProvider);
});

test(`every common address form gives the same video`, () => {
	for (const url of [
		`https://www.youtube.com/watch?v=${id}`,
		`http://youtube.com/watch?v=${id}&feature=share`,
		`https://m.youtube.com/watch?v=${id}`,
		`https://music.youtube.com/watch?v=${id}`,
		`https://youtu.be/${id}`,
		`https://youtu.be/${id}?si=abc`,
		`https://www.youtube.com/shorts/${id}`,
		`https://www.youtube.com/live/${id}`,
		`https://www.youtube.com/embed/${id}`,
		`https://www.youtube-nocookie.com/embed/${id}`,
	]) {
		assert.equal(youtubeProvider.match(url)?.attrs.id, id, url);
	}
});

test(`a start time is read in the forms YouTube uses`, () => {
	assert.equal(parseStart(`90`), 90);
	assert.equal(parseStart(`1m30s`), 90);
	assert.equal(parseStart(`1h2m3s`), 3723);
	assert.equal(parseStart(`45s`), 45);
	assert.equal(parseStart(`nonsense`), 0);
	assert.equal(parseStart(null), 0);
	assert.equal(youtubeProvider.match(`https://youtu.be/${id}?t=1m30s`)?.attrs.start, `90`);
	assert.equal(youtubeProvider.match(`https://www.youtube.com/watch?v=${id}&start=12`)?.attrs.start, `12`);
});

test(`other addresses are not videos`, () => {
	for (const url of [
		`https://example.com/watch?v=${id}`,
		`https://www.youtube.com/`,
		`https://www.youtube.com/watch?v=short`,
		`https://www.youtube.com/@channel`,
		`https://youtu.be/`,
		`ftp://youtu.be/${id}`,
		`not an address`,
		`javascript:alert(1)`,
	]) {
		assert.equal(youtubeProvider.match(url), null, url);
	}
});

test(`toUrl writes a watch address with the start time`, () => {
	assert.equal(youtubeProvider.toUrl({ id, start: `0` }), `https://www.youtube.com/watch?v=${id}`);
	assert.equal(youtubeProvider.toUrl({ id, start: `90` }), `https://www.youtube.com/watch?v=${id}&t=90`);
});

test(`the player address uses the no-cookie host and the start time`, () => {
	assert.equal(playerUrl({ id }), `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`);
	assert.equal(
		playerUrl({ id, start: `90` }),
		`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&start=90`,
	);
});

test(`a paragraph with only a video address becomes a player and is saved as typed`, () => {
	for (const text of [`https://youtu.be/${id}?t=5`, `https://www.youtube.com/watch?v=${id}`]) {
		const doc = codec.parse(text);
		assert.equal(doc.firstChild.type.name, `embed`, text);
		assert.equal(doc.firstChild.attrs.provider, `youtube`);
		assert.equal(codec.serialize(doc), text);
	}
});

test(`a video address between two paragraphs stays between them`, () => {
	const text = `before\n\nhttps://youtu.be/${id}\n\nafter`;
	const doc = codec.parse(text);
	assert.deepEqual(
		doc.children.map((node) => node.type.name),
		[`paragraph`, `embed`, `paragraph`],
	);
	assert.equal(codec.serialize(doc), text);
});

test(`a video address inside a sentence stays a link`, () => {
	for (const text of [`look: https://youtu.be/${id}`, `https://youtu.be/${id} is good`, `a\nhttps://youtu.be/${id}`]) {
		assert.equal(codec.parse(text).firstChild.type.name, `paragraph`, text);
	}
});

test(`a video address in a quote becomes a player too`, () => {
	const doc = codec.parse(`[quote="a"]https://youtu.be/${id}[/quote]`);
	assert.equal(doc.firstChild.firstChild.type.name, `embed`);
});

test(`an old video tag is still saved as it was`, () => {
	const text = `[youtube]https://www.youtube.com/watch?v=${id}[/youtube]`;
	assert.equal(codec.serialize(codec.parse(text)), text);
});

const page = (html) => new JSDOM(`<body>${html}</body>`).window.document;
const mediaEmbed = (src) =>
	`<span data-s9e-mediaembed="youtube" style="display:inline-block"><span><iframe src="${src}" loading="lazy" style="background:url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)"></iframe></span></span>`;

test(`render: a MediaEmbed video becomes a player with no iframe and no Google picture`, () => {
	const doc = page(`<p>${mediaEmbed(`https://www.youtube-nocookie.com/embed/${id}?start=5`)}</p>`);
	assert.equal(useYoutubePlayers(doc), 1);
	const player = doc.querySelector(`bf-youtube`);
	assert.equal(player.getAttribute(`url`), `https://www.youtube.com/watch?v=${id}&t=5`);
	assert.equal(player.querySelector(`a`).href, `https://www.youtube.com/watch?v=${id}&t=5`);
	assert.equal(doc.querySelector(`iframe`), null);
	assert.ok(!doc.body.innerHTML.includes(`ytimg`));
});

test(`render: a link alone in its paragraph becomes a player and keeps its link`, () => {
	const doc = page(`<p><a class="postlink" href="https://youtu.be/${id}">https://youtu.be/${id}</a></p>`);
	assert.equal(useYoutubePlayers(doc), 1);
	assert.equal(doc.querySelector(`bf-youtube > a.postlink`).getAttribute(`href`), `https://youtu.be/${id}`);
});

test(`render: a video link inside a sentence, or a labelled link, is left alone`, () => {
	const doc = page(
		`<p>look <a href="https://youtu.be/${id}">here</a></p><p><a href="https://youtu.be/${id}">my favourite</a></p><p><a href="https://example.com">x</a></p>`,
	);
	assert.equal(useYoutubePlayers(doc), 0);
	assert.equal(doc.querySelector(`bf-youtube`), null);
});

test(`render: a link phpBB has shortened still becomes a player`, () => {
	const doc = page(
		`<p><a href="https://www.youtube.com/watch?v=${id}&amp;t=5">https://www.youtube.com/wat ... dQw4w9WgXcQ</a></p>`,
	);
	assert.equal(useYoutubePlayers(doc), 1);
});

test(`paste: a video address in an empty paragraph becomes a player with a paragraph after it`, () => {
	const { handled, view } = pasteInto(stateWith(``, 1), `https://youtu.be/${id}`);
	assert.equal(handled, true);
	assert.deepEqual(
		view.state.doc.children.map((node) => node.type.name),
		[`embed`, `paragraph`],
	);
	assert.equal(codec.serialize(view.state.doc), `https://youtu.be/${id}`);
});

test(`paste: a video address in the middle of text stays a link`, () => {
	const { view } = pasteInto(stateWith(`ab`, 2), `https://youtu.be/${id}`);
	assert.equal(view.state.doc.firstChild.type.name, `paragraph`);
	assert.match(codec.serialize(view.state.doc), /^a\[url\]https:\/\/youtu\.be\/.*\[\/url\]b$/);
});

function stateWith(text, position) {
	const state = EditorState.create({ doc: codec.parse(text) });

	return state.apply(state.tr.setSelection(TextSelection.create(state.doc, position)));
}

function pasteInto(state, text) {
	const plugin = createPlugins(schema, []).find((candidate) => candidate.props.handlePaste);
	const view = { state, dispatch: (tr) => (view.state = view.state.apply(tr)) };
	const handled = plugin.props.handlePaste(view, { clipboardData: { getData: () => text } });

	return { handled, view };
}
