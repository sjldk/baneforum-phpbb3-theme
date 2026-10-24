// Markdown text to editor nodes. Anything the editor cannot show is kept as raw source, written as BBCode.
import { splitBlocks } from './blocks.js';
import { parseInline } from './inline.js';
import { blockToBBCode } from './to-bbcode.js';

export { PLACEHOLDER_CLOSE, PLACEHOLDER_OPEN } from './placeholders.js';

const definition = /^ {0,3}\[([^\]\n]+)\]:[ \t]*<?([^\s>]+)>?(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?[ \t]*$/gm;
const reference = /\[((?:[^\][\n]|\[[^\][\n]*\])*)\]\[([^\]\n]*)\]/g;

/**
 * Markdown can name a link elsewhere: [text][id] with a line "[id]: https://address". Writes them as [text](address).
 * @param {string} source
 */
function resolveReferences(source) {
	/** @type {Map<string, string>} */
	const targets = new Map();
	const rest = source.replace(definition, (_all, label, address) => {
		targets.set(label.toLowerCase(), address);

		return ``;
	});

	if (targets.size === 0) {
		return source;
	}

	return rest
		.replace(reference, (all, text, id) => {
			const address = targets.get((id || text).toLowerCase());

			return address ? `[${text}](${address})` : all;
		})
		.replace(/\n{3,}/g, `\n\n`);
}

/**
 * Reads Markdown into block nodes. A paragraph becomes a paragraph, and every other block becomes a raw block with BBCode.
 * @param {import('prosemirror-model').Schema} schema
 * @param {string} source  Markdown, with placeholders where BBCode nodes were
 * @param {import('prosemirror-model').Node[]} placeholders  Nodes to put back, by index
 * @param {(text: string) => string} replaceSmilies
 * @returns {import('prosemirror-model').Node[]} block nodes
 */
export function readMarkdown(schema, source, placeholders, replaceSmilies) {
	return splitBlocks(resolveReferences(source)).map((block, index) => {
		if (block.kind === `paragraph`) {
			// Spaces at the end of a line are not content. A line break is a line break.
			const text = block.text.replace(/[ \t]+(?=\n|$)/g, ``);

			return schema.nodes.paragraph.create(null, parseInline(schema, text, placeholders, replaceSmilies));
		}

		// A raw block remembers the line breaks in front of it, except the first block of a text.
		return schema.nodes.raw_block.create({
			source: blockToBBCode(schema, block.text, placeholders, replaceSmilies),
			before: index === 0 ? `` : block.before,
		});
	});
}
