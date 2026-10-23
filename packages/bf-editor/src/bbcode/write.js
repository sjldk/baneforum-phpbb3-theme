// Editor document to BBCode text. This is the format that is saved.

/** @typedef {import('prosemirror-model').Node} PMNode */
/** @typedef {import('prosemirror-model').Mark} PMMark */

/** @type {Record<string, string>} */
const tags = { strong: `b`, em: `i`, strike: `s` };
const markOrder = [`link`, `strong`, `em`, `strike`];

/**
 * A block written as a BBCode tag, which needs no blank line around it. A video address on its
 * own is a plain paragraph to the server, so it keeps its blank lines.
 * @param {PMNode} block
 */
function isTagBlock(block) {
	return block.type.name === `blockquote` || (block.type.name === `embed` && block.attrs.source !== ``);
}

/** @param {PMNode} doc */
export function writeDocument(doc) {
	/** @type {Array<{block: PMNode, text: string}>} */
	const parts = [];
	doc.forEach((block) => {
		parts.push({ block, text: writeBlock(block) });
	});
	let out = ``;
	parts.forEach(({ block, text }, index) => {
		if (index > 0) {
			const previous = parts[index - 1].block;
			const tight = isTagBlock(block) || isTagBlock(previous);
			// A raw block remembers the blank lines it had in front of it. The server reads some
			// blocks (lists) differently depending on them, so they are kept as they were.
			const before = block.type.name === `raw_block` ? block.attrs.before : ``;
			out += before || (tight ? `\n` : `\n\n`);
		}

		out += text;
	});

	return out.replace(/^\n+|\n+$/g, ``);
}

/**
 * @param {PMNode} block
 * @returns {string}
 */
function writeBlock(block) {
	switch (block.type.name) {
		case `paragraph`:
			return writeInline(block);
		case `blockquote`:
			return `[quote${block.attrs.source}]\n${writeDocument(block)}\n[/quote]`;
		case `embed`:
			return block.attrs.source || block.attrs.url;
		case `raw_block`:
			return block.attrs.source;
		default:
			return block.textContent;
	}
}

/**
 * The text of a paragraph, or of any node that holds inline content.
 * @param {PMNode} paragraph
 */
export function writeInline(paragraph) {
	/** @type {PMMark[]} */
	let open = [];
	let out = ``;
	/** @type {PMNode[]} */
	const nodes = [];
	paragraph.forEach((node) => {
		nodes.push(node);
	});

	nodes.forEach((node, index) => {
		const marks = /** @type {PMMark[]} */ (
			markOrder.map((name) => node.marks.find((mark) => mark.type.name === name)).filter(Boolean)
		);
		let keep = 0;

		while (keep < open.length && keep < marks.length && open[keep].eq(marks[keep])) {
			keep += 1;
		}

		for (let i = open.length - 1; i >= keep; i -= 1) {
			out += closing(open[i]);
		}

		for (let i = keep; i < marks.length; i += 1) {
			out += opening(marks[i], nodes, index);
		}

		open = marks;
		out += writeInlineNode(node);
	});

	for (let i = open.length - 1; i >= 0; i -= 1) {
		out += closing(open[i]);
	}

	// An emphasis with nothing inside it disappears.
	return out.replace(/\[([bis])\]\[\/\1\]/g, ``);
}

/**
 * @param {PMMark} mark
 * @param {PMNode[]} nodes  every inline node of the paragraph
 * @param {number} index  where the mark opens
 */
function opening(mark, nodes, index) {
	if (mark.type.name !== `link`) {
		return `[${tags[mark.type.name]}]`;
	}

	// The text under the link. If it is the address itself, [url]address[/url] is enough.
	let label = ``;

	for (let i = index; i < nodes.length && mark.isInSet(nodes[i].marks); i += 1) {
		label += nodes[i].textContent;
	}

	return label === mark.attrs.href ? `[url]` : `[url=${mark.attrs.href}]`;
}

/** @param {PMMark} mark */
function closing(mark) {
	return mark.type.name === `link` ? `[/url]` : `[/${tags[mark.type.name]}]`;
}

/** @param {PMNode} node */
function writeInlineNode(node) {
	switch (node.type.name) {
		case `text`:
			return node.text;
		case `hard_break`:
			return `\n`;
		case `attachment`:
			return `[attachment=${node.attrs.index}]${node.attrs.name}[/attachment]`;
		case `image`:
			return `[img]${node.attrs.src}[/img]`;
		case `raw_inline`:
			return node.attrs.source;
		default:
			return ``;
	}
}
