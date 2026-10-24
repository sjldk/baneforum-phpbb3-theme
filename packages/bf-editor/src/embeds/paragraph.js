// A paragraph that holds only a video address becomes a player. The address is saved as typed.

/**
 * Turns a paragraph that holds only a video address into an embed.
 * Any other paragraph is returned as it is, so an address in a sentence stays a link.
 * @param {import('prosemirror-model').Node} paragraph
 * @param {import('prosemirror-model').Schema} schema
 * @param {import('../contracts.js').EmbedProvider[]} providers
 * @returns {import('prosemirror-model').Node} an embed node, or the paragraph itself
 */
export function paragraphToEmbed(paragraph, schema, providers) {
	if (paragraph.type !== schema.nodes.paragraph || paragraph.childCount === 0) {
		return paragraph;
	}

	// Only plain text, or a link whose text is its own address (the editor writes that form).
	const only = paragraph.childCount === 1 ? paragraph.firstChild : null;
	const link = only?.marks.find((mark) => mark.type === schema.marks.link);

	if (!only?.isText || (only.marks.length > 0 && (!link || link.attrs.href !== only.text))) {
		return paragraph;
	}

	const url = (only.text ?? ``).trim();

	for (const provider of providers) {
		const found = provider.match(url);

		if (found) {
			return schema.nodes.embed.create({ provider: provider.id, url, source: `` });
		}
	}

	return paragraph;
}
