// The codec for message text. The saved format is BBCode.
// Reading BBCode is exact: a character is only markup if BBCode says so.
import { Mark } from 'prosemirror-model';
import { TableMap } from 'prosemirror-tables';
import { scanBBCode } from '../bbcode/scan.js';
import { writeDocument } from '../bbcode/write.js';
import { paragraphToEmbed } from '../embeds/paragraph.js';
import { youtubeProvider } from '../embeds/youtube.js';
import { createSmilieReplacer } from '../smilies.js';

const blockTags = new Set([`quote`, `youtube`, `media`, `list`, `table`, `code`, `flash`, `spoiler`, `center`]);

/** @typedef {import('../bbcode/scan.js').BBNode} BBNode */
/** @typedef {import('../bbcode/scan.js').TagNode} TagNode */
/** @typedef {import('prosemirror-model').Node} PMNode */

/**
 * The text inside a tag: its text nodes, and the source of any tag nested in it.
 * @param {BBNode[]} nodes
 */
function textOf(nodes) {
	return nodes.map((node) => (node.type === `text` ? node.value : node.source)).join(``);
}

/**
 * Makes the codec that reads BBCode into an editor document and writes it back.
 * @param {import('prosemirror-model').Schema} schema
 * @param {{smilies?: Record<string, string>, embeds?: import('../contracts.js').EmbedProvider[]}} [options]
 * @returns {import('../contracts.js').Codec}
 */
export function createBBCodeCodec(schema, options = {}) {
	const replaceSmilies = createSmilieReplacer(options.smilies);
	const embeds = options.embeds ?? [youtubeProvider];

	/** @param {string} text */
	function parse(text) {
		const blocks = buildBlocks(scanBBCode(text.replace(/\r\n?/g, `\n`)));

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
				blocks.push(...flowToBlocks(run).map((block) => paragraphToEmbed(block, schema, embeds)));
			}

			run = [];
		};

		for (const node of nodes) {
			if (node.type === `tag` && blockTags.has(node.name)) {
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
			case `quote`: {
				const inner = buildBlocks(tag.children);

				return schema.nodes.blockquote.create(
					{ author: quoteAuthor(tag.attrs), source: tag.attrs },
					inner.length > 0 ? inner : [schema.nodes.paragraph.create()],
				);
			}
			case `youtube`:
			case `media`: {
				const url = textOf(tag.children).trim();

				return schema.nodes.embed.create({
					provider: tag.name === `youtube` ? `youtube` : `media`,
					url,
					source: tag.source,
				});
			}
			case `list`:
				return listFromTag(tag) ?? schema.nodes.raw_block.create({ source: tag.source });
			case `table`:
				return tableFromTag(tag) ?? schema.nodes.raw_block.create({ source: tag.source });
			default:
				return schema.nodes.raw_block.create({ source: tag.source });
		}
	}

	/** Tags that make a block. An item of a list or a cell of a table cannot hold one. */
	const holdsBlock = (/** @type {BBNode} */ node) => node.type === `tag` && blockTags.has(node.name);

	/**
	 * Inline BBCode as the content of one paragraph or cell: a line break in the text is a hard break.
	 * @param {BBNode[]} run
	 * @returns {PMNode[]}
	 */
	function inlineContent(run) {
		/** @type {Array<{text: string, marks: readonly Mark[]} | {node: PMNode}>} */
		const items = [];
		collect(run, [], items);
		const first = items[0];
		const last = items[items.length - 1];

		if (first && `text` in first) {
			first.text = first.text.replace(/^\s+/, ``);
		}

		if (last && `text` in last) {
			last.text = last.text.replace(/\s+$/, ``);
		}

		/** @type {PMNode[]} */
		const out = [];

		for (const item of items) {
			if (`node` in item) {
				out.push(item.node);
				continue;
			}

			item.text
				.replace(/[ \t]+(?=\n)/g, ``)
				.split(`\n`)
				.forEach((line, index) => {
					if (index > 0) {
						out.push(schema.nodes.hard_break.create());
					}

					if (line !== ``) {
						const linked = item.marks.some((mark) => mark.type === schema.marks.link);
						out.push(schema.text(linked ? line : replaceSmilies(line), item.marks));
					}
				});
		}

		return out;
	}

	/**
	 * [list] with [*] items. null when the editor cannot show it exactly (an item with a quote in it, an odd marker): then it stays a raw block.
	 * @param {TagNode} tag
	 * @returns {PMNode | null}
	 */
	function listFromTag(tag) {
		const marker = tag.attrs === `` ? null : (tag.attrs.match(/^=(1|a|A|i|I)$/)?.[1] ?? undefined);

		if (marker === undefined) {
			return null;
		}

		/** @type {BBNode[][]} */
		const items = [];
		/** @type {BBNode[] | null} */
		let current = null;

		for (const node of tag.children) {
			if (node.type !== `text`) {
				if (current === null) {
					return null;
				}

				current.push(node);
				continue;
			}

			const parts = node.value.split(`[*]`);

			if (current === null && parts[0].trim() !== ``) {
				return null;
			}

			current?.push({ type: `text`, value: parts[0] });

			for (const part of parts.slice(1)) {
				current = [{ type: `text`, value: part }];
				items.push(current);
			}
		}

		/** @type {PMNode[]} */
		const nodes = [];

		for (const item of items) {
			const node = itemFromNodes(item);

			if (!node) {
				return null;
			}

			nodes.push(node);
		}

		if (nodes.length === 0) {
			return null;
		}

		return marker ? schema.nodes.ordered_list.create({ marker }, nodes) : schema.nodes.bullet_list.create(null, nodes);
	}

	/**
	 * @param {BBNode[]} nodes the content of one [*]
	 * @returns {PMNode | null}
	 */
	function itemFromNodes(nodes) {
		const at = nodes.findIndex((node) => node.type === `tag` && node.name === `list`);
		const inline = at === -1 ? nodes : nodes.slice(0, at);
		/** @type {PMNode[]} */
		const nested = [];

		if (inline.some(holdsBlock)) {
			return null;
		}

		for (const node of at === -1 ? [] : nodes.slice(at)) {
			if (node.type === `text`) {
				if (node.value.trim() !== ``) {
					return null;
				}
			} else if (node.name === `list`) {
				const list = listFromTag(node);

				if (!list) {
					return null;
				}

				nested.push(list);
			} else {
				return null;
			}
		}

		return schema.nodes.list_item.create(null, [schema.nodes.paragraph.create(null, inlineContent(inline)), ...nested]);
	}

	/**
	 * [table] with [tr] rows of [th] and [td] cells ([thead] and [tbody] are only wrappers). null when the editor cannot show it exactly.
	 * @param {TagNode} tag
	 * @returns {PMNode | null}
	 */
	function tableFromTag(tag) {
		/** @type {PMNode[]} */
		const rows = [];

		/** @param {BBNode[]} nodes @returns {boolean} */
		const readRows = (nodes) => {
			for (const node of nodes) {
				if (node.type === `text`) {
					if (node.value.trim() !== ``) {
						return false;
					}
				} else if (node.name === `thead` || node.name === `tbody`) {
					if (!readRows(node.children)) {
						return false;
					}
				} else if (node.name === `tr`) {
					const row = rowFromTag(node);

					if (!row) {
						return false;
					}

					rows.push(row);
				} else {
					return false;
				}
			}

			return true;
		};

		if (!readRows(tag.children) || rows.length === 0) {
			return null;
		}

		const table = schema.nodes.table.create(null, rows);

		// Rows of different widths (a cell that spans, but not as many cells as it claims) are not a table the editor can keep as it is.
		return TableMap.get(table).problems ? null : table;
	}

	/** @param {TagNode} tr @returns {PMNode | null} */
	function rowFromTag(tr) {
		/** @type {PMNode[]} */
		const cells = [];

		for (const node of tr.children) {
			if (node.type === `text`) {
				if (node.value.trim() !== ``) {
					return null;
				}
			} else if (node.name === `td` || node.name === `th`) {
				if (node.children.some(holdsBlock)) {
					return null;
				}

				const attrs = cellAttributes(node.attrs);

				if (!attrs) {
					return null;
				}

				cells.push(
					(node.name === `th` ? schema.nodes.table_header : schema.nodes.table_cell).create(
						attrs,
						inlineContent(node.children),
					),
				);
			} else {
				return null;
			}
		}

		return cells.length > 0 ? schema.nodes.table_row.create(null, cells) : null;
	}

	/**
	 * `align=center colspan=2` as the attributes of a cell. null for anything else.
	 * @param {string} text
	 * @returns {{align: string | null, colspan: number, rowspan: number} | null}
	 */
	function cellAttributes(text) {
		const attrs = { align: /** @type {string | null} */ (null), colspan: 1, rowspan: 1 };
		const rest = text.trim().replace(/(\w+)=(\w+)/g, (_all, name, value) => {
			if (name === `align` && /^(left|center|right|justify)$/.test(value)) {
				attrs.align = value;
			} else if (name === `colspan` && /^[1-9]\d?$/.test(value)) {
				attrs.colspan = Number(value);
			} else if (name === `rowspan` && /^[1-9]\d?$/.test(value)) {
				attrs.rowspan = Number(value);
			} else {
				return `?`;
			}

			return ``;
		});

		return rest.trim() === `` ? attrs : null;
	}

	/**
	 * Turns a run of text and inline tags into paragraphs. A blank line starts a paragraph, a single line break is a line break.
	 * @param {BBNode[]} run
	 * @returns {PMNode[]}
	 */
	function flowToBlocks(run) {
		/** @type {Array<{text: string, marks: readonly Mark[]} | {node: PMNode}>} */
		const items = [];
		collect(run, [], items);

		// No line breaks around the run, no spaces before a line break or at the end.
		const first = items[0];
		const last = items[items.length - 1];

		if (first && `text` in first) {
			first.text = first.text.replace(/^\s*\n/, ``);
		}

		if (last && `text` in last) {
			last.text = last.text.replace(/\s+$/, ``);
		}

		/** @type {PMNode[][]} */
		const paragraphs = [[]];
		const current = () => /** @type {PMNode[]} */ (paragraphs[paragraphs.length - 1]);

		for (const item of items) {
			if (`node` in item) {
				current().push(item.node);
				continue;
			}

			item.text
				.replace(/[ \t]+(?=\n)/g, ``)
				.split(/\n[ \t]*(?:\n[ \t]*)+/)
				.forEach((segment, index) => {
					if (index > 0) {
						paragraphs.push([]);
					}

					segment.split(`\n`).forEach((line, lineIndex) => {
						if (lineIndex > 0) {
							current().push(schema.nodes.hard_break.create());
						}

						if (line !== ``) {
							const linked = item.marks.some((mark) => mark.type === schema.marks.link);
							current().push(schema.text(linked ? line : replaceSmilies(line), item.marks));
						}
					});
				});
		}

		return paragraphs
			.filter((nodes) => nodes.some((node) => !node.isText || (node.text ?? ``).trim() !== ``))
			.map((nodes) => schema.nodes.paragraph.create(null, nodes));
	}

	/**
	 * The text and the nodes of inline BBCode, with the marks that apply to them.
	 * @param {BBNode[]} nodes
	 * @param {readonly Mark[]} marks
	 * @param {Array<{text: string, marks: readonly Mark[]} | {node: PMNode}>} items
	 */
	function collect(nodes, marks, items) {
		for (const node of nodes) {
			if (node.type === `text`) {
				items.push({ text: node.value, marks });
				continue;
			}

			const markTypes = /** @type {Record<string, import('prosemirror-model').MarkType>} */ ({
				b: schema.marks.strong,
				i: schema.marks.em,
				s: schema.marks.strike,
			});

			if (markTypes[node.name]) {
				collect(node.children, Mark.setFrom([...marks, markTypes[node.name].create()]), items);
				continue;
			}

			switch (node.name) {
				case `url`: {
					const label = textOf(node.children).trim();
					const href = node.attrs.startsWith(`=`) ? node.attrs.slice(1).trim().replace(/^"|"$/g, ``) : label;

					if (/^[\w+.-]+:\/\/[^\s<>"']+$/.test(href)) {
						// [url]address[/url]: the text is the address, without the spaces that may be around it.
						const content = node.attrs.startsWith(`=`)
							? node.children
							: [{ type: /** @type {const} */ (`text`), value: label }];
						collect(content, Mark.setFrom([...marks, schema.marks.link.create({ href })]), items);
					} else {
						items.push({ node: schema.nodes.raw_inline.create({ source: node.source }) });
					}

					break;
				}
				case `img`:
					items.push({ node: schema.nodes.image.create({ src: textOf(node.children).trim() }) });
					break;
				case `attachment`: {
					const index = Number(node.attrs.replace(/^=/, ``));
					items.push({
						node: Number.isInteger(index)
							? schema.nodes.attachment.create({ index, name: textOf(node.children) })
							: schema.nodes.raw_inline.create({ source: node.source }),
					});
					break;
				}
				default:
					items.push({ node: schema.nodes.raw_inline.create({ source: node.source }) });
			}
		}
	}

	return {
		id: `bbcode`,
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

	return bare ? bare[1] : ``;
}
