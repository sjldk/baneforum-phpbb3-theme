// The table actions. Making a table and editing one are separate from asking for its size:
// `insertTable` only edits the document, and the toolbar command asks a function it is given
// (the picker, or a fake). The editing commands come from prosemirror-tables, with one limit
// added: a table never gets more than MAX_TABLE_COLUMNS columns or MAX_TABLE_ROWS rows.

import { GapCursor } from 'prosemirror-gapcursor';
import { Fragment, Slice } from 'prosemirror-model';
import { Plugin, Selection, TextSelection } from 'prosemirror-state';
import {
	addColumnAfter,
	addColumnBefore,
	addRowAfter,
	addRowBefore,
	deleteColumn,
	deleteRow,
	deleteTable,
	goToNextCell,
	isInTable,
	selectedRect,
} from 'prosemirror-tables';
import { MAX_TABLE_COLUMNS, MAX_TABLE_ROWS } from './schema.js';

/**
 * A whole number from 1 up to the most. Anything that is not a number gives 1.
 * @param {number} value
 * @param {number} most
 */
const clamp = (value, most) => Math.min(Math.max(Math.trunc(value) || 1, 1), most);

/**
 * A table of the size, the first row made of header cells, every cell empty.
 * @param {import('prosemirror-model').Schema} schema
 * @param {number} rows
 * @param {number} columns
 */
export function createTable(schema, rows, columns) {
	const { table, table_row: row, table_header: header, table_cell: cell } = schema.nodes;
	const count = clamp(columns, MAX_TABLE_COLUMNS);
	const lines = [];

	for (let index = 0; index < clamp(rows, MAX_TABLE_ROWS); index += 1) {
		const type = index === 0 ? header : cell;
		lines.push(
			row.create(
				null,
				Array.from({ length: count }, () => type.create()),
			),
		);
	}

	return table.create(null, lines);
}

/**
 * Puts a new table after the block the cursor is in (or in place of an empty paragraph), with the
 * cursor in its first cell. A paragraph always follows the table, so there is a line below it.
 * @param {import('prosemirror-model').Schema} schema
 * @param {number} rows
 * @param {number} columns
 * @returns {import('prosemirror-state').Command}
 */
export function insertTable(schema, rows, columns) {
	return (state, dispatch) => {
		if (!dispatch) {
			return true;
		}

		const { $from } = state.selection;
		const top = $from.depth === 0 ? null : $from.node(1);
		const emptyParagraph = top?.type === schema.nodes.paragraph && top.content.size === 0;
		const from = $from.depth === 0 ? $from.pos : emptyParagraph ? $from.before(1) : $from.after(1);
		const to = emptyParagraph ? $from.after(1) : from;
		const table = createTable(schema, rows, columns);
		const last = to >= state.doc.content.size;
		const tr = state.tr.replaceWith(from, to, last ? [table, schema.nodes.paragraph.create()] : table);
		dispatch(tr.setSelection(TextSelection.create(tr.doc, from + 3)).scrollIntoView());

		return true;
	};
}

/**
 * How many columns the table at the cursor has, or 0.
 * @param {import('prosemirror-state').EditorState} state
 */
const columnCount = (state) => (isInTable(state) ? selectedRect(state).map.width : 0);

/**
 * Lets a command run only while the table has fewer than MAX_TABLE_COLUMNS columns, so it cannot grow past the limit.
 * @param {import('prosemirror-state').Command} command
 * @returns {import('prosemirror-state').Command}
 */
const widthLimited = (command) => (state, dispatch, view) =>
	columnCount(state) < MAX_TABLE_COLUMNS && command(state, dispatch, view);

/**
 * How many rows the table at the cursor has, or 0.
 * @param {import('prosemirror-state').EditorState} state
 */
const rowCount = (state) => (isInTable(state) ? selectedRect(state).map.height : 0);

/**
 * Lets a command run only while the table has fewer than MAX_TABLE_ROWS rows, so it cannot grow past the limit.
 * @param {import('prosemirror-state').Command} command
 * @returns {import('prosemirror-state').Command}
 */
const heightLimited = (command) => (state, dispatch, view) =>
	isInTable(state) && rowCount(state) < MAX_TABLE_ROWS && command(state, dispatch, view);

/**
 * A new row above the header row would be a second header row, so the first row has no "above".
 * @type {import('prosemirror-state').Command}
 */
const rowAbove = heightLimited((state, dispatch) => selectedRect(state).top > 0 && addRowBefore(state, dispatch));

const rowBelow = heightLimited(addRowAfter);

/**
 * Tab goes to the next cell, and in the last cell it adds a row, as in Word (not past MAX_TABLE_ROWS rows).
 * Shift+Tab goes back, and in the first cell it does nothing, so the key goes on to the browser.
 * @type {import('prosemirror-state').Command}
 */
export const nextCell = (state, dispatch, view) => {
	if (!isInTable(state)) {
		return false;
	}

	if (goToNextCell(1)(state, dispatch)) {
		return true;
	}

	if (!rowBelow(state, dispatch)) {
		return false;
	}

	if (dispatch && view) {
		goToNextCell(1)(view.state, view.dispatch);
	}

	return true;
};

export const previousCell = goToNextCell(-1);

/**
 * An arrow key at the end of the line in a cell moves to the next cell: down and up to the cell in the same column,
 * right and left to the next and the previous cell (over the end of a row). The cursor goes to the start of the cell,
 * or to its end when going left. prosemirror-tables has its own arrow handling, but it expects paragraphs in the
 * cells, and ours hold plain text, so it ends in an invisible gap cursor. Where the cursor cannot go on (the edge
 * of the table), see `leaveTable`.
 * @param {'up' | 'down' | 'left' | 'right'} direction
 * @returns {import('prosemirror-state').Command}
 */
export const moveInTable = (direction) => (state, dispatch, view) => {
	if (!isInTable(state) || !state.selection.empty) {
		return false;
	}

	// Not at the end of the line in the cell yet: the key moves in the cell.
	if (view?.endOfTextblock && !view.endOfTextblock(direction)) {
		return false;
	}

	const { map, table, tableStart, left, right, top, bottom } = selectedRect(state);
	let index;

	if (direction === `down` && bottom < map.height) {
		index = bottom * map.width + left;
	} else if (direction === `up` && top > 0) {
		index = (top - 1) * map.width + left;
	} else if (direction === `right` && right < map.width) {
		index = top * map.width + right;
	} else if (direction === `right` && bottom < map.height) {
		index = bottom * map.width;
	} else if (direction === `left` && left > 0) {
		index = top * map.width + left - 1;
	} else if (direction === `left` && top > 0) {
		index = top * map.width - 1;
	} else {
		return false;
	}

	const offset = map.map[index];
	const cell = table.nodeAt(offset);

	if (!cell) {
		return false;
	}

	if (dispatch) {
		const start = tableStart + offset + 1;
		const at = direction === `left` ? start + cell.content.size : start;
		dispatch(state.tr.setSelection(TextSelection.create(state.doc, at)).scrollIntoView());
	}

	return true;
};

/**
 * An arrow key at the end (or start) of a paragraph that is next to a table goes into the table: down and right
 * to the start of the first cell, up to the start of the last row, left to the end of the last cell. Without this
 * the gap cursor would take the key and the cursor would rest between two cells.
 * @param {'up' | 'down' | 'left' | 'right'} direction
 * @param {import('prosemirror-model').Schema} schema
 * @returns {import('prosemirror-state').Command}
 */
export const enterTable = (direction, schema) => (state, dispatch, view) => {
	const { selection } = state;
	const { $from } = selection;

	if (!selection.empty || $from.depth !== 1 || !$from.parent.isTextblock) {
		return false;
	}

	if (view?.endOfTextblock && !view.endOfTextblock(direction)) {
		return false;
	}

	const forward = direction === `down` || direction === `right`;
	const edge = forward ? $from.after(1) : $from.before(1);
	const table = forward ? state.doc.resolve(edge).nodeAfter : state.doc.resolve(edge).nodeBefore;

	if (table?.type !== schema.nodes.table || !table.lastChild) {
		return false;
	}

	const tableStart = forward ? edge : edge - table.nodeSize;
	const lastRow = tableStart + table.nodeSize - 1 - table.lastChild.nodeSize;
	const at =
		direction === `left` ? tableStart + table.nodeSize - 1 - 2 : direction === `up` ? lastRow + 2 : tableStart + 3;

	if (dispatch) {
		dispatch(state.tr.setSelection(TextSelection.create(state.doc, at)).scrollIntoView());
	}

	return true;
};

/**
 * The cursor never rests between two cells or two rows (a gap cursor there would make a new cell when typing).
 * A click or a move that ends there is turned into a text cursor in the nearest cell.
 * @param {import('prosemirror-model').Schema} schema
 */
export function keepCursorInCells(schema) {
	return new Plugin({
		appendTransaction: (_transactions, _before, state) => {
			const { selection } = state;

			if (
				selection instanceof GapCursor &&
				(selection.$from.parent.type === schema.nodes.table_row || selection.$from.parent.type === schema.nodes.table)
			) {
				return state.tr.setSelection(Selection.near(selection.$from, -1));
			}

			return null;
		},
	});
}

/**
 * An arrow key at the edge of a table leaves it for a real line to write on: the paragraph under (or over) the
 * table, which is made when there is none. Without this the cursor would go to an invisible gap next to the table.
 * It only acts where the cursor cannot go further in the table: the last row for down, the first row for up,
 * the end of the last cell for right, the start of the first cell for left.
 * @param {'up' | 'down' | 'left' | 'right'} direction
 * @param {import('prosemirror-model').Schema} schema
 * @returns {import('prosemirror-state').Command}
 */
export const leaveTable = (direction, schema) => (state, dispatch, view) => {
	const { selection } = state;

	if (!isInTable(state) || !selection.empty) {
		return false;
	}

	// Not at the end of the line in the cell yet: the key moves in the cell.
	if (view?.endOfTextblock && !view.endOfTextblock(direction)) {
		return false;
	}

	const rect = selectedRect(state);
	const forward = direction === `down` || direction === `right`;
	const atEdge =
		direction === `down`
			? rect.bottom === rect.map.height
			: direction === `up`
				? rect.top === 0
				: direction === `right`
					? rect.bottom === rect.map.height && rect.right === rect.map.width
					: rect.top === 0 && rect.left === 0;

	if (!atEdge) {
		return false;
	}

	const { $from } = selection;
	let depth = $from.depth;

	while (depth > 0 && $from.node(depth).type !== schema.nodes.table) {
		depth -= 1;
	}

	if (depth === 0) {
		return false;
	}

	if (dispatch) {
		const doc = state.doc;
		const position = forward ? $from.after(depth) : $from.before(depth);
		const neighbour = forward ? doc.resolve(position).nodeAfter : doc.resolve(position).nodeBefore;
		let tr = state.tr;
		let cursor;

		if (neighbour?.isTextblock) {
			// The existing line: at its start when going down, at its end when going up.
			cursor = forward ? position + 1 : position - 1;
		} else {
			tr = tr.insert(position, schema.nodes.paragraph.create());
			cursor = position + 1;
		}

		dispatch(tr.setSelection(TextSelection.create(tr.doc, cursor)).scrollIntoView());
	}

	return true;
};

/**
 * Enter in a cell is a line break in the cell: a cell has no paragraphs, and a split would make a new cell.
 * @param {import('prosemirror-model').Schema} schema
 * @returns {import('prosemirror-state').Command}
 */
export const lineBreakInCell = (schema) => (state, dispatch) => {
	if (!isInTable(state)) {
		return false;
	}

	if (dispatch) {
		dispatch(state.tr.replaceSelectionWith(schema.nodes.hard_break.create()).scrollIntoView());
	}

	return true;
};

/**
 * A pasted table never keeps more than MAX_TABLE_COLUMNS columns or MAX_TABLE_ROWS rows. `report` is called when something was cut.
 * @param {Fragment} fragment
 * @param {import('prosemirror-model').Schema} schema
 * @param {() => void} report
 * @returns {Fragment}
 */
function cutColumns(fragment, schema, report) {
	/** @type {import('prosemirror-model').Node[]} */
	const out = [];

	fragment.forEach((node) => {
		if (node.type === schema.nodes.table) {
			let cut = false;
			/** @type {import('prosemirror-model').Node[]} */
			const rows = [];

			node.forEach((row, _offset, index) => {
				if (index >= MAX_TABLE_ROWS) {
					cut = true;

					return;
				}

				let used = 0;
				/** @type {import('prosemirror-model').Node[]} */
				const cells = [];

				row.forEach((cell) => {
					const span = cell.attrs.colspan || 1;

					if (used + span <= MAX_TABLE_COLUMNS) {
						cells.push(cell);
					} else {
						cut = true;
					}

					used += span;
				});
				rows.push(row.copy(Fragment.from(cells)));
			});

			if (cut) {
				report();
			}

			out.push(node.copy(Fragment.from(rows)));
		} else if (!node.isLeaf && !node.isTextblock) {
			out.push(node.copy(cutColumns(node.content, schema, report)));
		} else {
			out.push(node);
		}
	});

	return Fragment.fromArray(out);
}

/**
 * Cuts a pasted table down to MAX_TABLE_COLUMNS columns and MAX_TABLE_ROWS rows, and calls report when it cut,
 * so the writer is told why cells are missing.
 * @param {import('prosemirror-model').Schema} schema
 * @param {Slice} slice
 * @param {() => void} report
 */
export function limitPastedTables(schema, slice, report) {
	return new Slice(cutColumns(slice.content, schema, report), slice.openStart, slice.openEnd);
}

/**
 * The Table button and the buttons of the table bar.
 * @param {import('prosemirror-model').Schema} schema
 * @param {{ask: () => Promise<{rows: number, columns: number} | null>}} options
 * @returns {Array<import('./contracts.js').Command & {shortcut?: string, toggle?: boolean}>}
 */
export function createTableCommands(schema, { ask }) {
	/**
	 * @param {string} id
	 * @param {string} label
	 * @param {import('prosemirror-state').Command} run
	 */
	const bar = (id, label, run) => ({ id, label, run });

	return [
		{
			id: `table`,
			label: `Table`,
			toggle: true,
			run(state, dispatch, view) {
				if (!dispatch || !view) {
					return true;
				}

				// The dialog takes the focus, and when it gives it back the browser puts the cursor at the start of the
				// text. So the cursor is put back where it was, also when the dialog was cancelled.
				const before = state.selection.toJSON();
				const doc = state.doc;
				const restore = () => {
					// Only while the text is still the same, or the saved position may not exist any more.
					if (view.state.doc.eq(doc)) {
						view.dispatch(view.state.tr.setSelection(Selection.fromJSON(view.state.doc, before)));
					}
				};

				ask().then((size) => {
					restore();

					if (size) {
						insertTable(schema, size.rows, size.columns)(view.state, view.dispatch);
					}

					view.focus();
					// The browser reports its own cursor after the dialog has closed, so look once more.
					setTimeout(() => {
						if (!size) {
							restore();
						}
					}, 0);
				});

				return true;
			},
			isActive: (state) => isInTable(state),
		},
		bar(`row-above`, `Insert row above`, rowAbove),
		bar(`row-below`, `Insert row below`, rowBelow),
		bar(`column-left`, `Insert column left`, widthLimited(addColumnBefore)),
		bar(`column-right`, `Insert column right`, widthLimited(addColumnAfter)),
		bar(`delete-row`, `Delete row`, deleteRow),
		bar(`delete-column`, `Delete column`, deleteColumn),
		bar(`delete-table`, `Delete table`, deleteTable),
	];
}
