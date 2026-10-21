// The link action. Changing a link is separate from asking for one: `setLink` and `removeLink`
// only edit the document, and the command asks a function it is given (the dialog, or a fake).
import { defaultLinkPolicy } from './link-policy.js';

/**
 * The range of the link the cursor is in, or null.
 * @param {import('prosemirror-state').EditorState} state
 * @param {import('prosemirror-model').MarkType} type
 */
function linkRange(state, type) {
	const { $from } = state.selection;
	const mark = $from.marks().find((candidate) => candidate.type === type);

	if (!mark) {
		return null;
	}

	const parent = $from.parent;
	const base = $from.start();
	let from = $from.parentOffset;
	let to = from;

	while (from > 0 && mark.isInSet(parent.child(parent.childBefore(from).index).marks)) {
		from = parent.childBefore(from).offset;
	}

	while (to < parent.content.size && mark.isInSet(parent.child(parent.childAfter(to).index).marks)) {
		const after = parent.childAfter(to);
		to = after.offset + (after.node?.nodeSize ?? 0);
	}

	return { from: base + from, to: base + to, mark };
}

/**
 * The address of the link at the selection, or ''.
 * @param {import('prosemirror-state').EditorState} state
 * @param {import('prosemirror-model').Schema} schema
 */
export function currentLink(state, schema) {
	return linkRange(state, schema.marks.link)?.mark.attrs.href ?? ``;
}

/**
 * Puts a link on the selection. With nothing selected it changes the link the cursor is in,
 * or writes the address as the link text.
 * @param {import('prosemirror-model').Schema} schema
 * @param {string} href
 * @returns {import('prosemirror-state').Command}
 */
export function setLink(schema, href) {
	return (state, dispatch) => {
		const type = schema.marks.link;
		const mark = type.create({ href });
		const { from, to, empty } = state.selection;

		if (dispatch) {
			const tr = state.tr;

			if (!empty) {
				tr.removeMark(from, to, type).addMark(from, to, mark);
			} else {
				const range = linkRange(state, type);

				if (range) {
					tr.removeMark(range.from, range.to, type).addMark(range.from, range.to, mark);
				} else {
					tr.insertText(href, from).addMark(from, from + href.length, mark);
				}
			}

			dispatch(tr);
		}

		return true;
	};
}

/**
 * @param {import('prosemirror-model').Schema} schema
 * @returns {import('prosemirror-state').Command}
 */
export function removeLink(schema) {
	return (state, dispatch) => {
		const type = schema.marks.link;
		const range = state.selection.empty
			? linkRange(state, type)
			: { from: state.selection.from, to: state.selection.to };

		if (!range) {
			return false;
		}

		if (dispatch) {
			dispatch(state.tr.removeMark(range.from, range.to, type));
		}

		return true;
	};
}

/**
 * The toolbar and keyboard action. Without `dispatch` it only says whether it can run.
 * @param {import('prosemirror-model').Schema} schema
 * @param {{ask: (current: string) => Promise<{href: string} | {remove: true} | null>, policy?: import('./contracts.js').LinkPolicy}} options
 * @returns {import('./contracts.js').Command & {shortcut: string, toggle: boolean}}
 */
export function createLinkCommand(schema, { ask, policy = defaultLinkPolicy }) {
	return {
		id: `link`,
		label: `Link`,
		shortcut: `Mod-k`,
		toggle: true,
		run(state, dispatch, view) {
			if (!dispatch || !view) {
				return true;
			}

			ask(currentLink(state, schema)).then((answer) => {
				if (!answer) {
					return;
				}

				if (`remove` in answer) {
					removeLink(schema)(view.state, view.dispatch);

					return;
				}

				const href = policy.normalize(answer.href);

				if (href) {
					setLink(schema, href)(view.state, view.dispatch);
				}
			});

			return true;
		},
		isActive: (state) => currentLink(state, schema) !== ``,
	};
}
