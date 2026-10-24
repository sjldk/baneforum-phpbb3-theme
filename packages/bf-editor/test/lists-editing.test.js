// Lists in the editor: the buttons, the keys (Enter, Tab, Shift+Tab) and the typing rules ("- ", "1. ").
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EditorState, TextSelection } from 'prosemirror-state';
import { createBBCodeCodec } from '../src/codecs/bbcode.js';
import { createBasicCommands } from '../src/commands.js';
import { createPlugins } from '../src/plugins.js';
import { schema } from '../src/schema.js';

const codec = createBBCodeCodec(schema);
const commands = createBasicCommands(schema);
const plugins = createPlugins(schema, commands);
const byId = (id) => commands.find((command) => command.id === id);

/** A view that only holds a state: enough for commands, keys and typing. The cursor is at the end of `text` in the block that holds `find`. */
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
		// The browser asks this for Backspace: only the very start of a line counts as its start.
		endOfTextblock: (direction) => (direction === `backward` ? view.state.selection.$head.parentOffset === 0 : true),
		// An arrow function: the keymap calls it on its own, without the view.
		dispatch: (tr) => {
			view.state = view.state.apply(tr);
		},
	};
	view.state = view.state.apply(view.state.tr.setSelection(TextSelection.create(view.state.doc, at)));

	return view;
}

const saved = (view) => codec.serialize(view.state.doc);

function press(view, key, shift = false) {
	const event = {
		key,
		shiftKey: shift,
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		keyCode: key === `Tab` ? 9 : 13,
		preventDefault() {},
	};

	return plugins.some((plugin) => plugin.props.handleKeyDown?.(view, event));
}

function typeText(view, text) {
	for (const character of text) {
		const { from, to } = view.state.selection;
		const handled = plugins.some((plugin) =>
			plugin.props.handleTextInput?.(view, from, to, character, () => view.state.tr.insertText(character, from, to)),
		);

		if (!handled) {
			view.dispatch(view.state.tr.insertText(character, from, to));
		}
	}
}

test(`the bullet button makes the paragraph a list, and is on while the cursor is in it`, () => {
	const view = viewWith(`one`);
	byId(`bullet-list`).run(view.state, view.dispatch.bind(view), view);
	assert.equal(saved(view), `[list]\n[*]one\n[/list]`);
	assert.equal(byId(`bullet-list`).isActive(view.state), true);
	assert.equal(byId(`numbered-list`).isActive(view.state), false);
});

test(`the numbered button makes a numbered list`, () => {
	const view = viewWith(`one`);
	byId(`numbered-list`).run(view.state, view.dispatch.bind(view), view);
	assert.equal(saved(view), `[list=1]\n[*]one\n[/list]`);
});

test(`the button on a list of the other kind changes the kind`, () => {
	const view = viewWith(`[list]\n[*]one\n[*]two\n[/list]`, `one`);
	byId(`numbered-list`).run(view.state, view.dispatch.bind(view), view);
	assert.equal(saved(view), `[list=1]\n[*]one\n[*]two\n[/list]`);
	byId(`bullet-list`).run(view.state, view.dispatch.bind(view), view);
	assert.equal(saved(view), `[list]\n[*]one\n[*]two\n[/list]`);
});

test(`the button on a list takes the item out of it, also out of a nested list, in one step`, () => {
	const view = viewWith(`[list]\n[*]a\n[list]\n[*]deep\n[/list]\n[/list]`, `deep`);
	byId(`bullet-list`).run(view.state, view.dispatch.bind(view), view);
	assert.equal(saved(view), `[list]\n[*]a\n[/list]\n\ndeep`);
});

test(`Enter in an item makes a new item, and in an empty item it leaves the list`, () => {
	const view = viewWith(`[list]\n[*]one\n[/list]`, `one`);
	assert.equal(press(view, `Enter`), true);
	typeText(view, `two`);
	assert.equal(saved(view), `[list]\n[*]one\n[*]two\n[/list]`);
	assert.equal(press(view, `Enter`), true);
	assert.equal(press(view, `Enter`), true);
	typeText(view, `after`);
	assert.equal(saved(view), `[list]\n[*]one\n[*]two\n[/list]\n\nafter`);
});

test(`Tab moves an item into the one before it, and Shift+Tab moves it out`, () => {
	const view = viewWith(`[list]\n[*]one\n[*]two\n[/list]`, `two`);
	assert.equal(press(view, `Tab`), true);
	assert.equal(saved(view), `[list]\n[*]one\n[list]\n[*]two\n[/list]\n[/list]`);
	assert.equal(press(view, `Tab`, true), true);
	assert.equal(saved(view), `[list]\n[*]one\n[*]two\n[/list]`);
});

test(`Tab on the first item does nothing, so the key goes on to the browser`, () => {
	const view = viewWith(`[list]\n[*]one\n[*]two\n[/list]`, `one`);
	assert.equal(press(view, `Tab`), false);
});

test(`Tab outside a list does nothing`, () => {
	assert.equal(press(viewWith(`plain`), `Tab`), false);
});

test(`typing "- " starts a bullet list, "* " too, and "1. " a numbered list`, () => {
	for (const [typed, expected] of [
		[`- one`, `[list]\n[*]one\n[/list]`],
		[`* one`, `[list]\n[*]one\n[/list]`],
		[`1. one`, `[list=1]\n[*]one\n[/list]`],
	]) {
		const view = viewWith(``);
		typeText(view, typed);
		assert.equal(saved(view), expected, typed);
	}
});

test(`a dash in the middle of a line is only a dash`, () => {
	const view = viewWith(``);
	typeText(view, `a - b`);
	assert.equal(saved(view), `a - b`);
});

test(`formatting works inside an item`, () => {
	const view = viewWith(`[list]\n[*]one\n[/list]`, `one`);
	typeText(view, ` **bold**`);
	assert.equal(saved(view), `[list]\n[*]one [b]bold[/b]\n[/list]`);
});

/** The cursor at the start of the item whose text is `find`, with the text itself removed when `clear` is true. */
function atStartOf(bbcode, find, clear = false) {
	const view = viewWith(bbcode, find);

	if (clear) {
		const { from } = view.state.selection;
		view.dispatch(view.state.tr.delete(from - find.length, from));
	} else {
		const { from } = view.state.selection;
		view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from - find.length)));
	}

	return view;
}

const nested = `[list]\n[*]a\n[list]\n[*]b\n[*]c\n[*]d\n[/list]\n[*]e\n[/list]`;

test(`Backspace in an empty item in the middle of a nested list removes it, and the list keeps its flow`, () => {
	const view = atStartOf(nested, `c`, true);
	assert.equal(press(view, `Backspace`), true);
	assert.equal(saved(view), `[list]\n[*]a\n[list]\n[*]b\n[*]d\n[/list]\n[*]e\n[/list]`);
	typeText(view, `X`);
	assert.equal(
		saved(view),
		`[list]\n[*]a\n[list]\n[*]bX\n[*]d\n[/list]\n[*]e\n[/list]`,
		`the cursor is at the end of the item above`,
	);
});

test(`Backspace at the start of an item with text joins it to the line above`, () => {
	const view = atStartOf(nested, `d`);
	assert.equal(press(view, `Backspace`), true);
	assert.equal(saved(view), `[list]\n[*]a\n[list]\n[*]b\n[*]cd\n[/list]\n[*]e\n[/list]`);
});

test(`Backspace at the start of an item joins the last line of the item above, also when that item has a list`, () => {
	const view = atStartOf(nested, `e`);
	assert.equal(press(view, `Backspace`), true);
	assert.equal(saved(view), `[list]\n[*]a\n[list]\n[*]b\n[*]c\n[*]de\n[/list]\n[/list]`);
});

test(`Backspace at the start of the first item takes it out of the list, and the text stays`, () => {
	const view = atStartOf(`[list]\n[*]one\n[*]two\n[/list]`, `one`);
	assert.equal(press(view, `Backspace`), true);
	assert.equal(saved(view), `one\n\n[list]\n[*]two\n[/list]`);
});

test(`a list in the item that is joined stays, under the item above`, () => {
	const view = atStartOf(`[list]\n[*]a\n[*]bee\n[list]\n[*]sub\n[/list]\n[/list]`, `bee`);
	assert.equal(press(view, `Backspace`), true);
	assert.equal(saved(view), `[list]\n[*]abee\n[list]\n[*]sub\n[/list]\n[/list]`);
});

test(`Backspace inside the text of an item is left to the browser`, () => {
	assert.equal(press(viewWith(`[list]\n[*]one\n[/list]`, `one`), `Backspace`), false);
});
