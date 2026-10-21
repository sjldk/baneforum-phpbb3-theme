// Reads BBCode into a tree. Only knows the shape of the markup, nothing about the editor.
//
// Node shapes:
//   { type: 'text', value }
//   { type: 'tag', name, attrs, children, source }
// `attrs` is the text between the tag name and the closing bracket, for example
// ` post_id=7 time=1` or `=https://example.com`. `source` is the whole tag with its content.
// Tags without a partner stay text, so broken markup never disappears.

/** @typedef {{type: 'text', value: string}} TextNode */
/** @typedef {{type: 'tag', name: string, attrs: string, children: BBNode[], source: string}} TagNode */
/** @typedef {TextNode | TagNode} BBNode */
/** @typedef {{node: {children: BBNode[]}, name: string | null, start: number, contentStart: number}} Open */

export const knownTags = new Set([
	`quote`,
	`b`,
	`i`,
	`u`,
	`s`,
	`url`,
	`img`,
	`attachment`,
	`youtube`,
	`media`,
	`color`,
	`size`,
	`list`,
	`*`,
	`code`,
	`flash`,
	`email`,
	`font`,
	`center`,
	`spoiler`,
]);

// The content of these is not BBCode, so it is not scanned.
const verbatimTags = new Set([`code`]);

const tokenPattern = /\[(\/?)([a-zA-Z*]+)((?:[=\s][^\]]*)?)\]/g;

/** @param {string} text @returns {BBNode[]} */
export function scanBBCode(text) {
	/** @type {{children: BBNode[]}} */
	const root = { children: [] };
	/** @type {Open[]} */
	const stack = [{ node: root, name: null, start: 0, contentStart: 0 }];
	/** @returns {Open} */
	const top = () => /** @type {Open} */ (stack[stack.length - 1]);

	/** @param {string} value */
	function pushText(value) {
		if (value === ``) {
			return;
		}

		const siblings = top().node.children;
		const last = siblings[siblings.length - 1];

		if (last && last.type === `text`) {
			last.value += value;
		} else {
			siblings.push({ type: `text`, value });
		}
	}

	let cursor = 0;
	tokenPattern.lastIndex = 0;

	for (let match = tokenPattern.exec(text); match !== null; match = tokenPattern.exec(text)) {
		const [token, closing, rawName, attrs] = match;
		const name = rawName.toLowerCase();

		if (!knownTags.has(name)) {
			continue;
		}

		pushText(text.slice(cursor, match.index));
		cursor = match.index + token.length;

		if (closing === ``) {
			if (verbatimTags.has(name)) {
				const closeTag = `[/${name}]`;
				const end = text.toLowerCase().indexOf(closeTag, cursor);

				if (end !== -1) {
					const source = text.slice(match.index, end + closeTag.length);
					top().node.children.push({
						type: `tag`,
						name,
						attrs,
						children: [{ type: `text`, value: text.slice(cursor, end) }],
						source,
					});
					cursor = end + closeTag.length;
					tokenPattern.lastIndex = cursor;
					continue;
				}
			}

			/** @type {TagNode} */
			const node = { type: `tag`, name, attrs, children: [], source: `` };
			stack.push({ node, name, start: match.index, contentStart: cursor });
		} else {
			// Find the matching open tag. Anything opened after it was never closed, so it is text.
			let depth = stack.length - 1;

			while (depth > 0 && stack[depth].name !== name) {
				depth -= 1;
			}

			if (depth === 0) {
				pushText(token);
				continue;
			}

			while (stack.length - 1 > depth) {
				const broken = /** @type {Open} */ (stack.pop());
				const parent = top().node.children;
				parent.push({ type: `text`, value: text.slice(broken.start, broken.contentStart) });
				parent.push(...broken.node.children);
			}

			const open = /** @type {Open} */ (stack.pop());
			const closed = /** @type {TagNode} */ (open.node);
			closed.source = text.slice(open.start, cursor);
			top().node.children.push(closed);
		}
	}

	pushText(text.slice(cursor));

	// Tags still open at the end have no partner. Put them back as text.
	while (stack.length > 1) {
		const broken = /** @type {Open} */ (stack.pop());
		const parent = top().node.children;
		parent.push({ type: `text`, value: text.slice(broken.start, broken.contentStart) });
		parent.push(...broken.node.children);
	}

	return mergeText(root.children);
}

/** Joins neighbouring text nodes that unwinding broken tags may have left. */
/** @param {BBNode[]} nodes @returns {BBNode[]} */
function mergeText(nodes) {
	/** @type {BBNode[]} */
	const merged = [];

	for (const node of nodes) {
		const last = merged[merged.length - 1];

		if (node.type === `text` && last?.type === `text`) {
			last.value += node.value;
		} else {
			if (node.type === `tag`) {
				node.children = mergeText(node.children);
			}

			merged.push(node);
		}
	}

	return merged;
}
