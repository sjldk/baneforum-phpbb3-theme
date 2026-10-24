// Markdown blocks the editor cannot show (headings, lists, quotes, code, tables), written as BBCode.
// A post that was written in Markdown goes through this when it is opened, so it is saved as BBCode.
import { writeInline } from '../bbcode/write.js';
import { parseInline } from './inline.js';
import { PLACEHOLDER_CLOSE, PLACEHOLDER_OPEN } from './placeholders.js';

// Heading level to text size in percent. phpBB allows 50 to 200 by default. Level 4 and up are bold only.
const headingSizes = [150, 130, 115];

const heading = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const item = /^([ \t]*)([-+*]|\d{1,9}[.)])[ \t]+(.*)$/;
const quote = /^ {0,3}>[ ]?(.*)$/;
const fence = /^ {0,3}(`{3,}|~{3,})/;
const thematic = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const indentedCode = /^(?: {4}|\t)(.*)$/;
const tableRow = /^\s*\|.*\|\s*$/;
const html = /^ {0,3}<[a-zA-Z/!?]/;
const setext = /^ {0,3}(=+|-+)\s*$/;
const marker = new RegExp(`${PLACEHOLDER_OPEN}(\\d+)${PLACEHOLDER_CLOSE}`, `g`);

/** @param {string} line @returns {number} */
const indentOf = (line) => (line.match(/^[ \t]*/)?.[0] ?? ``).replace(/\t/g, `    `).length;

/**
 * @param {import('prosemirror-model').Schema} schema
 * @param {string} source  a block of Markdown, as the block splitter found it
 * @param {import('prosemirror-model').Node[]} placeholders  nodes that BBCode tags in the text stand for
 * @param {(text: string) => string} replaceSmilies
 * @returns {string} BBCode
 */
export function blockToBBCode(schema, source, placeholders, replaceSmilies) {
	/** @param {string} text */
	const inline = (text) =>
		writeInline(schema.nodes.paragraph.create(null, parseInline(schema, text, placeholders, replaceSmilies)));
	// Text that is not read as Markdown (code) gets its BBCode tags back, one by one.
	/** @param {string} text */
	const verbatim = (text) =>
		text.replace(marker, (_all, index) =>
			writeInline(schema.nodes.paragraph.create(null, [placeholders[Number(index)]])),
		);
	const lines = source.split(`\n`);
	/** @type {string[]} */
	const out = [];
	/** @type {string[]} */
	let text = [];
	const flushText = () => {
		if (text.length > 0) {
			out.push(inline(text.join(`\n`)));
		}

		text = [];
	};
	let index = 0;

	while (index < lines.length) {
		const line = lines[index];
		const opening = fence.exec(line);

		if (html.test(line)) {
			flushText();
			out.push(verbatim(lines.slice(index).join(`\n`)));
			break;
		}

		if (opening) {
			flushText();
			const closing = new RegExp(`^ {0,3}${opening[1][0]}{${opening[1].length},}\\s*$`);
			const code = [];
			index += 1;

			while (index < lines.length && !closing.test(lines[index])) {
				code.push(lines[index]);
				index += 1;
			}

			index += 1;
			out.push(`[code]\n${verbatim(code.join(`\n`))}\n[/code]`);
			continue;
		}

		const atx = heading.exec(line);
		const underline = index + 1 < lines.length ? setext.exec(lines[index + 1]) : null;

		if (atx || (underline && text.length === 0 && line.trim() !== `` && !item.test(line) && !quote.test(line))) {
			flushText();
			const level = atx ? atx[1].length : underline && underline[1][0] === `=` ? 1 : 2;
			const title = inline(atx ? (atx[2] ?? ``) : line.trim());
			const size = headingSizes[level - 1];
			out.push(size ? `[size=${size}][b]${title}[/b][/size]` : `[b]${title}[/b]`);
			index += atx ? 1 : 2;
			continue;
		}

		if (thematic.test(line)) {
			flushText();
			out.push(`---`);
			index += 1;
			continue;
		}

		if (quote.test(line)) {
			flushText();
			/** @type {string[]} */
			const inner = [];

			while (index < lines.length && quote.test(lines[index])) {
				inner.push(/** @type {RegExpExecArray} */ (quote.exec(lines[index]))[1]);
				index += 1;
			}

			out.push(`[quote]\n${blockToBBCode(schema, inner.join(`\n`), placeholders, replaceSmilies)}\n[/quote]`);
			continue;
		}

		if (item.test(line)) {
			flushText();
			/** @type {Array<{indent: number, ordered: boolean, text: string}>} */
			const items = [];

			while (index < lines.length) {
				const found = item.exec(lines[index]);

				if (found) {
					items.push({ indent: indentOf(found[1]), ordered: /\d/.test(found[2]), text: found[3] });
				} else if (lines[index].trim() !== `` && items.length > 0 && indentOf(lines[index]) > 0) {
					/** @type {{text: string}} */ (items[items.length - 1]).text += `\n${lines[index].trim()}`;
				} else if (lines[index].trim() !== ``) {
					break;
				}

				index += 1;
			}

			out.push(listToBBCode(items, inline));
			continue;
		}

		if (tableRow.test(line)) {
			flushText();
			const rows = [];

			while (index < lines.length && tableRow.test(lines[index])) {
				rows.push(lines[index]);
				index += 1;
			}

			out.push(`[code]\n${verbatim(rows.join(`\n`))}\n[/code]`);
			continue;
		}

		if (indentedCode.test(line) && text.length === 0) {
			const code = [];

			while (index < lines.length && (indentedCode.test(lines[index]) || lines[index].trim() === ``)) {
				code.push(lines[index].replace(/^(?: {4}|\t)/, ``));
				index += 1;
			}

			out.push(`[code]\n${verbatim(code.join(`\n`).replace(/\s+$/, ``))}\n[/code]`);
			continue;
		}

		text.push(line);
		index += 1;
	}

	flushText();

	return out.join(`\n`);
}

/**
 * @param {Array<{indent: number, ordered: boolean, text: string}>} items
 * @param {(text: string) => string} inline
 */
function listToBBCode(items, inline) {
	/** @type {string[]} */
	const out = [];
	/** @type {Array<{indent: number, ordered: boolean}>} */
	const open = [];
	const top = () => open[open.length - 1];

	for (const entry of items) {
		while (open.length > 0 && entry.indent < /** @type {{indent: number}} */ (top()).indent) {
			open.pop();
			out.push(`[/list]`);
		}

		// A different kind of marker at the same level (bullets, then numbers) is a new list.
		if (
			open.length > 0 &&
			entry.indent === /** @type {{indent: number}} */ (top()).indent &&
			entry.ordered !== /** @type {{ordered: boolean}} */ (top()).ordered
		) {
			open.pop();
			out.push(`[/list]`);
		}

		if (open.length === 0 || entry.indent > /** @type {{indent: number}} */ (top()).indent) {
			open.push({ indent: entry.indent, ordered: entry.ordered });
			out.push(entry.ordered ? `[list=1]` : `[list]`);
		}

		out.push(`[*]${inline(entry.text)}`);
	}

	while (open.pop() !== undefined) {
		out.push(`[/list]`);
	}

	return out.join(`\n`);
}
