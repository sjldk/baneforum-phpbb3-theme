// Typing rules: **bold**, *italic*, ~~strike~~, smilie codes and "> " change the text as you type.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EditorState, TextSelection } from 'prosemirror-state';
import { createBBCodeCodec } from '../src/codecs/bbcode.js';
import { createBasicCommands } from '../src/commands.js';
import { createPlugins } from '../src/plugins.js';
import { schema } from '../src/schema.js';

const codec = createBBCodeCodec(schema);
const plugins = createPlugins(schema, createBasicCommands(schema));

/** Types text one character at a time, the way the browser reports it, and returns the saved text. */
function type(text, start = ``) {
	const view = {
		state: EditorState.create({ doc: codec.parse(start), plugins }),
		composing: false,
		dispatch(tr) {
			this.state = this.state.apply(tr);
		},
	};
	view.state = view.state.apply(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));

	for (const character of text) {
		const { from, to } = view.state.selection;
		const handled = plugins.some((plugin) =>
			plugin.props.handleTextInput?.(view, from, to, character, () => view.state.tr.insertText(character, from, to)),
		);

		if (!handled) {
			view.dispatch(view.state.tr.insertText(character, from, to));
		}
	}

	return codec.serialize(view.state.doc);
}

test(`typing **word** makes bold`, () => {
	assert.equal(type(`say **hello**`), `say [b]hello[/b]`);
	assert.equal(type(`**hello**`).includes(`[b]hello[/b]`), true);
});

test(`typing *word* makes italic`, () => {
	assert.equal(type(`a *b*`), `a [i]b[/i]`);
});

test(`typing ~~word~~ makes strikethrough`, () => {
	assert.equal(type(`a ~~b~~`), `a [s]b[/s]`);
});

test(`a smilie code followed by a space becomes an emoji`, () => {
	assert.equal(type(`hi :) there`), `hi 🙂 there`);
	assert.equal(type(`:D `), `😀 `);
});

test(`a smilie code inside a word is not changed`, () => {
	assert.equal(type(`a:) b`), `a:) b`);
});

test(`"> " at the start makes a quote`, () => {
	assert.equal(type(`> quoted`), `[quote]\nquoted\n[/quote]`);
});
