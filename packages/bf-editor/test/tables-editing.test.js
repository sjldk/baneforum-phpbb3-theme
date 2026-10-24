// Tables in the editor: making one, moving in it, editing it, and the limit of 8 columns and 5 rows.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GapCursor } from 'prosemirror-gapcursor';
import { Slice } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import { createBBCodeCodec } from '../src/codecs/bbcode.js';
import { createBasicCommands } from '../src/commands.js';
import { createPlugins } from '../src/plugins.js';
import { MAX_TABLE_COLUMNS, MAX_TABLE_ROWS, schema } from '../src/schema.js';
import { createTable, createTableCommands, limitPastedTables } from '../src/table-commands.js';

const codec = createBBCodeCodec(schema);
const commands = [...createBasicCommands(schema), ...createTableCommands(schema, { ask: async () => null })];
const plugins = createPlugins(schema, commands);
const byId = (id) => commands.find((command) => command.id === id);

/** A view that only holds a state: enough for commands and keys. The cursor is after `find`, or at the end. */
function viewWith(bbcode, find = ``) {
	const doc = codec.parse(bbcode);
	let at = doc.content.size - 1;

	if (find) {
		doc.descendants((node, pos) => {
			if (node.isText && node.text.includes(find)) {
				at = pos + node.text.indexOf(find) + find.length;
			}
		});
	}

	const view = {
		state: EditorState.create({ doc, plugins }),
		composing: false,
		focus() {},
		// Every key is taken to be at the end of its line, which is where the cursor leaves a cell.
		endOfTextblock: () => true,
		dispatch: (tr) => {
			view.state = view.state.apply(tr);
		},
	};
	view.state = view.state.apply(view.state.tr.setSelection(TextSelection.create(view.state.doc, at)));

	return view;
}

const saved = (view) => codec.serialize(view.state.doc);
const run = (view, id) => byId(id).run(view.state, view.dispatch, view);

function press(view, key, shift = false) {
	const event = {
		key,
		shiftKey: shift,
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		keyCode: 9,
		preventDefault() {},
	};

	return plugins.some((plugin) => plugin.props.handleKeyDown?.(view, event));
}

function type(view, text) {
	view.dispatch(view.state.tr.insertText(text));
}

const insert = (view, rows, columns) => {
	// The command asks for the size. This one answers at once.
	const [table] = createTableCommands(schema, { ask: async () => ({ rows, columns }) });
	table.run(view.state, view.dispatch, view);

	return new Promise((resolve) => setTimeout(resolve, 0));
};

test(`a new table has the size asked for, the first row is header cells`, () => {
	assert.equal(
		codec.serialize(schema.nodes.doc.create(null, [createTable(schema, 2, 3)])),
		`[table]\n[tr][th][/th][th][/th][th][/th][/tr]\n[tr][td][/td][td][/td][td][/td][/tr]\n[/table]`,
	);
});

test(`a table is never wider than 8 columns or higher than 5 rows when made`, () => {
	const table = createTable(schema, 99, 99);
	assert.equal(table.childCount, MAX_TABLE_ROWS);
	assert.equal(table.firstChild.childCount, MAX_TABLE_COLUMNS);
	assert.equal(createTable(schema, 0, 0).childCount, 1);
});

test(`the Table button puts the table in place of an empty paragraph, with the cursor in the first cell`, async () => {
	const view = viewWith(``);
	await insert(view, 2, 2);
	type(view, `Name`);
	assert.equal(saved(view), `[table]\n[tr][th]Name[/th][th][/th][/tr]\n[tr][td][/td][td][/td][/tr]\n[/table]`);
	assert.equal(view.state.doc.lastChild.type, schema.nodes.paragraph, `a line is left below the table`);
	assert.equal(byId(`table`).isActive(view.state), true);
});

test(`a table made after a paragraph with text goes below it`, async () => {
	const view = viewWith(`before`, `before`);
	await insert(view, 1, 1);
	assert.equal(saved(view), `before\n\n[table]\n[tr][th][/th][/tr]\n[/table]`);
});

test(`Tab moves to the next cell, and in the last cell it adds a row`, async () => {
	const view = viewWith(``);
	await insert(view, 2, 2);
	type(view, `a`);
	assert.equal(press(view, `Tab`), true);
	type(view, `b`);
	assert.equal(press(view, `Tab`), true);
	type(view, `c`);
	assert.equal(press(view, `Tab`), true);
	type(view, `d`);
	assert.equal(press(view, `Tab`), true);
	type(view, `e`);
	assert.equal(
		saved(view),
		`[table]\n[tr][th]a[/th][th]b[/th][/tr]\n[tr][td]c[/td][td]d[/td][/tr]\n[tr][td]e[/td][td][/td][/tr]\n[/table]`,
	);
});

test(`Shift+Tab goes back, and in the first cell it leaves the key to the browser`, async () => {
	const view = viewWith(``);
	await insert(view, 1, 2);
	assert.equal(press(view, `Tab`), true);
	assert.equal(press(view, `Tab`, true), true);
	assert.equal(press(view, `Tab`, true), false);
});

test(`Enter in a cell is a line break and does not make a new cell`, async () => {
	const view = viewWith(``);
	await insert(view, 1, 1);
	type(view, `a`);
	assert.equal(press(view, `Enter`), true);
	type(view, `b`);
	assert.equal(saved(view), `[table]\n[tr][th]a\nb[/th][/tr]\n[/table]`);
});

test(`rows and columns are added on both sides, and the first row has no "above"`, async () => {
	const view = viewWith(``);
	await insert(view, 2, 2);
	assert.equal(byId(`row-above`).run(view.state), false, `in the header row`);
	run(view, `row-below`);
	run(view, `column-right`);
	run(view, `column-left`);
	assert.match(saved(view), /^\[table\]\n(\[tr\](\[t[hd]\]\[\/t[hd]\]){4}\[\/tr\]\n){3}\[\/table\]/);
});

test(`delete row, column and table`, async () => {
	const view = viewWith(``);
	await insert(view, 3, 3);
	run(view, `delete-column`);
	run(view, `delete-row`);
	// The header row went. The next row is now the first, and it keeps its plain cells.
	assert.equal(saved(view), `[table]\n[tr][td][/td][td][/td][/tr]\n[tr][td][/td][td][/td][/tr]\n[/table]`);
});

test(`delete table takes the whole table away`, async () => {
	const view = viewWith(``);
	await insert(view, 2, 2);
	run(view, `delete-table`);
	assert.equal(saved(view), ``);
});

test(`add column is off at 8 columns, and the table bar buttons are off outside a table`, async () => {
	const view = viewWith(``);
	await insert(view, 1, 7);
	assert.equal(byId(`column-right`).run(view.state), true);
	run(view, `column-right`);
	assert.equal(byId(`column-right`).run(view.state), false);
	assert.equal(byId(`column-left`).run(view.state), false);
	assert.equal(byId(`row-below`).run(view.state), true);

	const outside = viewWith(`plain`);

	for (const id of [
		`row-above`,
		`row-below`,
		`column-left`,
		`column-right`,
		`delete-row`,
		`delete-column`,
		`delete-table`,
	]) {
		assert.equal(byId(id).run(outside.state), false, id);
	}

	assert.equal(byId(`table`).run(outside.state), true);
});

/** A table that was not made by the picker, as a paste can bring one. */
const wideTable = (columns) =>
	schema.nodes.table.create(null, [
		schema.nodes.table_row.create(
			null,
			Array.from({ length: columns }, () => schema.nodes.table_cell.create()),
		),
	]);

test(`a pasted table with more than 8 columns or 5 rows is cut, and the cut is reported`, () => {
	let reported = 0;
	const report = () => {
		reported += 1;
	};
	const paste = (table) =>
		limitPastedTables(schema, new Slice(schema.nodes.doc.create(null, [table]).content, 0, 0), report);

	const wide = paste(wideTable(12));
	assert.equal(wide.content.firstChild.firstChild.childCount, MAX_TABLE_COLUMNS);
	assert.equal(reported, 1);

	const tall = paste(
		schema.nodes.table.create(
			null,
			Array.from({ length: 9 }, () => schema.nodes.table_row.create(null, [schema.nodes.table_cell.create()])),
		),
	);
	assert.equal(tall.content.firstChild.childCount, MAX_TABLE_ROWS);
	assert.equal(reported, 2);

	const fits = paste(wideTable(MAX_TABLE_COLUMNS));
	assert.equal(fits.content.firstChild.firstChild.childCount, MAX_TABLE_COLUMNS);
	assert.equal(reported, 2, `a table of the largest size is not cut`);
});

test(`no row can be added past 5, also with Tab in the last cell`, async () => {
	const view = viewWith(``);
	await insert(view, 5, 1);
	assert.equal(byId(`row-below`).run(view.state), false);
	assert.equal(byId(`row-above`).run(view.state), false);

	// Tab goes down the rows. In the last cell no row is added, so the key goes on to the browser.
	for (let step = 0; step < 4; step += 1) {
		assert.equal(press(view, `Tab`), true);
	}

	assert.equal(press(view, `Tab`), false);
	assert.equal(saved(view).match(/\[tr\]/g).length, 5);
});

test(`Arrow down in the last row goes to the line under the table, and makes one when there is none`, () => {
	const withLine = viewWith(`[table]\n[tr][td]cell[/td][/tr]\n[/table]\n\ntail`, `cell`);
	assert.equal(press(withLine, `ArrowDown`), true);
	type(withLine, `x`);
	assert.equal(saved(withLine), `[table]\n[tr][td]cell[/td][/tr]\n[/table]\n\nxtail`);

	const noLine = viewWith(`[table]\n[tr][td]a[/td][/tr]\n[/table]`, `a`);
	assert.equal(press(noLine, `ArrowDown`), true);
	type(noLine, `x`);
	assert.equal(saved(noLine), `[table]\n[tr][td]a[/td][/tr]\n[/table]\n\nx`);
});

test(`Arrow up in the first row goes to the line over the table, and makes one when there is none`, () => {
	const withLine = viewWith(`head\n\n[table]\n[tr][td]cell[/td][/tr]\n[/table]`, `cell`);
	assert.equal(press(withLine, `ArrowUp`), true);
	type(withLine, `x`);
	assert.equal(saved(withLine), `headx\n\n[table]\n[tr][td]cell[/td][/tr]\n[/table]`);

	const noLine = viewWith(`[table]\n[tr][td]a[/td][/tr]\n[/table]`, `a`);
	assert.equal(press(noLine, `ArrowUp`), true);
	type(noLine, `x`);
	assert.equal(saved(noLine), `x\n\n[table]\n[tr][td]a[/td][/tr]\n[/table]`);
});

test(`Arrow right at the end of the last cell and left at the start of the first cell leave the table`, () => {
	const right = viewWith(`[table]\n[tr][td]a[/td][td]b[/td][/tr]\n[/table]`, `b`);
	assert.equal(press(right, `ArrowRight`), true);
	type(right, `x`);
	assert.match(saved(right), /\[\/table\]\n\nx$/);

	const left = viewWith(`[table]\n[tr][td]a[/td][td]b[/td][/tr]\n[/table]`, `a`);
	left.dispatch(left.state.tr.setSelection(TextSelection.create(left.state.doc, 3)));
	assert.equal(press(left, `ArrowLeft`), true);
	type(left, `x`);
	assert.match(saved(left), /^x\n\n\[table\]/);
});

test(`arrow keys move from cell to cell, and never leave the cursor in a gap`, () => {
	const text = `[table]\n[tr][td]one[/td][td]two[/td][/tr]\n[tr][td]three[/td][td]four[/td][/tr]\n[/table]`;
	const start = (find) => viewWith(text, find);
	const typedAfter = (view, key) => {
		assert.equal(press(view, key), true, key);
		assert.equal(view.state.selection.toJSON().type, `text`, `a text cursor, not a gap cursor`);
		type(view, `X`);

		return saved(view);
	};

	assert.match(typedAfter(start(`one`), `ArrowDown`), /\[td\]Xthree\[\/td\]/);
	assert.match(typedAfter(start(`three`), `ArrowUp`), /\[td\]Xone\[\/td\]/);
	assert.match(typedAfter(start(`one`), `ArrowRight`), /\[td\]Xtwo\[\/td\]/);
	assert.match(typedAfter(start(`two`), `ArrowLeft`), /\[td\]oneX\[\/td\]/);
	assert.match(
		typedAfter(start(`two`), `ArrowRight`),
		/\[td\]Xthree\[\/td\]/,
		`at the end of a row, right goes to the next row`,
	);
	assert.match(
		typedAfter(start(`three`), `ArrowLeft`),
		/\[td\]twoX\[\/td\]/,
		`at the start of a row, left goes to the row above`,
	);
	assert.equal(press(viewWith(`plain`), `ArrowDown`), false);
});

test(`going out over the table and back in again puts the cursor in the first cell, and nothing shifts`, async () => {
	const view = viewWith(``);
	await insert(view, 1, 2);
	type(view, `a`);
	assert.equal(press(view, `ArrowUp`), true, `out over the table`);
	type(view, `line`);
	assert.equal(press(view, `ArrowDown`), true, `and back in`);
	type(view, `X`);
	assert.equal(saved(view), `line\n\n[table]\n[tr][th]Xa[/th][th][/th][/tr]\n[/table]`);
});

test(`arrow down from the line over a table goes into its first cell, arrow up from the line under it into its last row`, () => {
	const text = `head\n\n[table]\n[tr][td]one[/td][td]two[/td][/tr]\n[tr][td]three[/td][td]four[/td][/tr]\n[/table]\n\ntail`;
	const down = viewWith(text, `head`);
	assert.equal(press(down, `ArrowDown`), true);
	type(down, `X`);
	assert.match(saved(down), /\[td\]Xone\[\/td\]/);

	const up = viewWith(text, `tail`);
	assert.equal(press(up, `ArrowUp`), true);
	type(up, `X`);
	assert.match(saved(up), /\[td\]Xthree\[\/td\]/);

	const right = viewWith(text, `head`);
	assert.equal(press(right, `ArrowRight`), true);
	type(right, `X`);
	assert.match(saved(right), /\[td\]Xone\[\/td\]/);

	const left = viewWith(text, `tail`);
	left.dispatch(left.state.tr.setSelection(TextSelection.create(left.state.doc, left.state.selection.from - 4)));
	assert.equal(press(left, `ArrowLeft`), true);
	type(left, `X`);
	assert.match(saved(left), /\[td\]fourX\[\/td\]/);
});

test(`a cursor that ends between two cells is turned into a text cursor in a cell`, () => {
	const view = viewWith(`[table]\n[tr][td]one[/td][td]two[/td][/tr]\n[/table]`, `one`);
	const row = view.state.doc.firstChild.firstChild;
	// The position between the two cells of the first row.
	const between = 2 + row.firstChild.nodeSize;
	view.dispatch(view.state.tr.setSelection(new GapCursor(view.state.doc.resolve(between))));
	assert.equal(view.state.selection.toJSON().type, `text`);
	type(view, `X`);
	assert.equal(saved(view), `[table]\n[tr][td]oneX[/td][td]two[/td][/tr]\n[/table]`);
});

test(`a table that is opened and saved again gives the same text`, () => {
	const text = `[table]\n[tr][th]a[/th][th align=right]b[/th][/tr]\n[tr][td]c[/td][td]d[/td][/tr]\n[/table]`;
	assert.equal(codec.serialize(codec.parse(text)), text);
});
