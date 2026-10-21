// The actions the toolbar and the keyboard can run. Each one is a Command (see contracts.js):
// a name, a label, a function that changes the document, and an optional "is this on" check.
// A host adds its own by passing more of them. Nothing here knows about the toolbar.
import { lift, toggleMark, wrapIn } from 'prosemirror-commands';

/** @param {import('prosemirror-state').EditorState} state @param {import('prosemirror-model').MarkType} type */
function markIsOn(state, type) {
	const { from, $from, to, empty } = state.selection;

	if (empty) {
		return Boolean(type.isInSet(state.storedMarks || $from.marks()));
	}

	return state.doc.rangeHasMark(from, to, type);
}

/** @param {import('prosemirror-state').EditorState} state @param {import('prosemirror-model').NodeType} type */
function insideNode(state, type) {
	const { $from } = state.selection;

	for (let depth = $from.depth; depth > 0; depth -= 1) {
		if ($from.node(depth).type === type) {
			return true;
		}
	}

	return false;
}

/**
 * @param {import('prosemirror-model').Schema} schema
 * @returns {Array<import('./contracts.js').Command & {shortcut?: string, toggle: boolean}>}
 */
export function createBasicCommands(schema) {
	const { strong, em, strike } = schema.marks;
	/**
	 * @param {string} id
	 * @param {string} label
	 * @param {import('prosemirror-model').MarkType} type
	 * @param {string} shortcut
	 */
	const markCommand = (id, label, type, shortcut) => ({
		id,
		label,
		shortcut,
		toggle: true,
		run: toggleMark(type),
		/** @param {import('prosemirror-state').EditorState} state */
		isActive: (state) => markIsOn(state, type),
	});

	return [
		markCommand('bold', 'Bold', strong, 'Mod-b'),
		markCommand('italic', 'Italic', em, 'Mod-i'),
		markCommand('strike', 'Strikethrough', strike, 'Mod-Shift-x'),
		{
			id: 'normal',
			label: 'Normal text',
			shortcut: 'Mod-Shift-0',
			toggle: false,
			run(state, dispatch) {
				const { from, to, empty } = state.selection;
				const marks = Object.values(schema.marks);

				if (dispatch) {
					const tr = state.tr;

					if (empty) {
						tr.setStoredMarks([]);
					} else {
						for (const mark of marks) {
							tr.removeMark(from, to, mark);
						}
					}

					dispatch(tr);
				}

				return true;
			},
		},
		{
			id: 'quote',
			label: 'Quote',
			shortcut: 'Mod-Shift-q',
			toggle: true,
			run(state, dispatch, view) {
				return insideNode(state, schema.nodes.blockquote)
					? lift(state, dispatch, view)
					: wrapIn(schema.nodes.blockquote)(state, dispatch, view);
			},
			isActive: (state) => insideNode(state, schema.nodes.blockquote),
		},
	];
}
