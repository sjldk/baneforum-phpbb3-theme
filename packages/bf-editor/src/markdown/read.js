// Markdown text to editor nodes. Anything the editor cannot show is kept as raw source.
import { splitBlocks } from './blocks.js';
import { parseInline } from './inline.js';

export { PLACEHOLDER_CLOSE, PLACEHOLDER_OPEN } from './placeholders.js';

/**
 * @param {import('prosemirror-model').Schema} schema
 * @param {string} source  Markdown, with placeholders where BBCode nodes were
 * @param {import('prosemirror-model').Node[]} placeholders  Nodes to put back, by index
 * @param {(text: string) => string} replaceSmilies
 * @returns {import('prosemirror-model').Node[]} block nodes
 */
export function readMarkdown(schema, source, placeholders, replaceSmilies) {
	return splitBlocks(source).map((block, index) => {
		if (block.kind === `paragraph`) {
			// Spaces at the end of a line are not content. A line break is a line break.
			const text = block.text.replace(/[ \t]+(?=\n|$)/g, ``);

			return schema.nodes.paragraph.create(null, parseInline(schema, text, placeholders, replaceSmilies));
		}

		// A raw block remembers the line breaks in front of it, except the first block of a text.
		return schema.nodes.raw_block.create({ source: block.text, before: index === 0 ? `` : block.before });
	});
}
