import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { useNativeEmoji } from '../src/render/native-emoji.js';

const page = (html) => new JSDOM(`<body>${html}</body>`).window.document;

test('a smilie picture becomes its emoji as plain text', () => {
	const doc = page(
		'<p>hi <img class="smilies" src="./images/smilies/icon_e_smile.gif" alt=":)" title="Smile"> there</p>',
	);
	assert.equal(useNativeEmoji(doc), 1);
	assert.equal(doc.querySelector('p').textContent, 'hi 🙂 there');
	assert.equal(doc.querySelector('img'), null);
	assert.equal(doc.querySelector('span'), null);
});

test('an emoji picture from the CDN becomes the character in its alt text', () => {
	const doc = page(
		'<img alt="😀" class="emoji smilies" draggable="false" src="//cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f600.svg">',
	);
	useNativeEmoji(doc);
	assert.equal(doc.body.textContent, '😀');
	assert.equal(doc.querySelector('img'), null);
});

test('the Baneforum codes without a default entry are found by file name', () => {
	const doc = page('<img class="smilies" src="./images/smilies/icon_redface.gif" alt=":oops:" title="Embarrassed">');
	useNativeEmoji(doc, { smilies: {} });
	assert.equal(doc.body.textContent, '😳');
});

test('a picture we do not know is left alone', () => {
	const doc = page('<img class="smilies" src="./images/smilies/icon_unknown.gif" alt=":zzz:">');
	assert.equal(useNativeEmoji(doc), 0);
	assert.ok(doc.querySelector('img'));
});

test('ordinary images are not touched', () => {
	const doc = page('<img src="photo.jpg" alt="a train"><img class="postimage" src="x.png" alt=":)">');
	assert.equal(useNativeEmoji(doc), 0);
	assert.equal(doc.querySelectorAll('img').length, 2);
});

import { useNativeEmojiForText } from '../src/render/native-emoji.js';

test('smilies typed as text become emoji', () => {
	const doc = page('<p>great :-) and ;) and :lol: 8-)</p>');
	useNativeEmojiForText(doc.body);
	assert.equal(doc.body.textContent, 'great 🙂 and 😉 and 😂 😎');
});

test('text smilies in links, code and addresses are left alone', () => {
	const doc = page('<a href="x">a :) link</a><code>:)</code><pre>:D</pre><p>http://x.test/a:D and a:b</p>');
	assert.equal(useNativeEmojiForText(doc.body), 0);
});

test('a smilie glued to a word is not a smilie', () => {
	const doc = page('<p>ratio 3:D and word:) end</p>');
	useNativeEmojiForText(doc.body);
	assert.equal(doc.body.textContent, 'ratio 3:D and word:) end');
});
