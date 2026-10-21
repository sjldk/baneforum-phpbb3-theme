// Inline Markdown: **bold**, *italic*, _italic_, ~~strike~~, [text](address), `code`, line breaks.
// Emphasis follows the CommonMark rules for which asterisks and underscores count (flanking, and
// the rule of three), so "2 * 3 * 4" and snake_case_name stay plain text.
// Text is kept exactly as typed: no entity or backslash processing, because the board shows it as typed.

import { PLACEHOLDER_CLOSE, PLACEHOLDER_OPEN } from './placeholders.js';

/**
 * @typedef {object} Item
 * @property {'text' | 'delim' | 'break' | 'node'} type
 * @property {string} [value]  text, or the delimiter character
 * @property {number} [count]  delimiters left
 * @property {number} [original]
 * @property {boolean} [canOpen]
 * @property {boolean} [canClose]
 * @property {boolean} [dead]
 * @property {import('prosemirror-model').Node} [node]
 * @property {Array<import('prosemirror-model').Mark>} marks
 */

const placeholderPattern = new RegExp(`^${PLACEHOLDER_OPEN}(\\d+)${PLACEHOLDER_CLOSE}`);
const linkPattern = /^\[((?:[^\][\n]|\[[^\][\n]*\])*)\]\(((?:[^\s()]|\([^\s()]*\))*)\)/;

/** @param {string} character */
const isSpace = (character) => character === `` || /\s/u.test(character);
/** @param {string} character */
const isPunctuation = (character) => character !== `` && /[\p{P}\p{S}]/u.test(character);

/**
 * @param {import('prosemirror-model').Schema} schema
 * @param {string} text
 * @param {import('prosemirror-model').Node[]} placeholders
 * @param {(text: string) => string} replaceSmilies
 * @returns {import('prosemirror-model').Node[]}
 */
export function parseInline(schema, text, placeholders, replaceSmilies) {
	return flatten(schema, tokenize(schema, text, placeholders), replaceSmilies);
}

/**
 * @param {import('prosemirror-model').Schema} schema
 * @param {string} text
 * @param {import('prosemirror-model').Node[]} placeholders
 * @returns {Item[]}
 */
function tokenize(schema, text, placeholders) {
	/** @type {Item[]} */
	const items = [];
	let buffer = ``;
	const flush = () => {
		if (buffer !== ``) {
			items.push({ type: `text`, value: buffer, marks: [] });
		}

		buffer = ``;
	};
	const previous = () => {
		if (buffer !== ``) {
			return buffer[buffer.length - 1];
		}

		const last = items[items.length - 1];

		if (!last) {
			return ``;
		}

		if (last.type === `text`) {
			return (last.value ?? ``).slice(-1);
		}

		if (last.type === `delim`) {
			return last.value ?? ``;
		}

		return last.type === `break` ? `\n` : `a`;
	};

	let position = 0;

	while (position < text.length) {
		const rest = text.slice(position);
		const character = text[position];

		const placeholder = placeholderPattern.exec(rest);

		if (placeholder) {
			flush();
			items.push({ type: `node`, node: placeholders[Number(placeholder[1])], marks: [] });
			position += placeholder[0].length;
			continue;
		}

		if (character === `\n`) {
			flush();
			items.push({ type: `break`, marks: [] });
			position += 1;
			continue;
		}

		if (character === `\``) {
			const run = /^`+/.exec(rest)?.[0] ?? `\``;
			const end = text.indexOf(run, position + run.length);

			if (end !== -1 && text[end + run.length] !== `\``) {
				flush();
				items.push({
					type: `node`,
					node: schema.nodes.raw_inline.create({ source: text.slice(position, end + run.length) }),
					marks: [],
				});
				position = end + run.length;
				continue;
			}

			buffer += run;
			position += run.length;
			continue;
		}

		if (character === `!` && rest[1] === `[`) {
			const image = linkPattern.exec(rest.slice(1));

			if (image) {
				flush();
				items.push({
					type: `node`,
					node: schema.nodes.raw_inline.create({ source: rest.slice(0, image[0].length + 1) }),
					marks: [],
				});
				position += image[0].length + 1;
				continue;
			}
		}

		if (character === `[`) {
			const link = linkPattern.exec(rest);

			if (link) {
				const address = link[2];
				flush();

				if (address === `` || /["']/.test(address)) {
					items.push({ type: `node`, node: schema.nodes.raw_inline.create({ source: link[0] }), marks: [] });
				} else {
					const mark = schema.marks.link.create({ href: address });

					for (const inner of tokenize(schema, link[1], placeholders)) {
						inner.marks = [mark, ...inner.marks];
						items.push(inner);
					}
				}

				position += link[0].length;
				continue;
			}
		}

		if (character === `*` || character === `_` || (character === `~` && rest[1] === `~`)) {
			const run = /^(\*+|_+|~~)/.exec(rest)?.[0] ?? character;
			flush();
			const before = previous();
			const after = text[position + run.length] ?? ``;
			const left = !isSpace(after) && (!isPunctuation(after) || isSpace(before) || isPunctuation(before));
			const right = !isSpace(before) && (!isPunctuation(before) || isSpace(after) || isPunctuation(after));
			const underscore = character === `_`;
			items.push({
				type: `delim`,
				value: character,
				count: run.length,
				original: run.length,
				canOpen: underscore ? left && (!right || isPunctuation(before)) : left,
				canClose: underscore ? right && (!left || isPunctuation(after)) : right,
				marks: [],
			});
			position += run.length;
			continue;
		}

		buffer += character;
		position += 1;
	}

	flush();

	return items;
}

/**
 * Pairs up the delimiters and puts the marks on what is between them.
 * @param {import('prosemirror-model').Schema} schema
 * @param {Item[]} items
 */
function matchEmphasis(schema, items) {
	for (let closer = 0; closer < items.length; closer += 1) {
		const close = items[closer];

		if (close.type !== `delim` || !close.canClose || close.dead) {
			continue;
		}

		while ((close.count ?? 0) > 0) {
			let opener = -1;

			for (let candidate = closer - 1; candidate >= 0; candidate -= 1) {
				const open = items[candidate];

				if (
					open.type !== `delim` ||
					open.dead ||
					!open.canOpen ||
					open.value !== close.value ||
					(open.count ?? 0) === 0
				) {
					continue;
				}

				if (close.value === `~` && ((open.count ?? 0) < 2 || (close.count ?? 0) < 2)) {
					continue;
				}

				// The rule of three: a delimiter that can both open and close must not make an uneven pair.
				const either = open.canClose || close.canOpen;
				const sum = (open.original ?? 0) + (close.original ?? 0);

				if (either && sum % 3 === 0 && !((open.original ?? 0) % 3 === 0 && (close.original ?? 0) % 3 === 0)) {
					continue;
				}

				opener = candidate;
				break;
			}

			if (opener === -1) {
				break;
			}

			const open = items[opener];
			const strike = close.value === `~`;
			const use = strike || ((open.count ?? 0) >= 2 && (close.count ?? 0) >= 2) ? 2 : 1;
			const type = strike ? schema.marks.strike : use === 2 ? schema.marks.strong : schema.marks.em;
			const mark = type.create();

			for (let between = opener + 1; between < closer; between += 1) {
				items[between].marks.push(mark);

				if (items[between].type === `delim`) {
					items[between].dead = true;
				}
			}

			open.count = (open.count ?? 0) - use;
			close.count = (close.count ?? 0) - use;
		}
	}
}

/**
 * @param {import('prosemirror-model').Schema} schema
 * @param {Item[]} items
 * @param {(text: string) => string} replaceSmilies
 */
function flatten(schema, items, replaceSmilies) {
	matchEmphasis(schema, items);
	/** @type {import('prosemirror-model').Node[]} */
	const nodes = [];

	for (const item of items) {
		if (item.type === `node` && item.node) {
			nodes.push(item.node);
		} else if (item.type === `break`) {
			nodes.push(schema.nodes.hard_break.create());
		} else {
			const raw = item.type === `delim` ? (item.value ?? ``).repeat(item.count ?? 0) : (item.value ?? ``);

			if (raw === ``) {
				continue;
			}

			const text = item.marks.some((mark) => mark.type === schema.marks.link) ? raw : replaceSmilies(raw);
			nodes.push(schema.text(text, item.marks));
		}
	}

	return nodes;
}
