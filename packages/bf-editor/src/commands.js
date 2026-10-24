// The actions the toolbar and the keyboard can run. Each one is a Command (see contracts.js):
// a name, a label, a function that changes the document, and an optional "is this on" check.
// A host adds its own by passing more of them. Nothing here knows about the toolbar.
import { lift, toggleMark, wrapIn } from 'prosemirror-commands';
import { Fragment } from 'prosemirror-model';
import { liftListItem, wrapInList } from 'prosemirror-schema-list';
import { Selection } from 'prosemirror-state';

/**
 * Whether a mark is on at the cursor, or on any part of the selection. With a bare cursor the marks that the
 * writer chose but has not typed yet count too, so the button shows the right state.
 * @param {import('prosemirror-state').EditorState} state
 * @param {import('prosemirror-model').MarkType} type
 */
function markIsOn(state, type) {
	const { from, $from, to, empty } = state.selection;

	if (empty) {
		return Boolean(type.isInSet(state.storedMarks || $from.marks()));
	}

	return state.doc.rangeHasMark(from, to, type);
}

/**
 * Whether the cursor is inside a node of this type, at any depth.
 * @param {import('prosemirror-state').EditorState} state
 * @param {import('prosemirror-model').NodeType} type
 */
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
 * The list that the cursor is in, the innermost one.
 * @param {import('prosemirror-state').EditorState} state
 * @returns {{node: import('prosemirror-model').Node, pos: number} | null}
 */
function nearestList(state) {
	const { $from } = state.selection;

	for (let depth = $from.depth; depth > 0; depth -= 1) {
		const node = $from.node(depth);

		if (node.type.name === `bullet_list` || node.type.name === `ordered_list`) {
			return { node, pos: $from.before(depth) };
		}
	}

	return null;
}

/**
 * Backspace at the very start of a list item. The standard "join backward" would wrap the item into the item above
 * it as a deeper list, so the list loses its flow. This does what a writer expects instead:
 *   - the first item of a list leaves the list (the bullet is cleared, and the text stays)
 *   - any other item joins the line above it: its text goes to the end of that line, and an empty item just
 *     disappears. A list nested in the item stays, under the item above.
 * Backspace anywhere else is left to the browser.
 * @param {import('prosemirror-model').Schema} schema
 * @returns {import('prosemirror-state').Command}
 */
export function backspaceInList(schema) {
	return (state, dispatch) => {
		const { $from, empty } = state.selection;

		if (!empty || $from.parentOffset !== 0 || $from.depth < 3) {
			return false;
		}

		const item = $from.node(-1);
		const list = $from.node(-2);

		// Only the paragraph that opens an item, in a list.
		if (item.type !== schema.nodes.list_item || $from.index(-1) !== 0 || !nearestList(state)) {
			return false;
		}

		const position = $from.index(-2);

		if (position === 0) {
			return liftListItem(schema.nodes.list_item)(state, dispatch);
		}

		if (list.type !== schema.nodes.bullet_list && list.type !== schema.nodes.ordered_list) {
			return false;
		}

		const itemStart = $from.before(-1);
		const itemEnd = $from.after(-1);
		// The end of the last line of the item above, however deep its own lists go.
		const target = Selection.findFrom(state.doc.resolve(itemStart), -1, true);

		if (!target) {
			return false;
		}

		if (dispatch) {
			const tr = state.tr.delete(itemStart, itemEnd);
			const nested = item.content.cut(item.firstChild?.nodeSize ?? 0);

			if (nested.size > 0) {
				// The lists that were in the item go to the end of the item above.
				tr.insert(itemStart - 1, nested);
			}

			tr.insert(target.from, item.firstChild?.content ?? Fragment.empty);
			tr.setSelection(Selection.near(tr.doc.resolve(target.from), -1));
			dispatch(tr.scrollIntoView());
		}

		return true;
	};
}

/**
 * Takes the item out of every list it is in, so a paragraph is left. One transaction, so one undo step.
 * @param {import('prosemirror-model').Schema} schema
 * @returns {import('prosemirror-state').Command}
 */
function liftOutOfLists(schema) {
	return (state, dispatch) => {
		if (!nearestList(state)) {
			return false;
		}

		const master = state.tr;
		let current = state;

		while (nearestList(current)) {
			/** @type {{tr: import('prosemirror-state').Transaction | null}} */
			const lifted = { tr: null };

			liftListItem(schema.nodes.list_item)(current, (tr) => {
				lifted.tr = tr;
			});

			if (!lifted.tr) {
				break;
			}

			for (const change of lifted.tr.steps) {
				master.step(change);
			}

			current = current.apply(lifted.tr);
		}

		if (dispatch) {
			master.setSelection(Selection.fromJSON(master.doc, current.selection.toJSON()));
			dispatch(master.scrollIntoView());
		}

		return true;
	};
}

/**
 * The built in toolbar actions: marks, quote, lists and the like. Each has a shortcut where the writer expects one.
 * @param {import('prosemirror-model').Schema} schema
 * @returns {Array<import('./contracts.js').Command & {shortcut?: string, toggle: boolean}>}
 */
export function createBasicCommands(schema) {
	/**
	 * A list button: wraps the paragraphs in a list, changes the other kind of list into this one, or takes the list away.
	 * @param {string} id
	 * @param {string} label
	 * @param {import('prosemirror-model').NodeType} type
	 * @param {string} shortcut
	 */
	const listCommand = (id, label, type, shortcut) => ({
		id,
		label,
		shortcut,
		toggle: true,
		/** @type {import('prosemirror-state').Command} */
		run(state, dispatch, view) {
			const current = nearestList(state);

			if (current && current.node.type === type) {
				return liftOutOfLists(schema)(state, dispatch, view);
			}

			if (current) {
				if (dispatch) {
					dispatch(state.tr.setNodeMarkup(current.pos, type, type.name === `ordered_list` ? { marker: `1` } : null));
				}

				return true;
			}

			return wrapInList(type)(state, dispatch, view);
		},
		/** @param {import('prosemirror-state').EditorState} state */
		isActive: (state) => nearestList(state)?.node.type === type,
	});

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
		markCommand(`bold`, `Bold`, strong, `Mod-b`),
		markCommand(`italic`, `Italic`, em, `Mod-i`),
		markCommand(`strike`, `Strikethrough`, strike, `Mod-Shift-x`),
		{
			id: `normal`,
			label: `Normal text`,
			shortcut: `Mod-Shift-0`,
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
			id: `quote`,
			label: `Quote`,
			shortcut: `Mod-Shift-q`,
			toggle: true,
			run(state, dispatch, view) {
				return insideNode(state, schema.nodes.blockquote)
					? lift(state, dispatch, view)
					: wrapIn(schema.nodes.blockquote)(state, dispatch, view);
			},
			isActive: (state) => insideNode(state, schema.nodes.blockquote),
		},
		listCommand(`bullet-list`, `Bullet list`, schema.nodes.bullet_list, `Mod-Shift-8`),
		listCommand(`numbered-list`, `Numbered list`, schema.nodes.ordered_list, `Mod-Shift-7`),
	];
}
