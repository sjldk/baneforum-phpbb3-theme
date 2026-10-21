// Editor document to text. Markdown for formatting, BBCode only where Markdown has no way to say it.

// While writing, marks are sentinel characters. Spaces next to a marker are moved outside
// in one pass, because "** bold **" is not bold in Markdown.
/** @type {Record<string, string>} */
const OPEN = { strong: `\uE010`, em: `\uE012`, strike: `\uE014`, link: `\uE016` };
/** @type {Record<string, string>} */
const CLOSE = { strong: `\uE011`, em: `\uE013`, strike: `\uE015`, link: `\uE017` };
const markOrder = [`link`, `strong`, `em`, `strike`];
/** @type {Record<string, string>} */
const real = { strong: `**`, em: `*`, strike: `~~` };

// A line that starts like this would turn into a heading, list or quote on the server.
const blockStart = /^(?:#{1,6}(?:\s|$)|[-+*]\s|\d+[.)]\s|>|```|~~~| {4}|\t)/;

/** @param {import('prosemirror-model').Node} doc */
export function writeDocument(doc) {
	/** @type {Array<{block: import('prosemirror-model').Node, text: string}>} */
	const parts = [];
	doc.forEach((block) => {
		parts.push({ block, text: writeBlock(block) });
	});
	let out = ``;
	parts.forEach(({ block, text }, index) => {
		if (index > 0) {
			const previous = parts[index - 1].block;
			const tight =
				[`blockquote`, `embed`].includes(block.type.name) || [`blockquote`, `embed`].includes(previous.type.name);
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
 * @param {import('prosemirror-model').Node} block
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

/** @param {import('prosemirror-model').Node} paragraph */
function writeInline(paragraph) {
	/** @type {import('prosemirror-model').Mark[]} */
	let open = [];
	let out = ``;
	paragraph.forEach((node) => {
		const marks = /** @type {import('prosemirror-model').Mark[]} */ (
			markOrder.map((name) => node.marks.find((mark) => mark.type.name === name)).filter(Boolean)
		);
		let keep = 0;

		while (keep < open.length && keep < marks.length && open[keep].eq(marks[keep])) {
			keep += 1;
		}

		for (let i = open.length - 1; i >= keep; i -= 1) {
			out += CLOSE[open[i].type.name];
		}

		for (let i = keep; i < marks.length; i += 1) {
			out += OPEN[marks[i].type.name];

			if (marks[i].type.name === `link`) {
				out += `\uE018${marks[i].attrs.href}\uE019`;
			}
		}

		open = marks;
		out += writeInlineNode(node);
	});

	for (let i = open.length - 1; i >= 0; i -= 1) {
		out += CLOSE[open[i].type.name];
	}

	return finishInline(out);
}

/** @param {import('prosemirror-model').Node} node */
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

/** @param {string} text */
function finishInline(text) {
	let out = text;

	// Move spaces out of the markers: "** a **" becomes " **a** ".
	for (const name of Object.keys(OPEN)) {
		out = out.replace(
			new RegExp(`${OPEN[name]}(\\uE018[^\\uE019]*\\uE019)?(\\s+)`, `g`),
			(_all, /** @type {string} */ target = ``, /** @type {string} */ space) => `${space}${OPEN[name]}${target}`,
		);
		out = out.replace(
			new RegExp(`(\\s+)${CLOSE[name]}`, `g`),
			(_all, /** @type {string} */ space) => `${CLOSE[name]}${space}`,
		);
		// An emphasis with nothing inside it disappears.
		out = out.replace(new RegExp(`${OPEN[name]}(\\uE018[^\\uE019]*\\uE019)?${CLOSE[name]}`, `g`), ``);
	}

	out = out.replace(
		/\uE016\uE018([^\uE019]*)\uE019([\s\S]*?)\uE017/g,
		(_all, /** @type {string} */ href, /** @type {string} */ label) =>
			`[${label}](${href.replace(/\)/g, `%29`).replace(/ /g, `%20`)})`,
	);

	for (const name of Object.keys(real)) {
		out = out.split(OPEN[name]).join(real[name]).split(CLOSE[name]).join(real[name]);
	}

	// Keep a line from being read as a block start. Indented code cannot interrupt a paragraph,
	// so the indent only matters on the first line.
	return out
		.split(`\n`)
		.map((line, index) =>
			blockStart.test(line) && (index === 0 || !/^(?: {4}|\t)/.test(line)) ? `\u200B${line}` : line,
		)
		.join(`\n`);
}
