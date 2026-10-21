// The codec for message text that mixes Markdown and BBCode, as forum posts do.
// Reading accepts both. Writing produces Markdown, and BBCode only for what Markdown cannot say
// (quotes with an author, attached files, embedded videos).
import { scanBBCode } from '../bbcode/scan.js';
import { PLACEHOLDER_CLOSE, PLACEHOLDER_OPEN, readMarkdown } from '../markdown/read.js';
import { writeDocument } from '../markdown/write.js';
import { createSmilieReplacer } from '../smilies.js';

const blockTags = new Set(['quote', 'youtube', 'media', 'list', 'code', 'flash', 'spoiler', 'center']);
/** @type {Record<string, string>} */
const emphasis = { b: '**', i: '*', s: '~~' };

/** @typedef {import('../bbcode/scan.js').BBNode} BBNode */
/** @typedef {import('../bbcode/scan.js').TagNode} TagNode */
/** @typedef {import('prosemirror-model').Node} PMNode */

/**
 * The text inside a tag: its text nodes, and the source of any tag nested in it.
 * @param {BBNode[]} nodes
 */
function textOf(nodes) {
	return nodes.map((node) => (node.type === 'text' ? node.value : node.source)).join('');
}

/**
 * @param {import('prosemirror-model').Schema} schema
 * @param {{smilies?: Record<string, string>}} [options]
 * @returns {import('../contracts.js').Codec}
 */
export function createMarkdownBBCodeCodec(schema, options = {}) {
	const replaceSmilies = createSmilieReplacer(options.smilies);

	/** @param {string} text */
	function parse(text) {
		const blocks = buildBlocks(scanBBCode(text.replace(/\r\n?/g, '\n')));

		return schema.nodes.doc.create(null, blocks.length > 0 ? blocks : [schema.nodes.paragraph.create()]);
	}

	/**
	 * @param {BBNode[]} nodes
	 * @returns {PMNode[]}
	 */
	function buildBlocks(nodes) {
		/** @type {PMNode[]} */
		const blocks = [];
		/** @type {BBNode[]} */
		let run = [];
		const flush = () => {
			if (run.length > 0) {
				blocks.push(...flowToBlocks(run));
			}

			run = [];
		};

		for (const node of nodes) {
			if (node.type === 'tag' && blockTags.has(node.name)) {
				flush();
				blocks.push(blockFromTag(node));
			} else {
				run.push(node);
			}
		}

		flush();

		return blocks;
	}

	/**
	 * @param {TagNode} tag
	 * @returns {PMNode}
	 */
	function blockFromTag(tag) {
		switch (tag.name) {
			case 'quote': {
				const inner = buildBlocks(tag.children);

				return schema.nodes.blockquote.create(
					{ author: quoteAuthor(tag.attrs), source: tag.attrs },
					inner.length > 0 ? inner : [schema.nodes.paragraph.create()],
				);
			}
			case 'youtube':
			case 'media': {
				const url = textOf(tag.children).trim();

				return schema.nodes.embed.create({
					provider: tag.name === 'youtube' ? 'youtube' : 'media',
					url,
					source: tag.source,
				});
			}
			default:
				return schema.nodes.raw_block.create({ source: tag.source });
		}
	}

	/**
	 * Turns a run of text and inline tags into paragraphs, through Markdown.
	 * @param {BBNode[]} run
	 * @returns {PMNode[]}
	 */
	function flowToBlocks(run) {
		/** @type {PMNode[]} */
		const placeholders = [];
		/** @param {PMNode} node */
		const stand = (node) => {
			placeholders.push(node);

			return `${PLACEHOLDER_OPEN}${placeholders.length - 1}${PLACEHOLDER_CLOSE}`;
		};
		let source = '';

		for (const node of run) {
			source += inlineToMarkdown(node, stand, source);
		}

		source = source.replace(/^\n+|\n+$/g, '');

		if (source.trim() === '') {
			return [];
		}

		return readMarkdown(schema, source, placeholders, replaceSmilies);
	}

	/**
	 * @param {BBNode} node
	 * @param {(node: PMNode) => string} stand  Leaves a stand-in for a node and returns its marker text.
	 * @param {string} [before]  The Markdown written so far in this run.
	 * @returns {string}
	 */
	function inlineToMarkdown(node, stand, before = '') {
		if (node.type === 'text') {
			return node.value;
		}

		const content = () => node.children.map((child) => inlineToMarkdown(child, stand)).join('');

		switch (node.name) {
			case 'b':
			case 'i':
			case 's': {
				// Markdown emphasis cannot span a blank line, BBCode can. Mark each paragraph on its own.
				return content()
					.split(/(\n\s*\n)/)
					.map((part) => {
						if (/^\n\s*\n$/.test(part)) {
							return part;
						}

						const lead = part.match(/^\s*/)?.[0] ?? '';
						const tail = part.match(/\s*$/)?.[0] ?? '';
						const core = part.slice(lead.length, part.length - tail.length);

						return core === '' ? part : `${lead}${emphasis[node.name]}${core}${emphasis[node.name]}${tail}`;
					})
					.join('');
			}
			case 'url': {
				const label = content();

				// [url]address[/url] is just the address. The server turns it into a link and shortens a long one.
				// Glued to the word before it, an address would not be found, so it gets link syntax.
				if (!node.attrs.startsWith('=') && /^[\w+.-]+:\/\/[^\s()<>]+$/.test(label.trim())) {
					const address = label.trim();

					return before === '' || /\s$/.test(before) ? address : `[${address}](${address})`;
				}

				const href = node.attrs.startsWith('=') ? node.attrs.slice(1).trim().replace(/^"|"$/g, '') : label.trim();

				return /^[\w+.-]+:\/\//.test(href) && !/[\s()<>]/.test(href)
					? `[${label}](${href})`
					: stand(schema.nodes.raw_inline.create({ source: node.source }));
			}
			case 'img':
				return stand(
					schema.nodes.image.create({
						src: textOf(node.children).trim(),
					}),
				);
			case 'attachment': {
				const index = Number(node.attrs.replace(/^=/, ''));
				const name = textOf(node.children);

				return Number.isInteger(index)
					? stand(schema.nodes.attachment.create({ index, name }))
					: stand(schema.nodes.raw_inline.create({ source: node.source }));
			}
			default:
				return stand(schema.nodes.raw_inline.create({ source: node.source }));
		}
	}

	return {
		id: 'markdown-bbcode',
		parse,
		serialize: (doc) => writeDocument(doc),
	};
}

/**
 * `="Name" post_id=1` gives Name. `=Name` gives Name. No name gives an empty string.
 * @param {string} attrs
 */
function quoteAuthor(attrs) {
	const quoted = attrs.match(/^=\s*"([^"]*)"/) ?? attrs.match(/^=\s*'([^']*)'/);

	if (quoted) {
		return quoted[1];
	}

	const bare = attrs.match(/^=\s*([^\s\]]+)/);

	return bare ? bare[1] : '';
}
