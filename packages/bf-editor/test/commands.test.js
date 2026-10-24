import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EditorState, TextSelection } from 'prosemirror-state';
import { createBBCodeCodec } from '../src/codecs/bbcode.js';
import { createBasicCommands } from '../src/commands.js';
import { assertImplements } from '../src/contracts.js';
import { createPlugins } from '../src/plugins.js';
import { schema } from '../src/schema.js';

const codec = createBBCodeCodec(schema);
const commands = createBasicCommands(schema);
const byId = (id) => commands.find((command) => command.id === id);

/** A state with the text selected from `from` to `to` (1 is the start of the first paragraph). */
function stateWith(text, from, to = from) {
	const state = EditorState.create({ doc: codec.parse(text), plugins: createPlugins(schema, commands) });

	return state.apply(state.tr.setSelection(TextSelection.create(state.doc, from, to)));
}

function run(id, state) {
	let next = state;
	byId(id).run(state, (tr) => {
		next = state.apply(tr);
	});

	return next;
}

test(`every basic command satisfies the Command contract`, () => {
	for (const command of commands) {
		assertImplements(`Command`, command);
	}

	assert.deepEqual(
		commands.map((command) => command.id),
		[`bold`, `italic`, `strike`, `normal`, `quote`, `bullet-list`, `numbered-list`],
	);
});

test(`bold wraps the selection and is reported as on`, () => {
	const state = run(`bold`, stateWith(`hello world`, 1, 6));
	assert.equal(codec.serialize(state.doc), `[b]hello[/b] world`);
	assert.equal(byId(`bold`).isActive(state), true);
});

test(`bold again turns it off`, () => {
	const once = run(`bold`, stateWith(`hello world`, 1, 6));
	const twice = run(`bold`, once);
	assert.equal(codec.serialize(twice.doc), `hello world`);
});

test(`italic and strikethrough write their BBCode`, () => {
	assert.equal(codec.serialize(run(`italic`, stateWith(`a b`, 1, 2)).doc), `[i]a[/i] b`);
	assert.equal(codec.serialize(run(`strike`, stateWith(`a b`, 1, 2)).doc), `[s]a[/s] b`);
});

test(`normal text removes all formatting from the selection`, () => {
	const state = run(`normal`, stateWith(`[b]a[/b] [i]b[/i]`, 1, 4));
	assert.equal(codec.serialize(state.doc), `a b`);
});

test(`quote wraps the paragraph and lifts it again`, () => {
	const quoted = run(`quote`, stateWith(`hello`, 2));
	assert.equal(quoted.doc.firstChild.type.name, `blockquote`);
	assert.equal(byId(`quote`).isActive(quoted), true);
	const lifted = run(`quote`, quoted);
	assert.equal(lifted.doc.firstChild.type.name, `paragraph`);
});

test(`every command has a keyboard shortcut except where none is set`, () => {
	assert.deepEqual(
		commands.map((command) => command.shortcut),
		[`Mod-b`, `Mod-i`, `Mod-Shift-x`, `Mod-Shift-0`, `Mod-Shift-q`, `Mod-Shift-8`, `Mod-Shift-7`],
	);
});
