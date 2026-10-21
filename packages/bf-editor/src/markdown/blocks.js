// Splits Markdown into blocks. The editor shows plain paragraphs. Every other kind of block
// (headings, lists, quotes, code, tables, raw HTML) is kept as its exact source text.
// This is a small reader, not a full Markdown parser: it only has to tell a paragraph from
// "something else", and it is checked against the board's own renderer (see scripts/render_compare.php).

/**
 * @typedef {object} Block
 * @property {'paragraph' | 'raw'} kind
 * @property {string} text  A paragraph's lines joined by newlines, or a raw block's exact source.
 * @property {string} before  The line breaks that stood in front of the block.
 */

const heading = /^ {0,3}#{1,6}(?:\s|$)/;
const bullet = /^ {0,3}[-+*]\s+\S/;
const ordered = /^ {0,3}\d{1,9}[.)]\s+\S/;
const firstOrdered = /^ {0,3}1[.)]\s+\S/;
const quote = /^ {0,3}>/;
const fence = /^ {0,3}(`{3,}|~{3,})/;
const thematic = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const indentedCode = /^(?: {4}|\t)/;
const tableRow = /^\s*\|.*\|\s*$/;
const html = /^ {0,3}<[a-zA-Z/!?]/;
const setext = /^ {0,3}(?:=+|-+)\s*$/;

/** @param {string} line */
const startsBlock = (line) =>
	heading.test(line) ||
	bullet.test(line) ||
	ordered.test(line) ||
	quote.test(line) ||
	fence.test(line) ||
	thematic.test(line) ||
	indentedCode.test(line) ||
	tableRow.test(line) ||
	html.test(line);

// A line like this can end a paragraph without a blank line before it.
/** @param {string} line */
const interrupts = (line) =>
	heading.test(line) ||
	bullet.test(line) ||
	firstOrdered.test(line) ||
	quote.test(line) ||
	fence.test(line) ||
	thematic.test(line);

/** @param {string} line */
const continuesList = (line) => bullet.test(line) || ordered.test(line) || /^ {2,}\S/.test(line) || /^\t/.test(line);

/**
 * @param {string} source
 * @returns {Block[]}
 */
export function splitBlocks(source) {
	const lines = source.split('\n');
	/** @type {Block[]} */
	const blocks = [];
	let index = 0;
	let breaks = 0;

	while (index < lines.length) {
		if (lines[index].trim() === '') {
			breaks += 1;
			index += 1;
			continue;
		}

		const first = index;
		const opening = fence.exec(lines[index]);

		if (opening) {
			// A fenced block runs to its closing fence, blank lines included.
			const marker = opening[1][0];
			const length = opening[1].length;
			index += 1;

			while (index < lines.length && !new RegExp(`^ {0,3}${marker}{${length},}\\s*$`).test(lines[index])) {
				index += 1;
			}

			index = Math.min(index + 1, lines.length);
			blocks.push(raw(lines, first, index, breaks));
			breaks = 0;
			continue;
		}

		while (index < lines.length && lines[index].trim() !== '') {
			index += 1;
		}

		const block = lines.slice(first, index);
		const pending = classify(block);

		if (pending.paragraph.length > 0) {
			blocks.push({ kind: 'paragraph', text: pending.paragraph.join('\n'), before: '\n'.repeat(breaks + 1) });
			breaks = 0;
		}

		if (pending.rawFrom !== null) {
			let end = index;
			const startsList = bullet.test(block[pending.rawFrom]) || ordered.test(block[pending.rawFrom]);
			const startsTable = tableRow.test(block[pending.rawFrom]);
			const startsQuote = quote.test(block[pending.rawFrom]);

			// A list, table or quote goes on across blank lines while the next block belongs to it.
			for (;;) {
				let look = end;

				while (look < lines.length && lines[look].trim() === '') {
					look += 1;
				}

				if (look >= lines.length) {
					break;
				}

				const next = lines[look];
				const belongs =
					(startsList && continuesList(next)) ||
					(startsTable && tableRow.test(next)) ||
					(startsQuote && quote.test(next));

				if (!belongs) {
					break;
				}

				end = look;

				while (end < lines.length && lines[end].trim() !== '') {
					end += 1;
				}
			}

			blocks.push(raw(lines, first + pending.rawFrom, end, breaks));

			// Cut out of the middle of a paragraph, the markup follows a single line break.
			if (pending.paragraph.length > 0) {
				blocks[blocks.length - 1].before = '\n';
			}

			index = end;
			breaks = 0;
		}
	}

	return blocks;
}

/**
 * @param {string[]} lines
 * @param {number} from  first line, counted from 0
 * @param {number} to  one past the last line
 * @param {number} breaks  blank lines in front of the block
 * @returns {Block}
 */
function raw(lines, from, to, breaks) {
	// Blank lines in front count as one more line break than the blank lines themselves.
	return { kind: 'raw', text: lines.slice(from, to).join('\n').replace(/\s+$/, ''), before: '\n'.repeat(breaks + 1) };
}

/**
 * Decides which lines of a blank-line free block are paragraph text and where raw markup starts.
 * @param {string[]} block
 * @returns {{paragraph: string[], rawFrom: number | null}}
 */
function classify(block) {
	if (startsBlock(block[0]) || setextAhead(block)) {
		return { paragraph: [], rawFrom: 0 };
	}

	for (let line = 1; line < block.length; line += 1) {
		if (interrupts(block[line])) {
			return { paragraph: block.slice(0, line), rawFrom: line };
		}
	}

	return { paragraph: block, rawFrom: null };
}

/**
 * "Title" followed by "---" or "===" is a heading in Markdown.
 * @param {string[]} block
 */
function setextAhead(block) {
	return block.length > 1 && block.slice(1).some((line) => setext.test(line));
}
