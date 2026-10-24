// Posts that are already saved show smilies as little pictures, and Unicode emoji as pictures
// from a third-party server. This swaps both for the emoji character itself.
// Works on any DOM tree, so it runs in the browser and in tests.
import { createSmilieReplacer, defaultSmilies, smilieImages } from '../smilies.js';

/**
 * Swaps smilie pictures and emoji pictures for the emoji character. A picture we do not know stays.
 * @param {ParentNode} root
 * @param {{smilies?: Record<string, string>, images?: Record<string, string>}} [options]
 * @returns {number} how many pictures were replaced
 */
export function useNativeEmoji(root, options = {}) {
	const smilies = options.smilies ?? defaultSmilies;
	const images = options.images ?? smilieImages;
	let replaced = 0;

	for (const img of root.querySelectorAll(`img.smilies, img.emoji`)) {
		const emoji = emojiFor(img, smilies, images);

		if (emoji === null) {
			continue;
		}

		// A plain character. Screen readers already say the emoji's own name.
		img.replaceWith(img.ownerDocument.createTextNode(emoji));
		replaced += 1;
	}

	return replaced;
}

/**
 * Finds the emoji for one picture: its alt text for an emoji picture, else the smilie code, else the file name.
 * @param {Element} img
 * @param {Record<string, string>} smilies code to emoji
 * @param {Record<string, string>} images picture file name to emoji
 * @returns {string | null} the emoji for a picture, or null if we do not know it
 */
function emojiFor(img, smilies, images) {
	const alt = img.getAttribute(`alt`) ?? ``;

	// A Unicode emoji picture carries the character itself in its alt text.
	if (img.classList.contains(`emoji`) && alt !== ``) {
		return alt;
	}

	if (alt in smilies) {
		return smilies[alt];
	}

	const file = (img.getAttribute(`src`) ?? ``)
		.split(`/`)
		.pop()
		?.replace(/\.\w+(\?.*)?$/, ``);

	return file !== undefined && file in images ? images[file] : null;
}

const skipInside = `a, code, pre, textarea, script, style, .codebox, [contenteditable="true"]`;

/**
 * Old posts also have smilies typed as plain text, like ":-)", that the board never turned
 * into pictures. This turns them into emoji too, except inside links and code.
 *
 * @param {ParentNode} root
 * @param {Record<string, string>} [smilies]
 * @returns {number} how many text pieces were changed
 */
export function useNativeEmojiForText(root, smilies = defaultSmilies) {
	const replace = createSmilieReplacer(smilies);
	const document = root.ownerDocument ?? /** @type {Document} */ (root);
	const walker = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
	/** @type {Array<[Node, string]>} */
	const changes = [];

	for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
		if (node.parentElement?.closest(skipInside)) {
			continue;
		}

		const text = node.nodeValue ?? ``;
		const next = replace(text);

		if (next !== text) {
			changes.push([node, next]);
		}
	}

	for (const [node, next] of changes) {
		node.nodeValue = next;
	}

	return changes.length;
}
