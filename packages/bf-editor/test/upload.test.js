import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EditorState, TextSelection } from 'prosemirror-state';
import { createMarkdownBBCodeCodec } from '../src/codecs/markdown-bbcode.js';
import { assertImplements } from '../src/contracts.js';
import { schema } from '../src/schema.js';
import { createImageCommand, createUploadPlugin, createUploads } from '../src/upload.js';
import { fakeUploadHandler } from './fakes/fake-upload.js';

const codec = createMarkdownBBCodeCodec(schema);
const png = (name) => new File([`x`], name, { type: `image/png` });
const settle = () => new Promise((resolve) => setImmediate(resolve));

function setup(text, handler, position = 1) {
	const state = EditorState.create({ doc: codec.parse(text) });
	const view = { state: state.apply(state.tr.setSelection(TextSelection.create(state.doc, position))) };
	view.dispatch = (tr) => {
		view.state = view.state.apply(tr);
	};
	const said = [];
	const busy = [];
	const uploads = createUploads({
		schema,
		handler: () => handler,
		announce: (text) => said.push(text),
		onBusy: (count) => busy.push(count),
	});

	return { view, uploads, said, busy };
}

const kinds = (view) => {
	const found = [];
	view.state.doc.descendants((node) => {
		if (node.isInline && !node.isText) {
			found.push(node.type.name);
		}
	});

	return found;
};

test(`the fake handler satisfies the UploadHandler contract`, () => {
	assertImplements(`UploadHandler`, fakeUploadHandler());
});

test(`a file shows at once as an upload and becomes an attachment when the host answers`, async () => {
	const { view, uploads, said } = setup(`hi`, fakeUploadHandler());
	uploads.add(view, [png(`a.png`)]);
	assert.deepEqual(kinds(view), [`upload`]);
	assert.equal(uploads.pending, 1);
	await settle();
	assert.deepEqual(kinds(view), [`attachment`]);
	assert.equal(uploads.pending, 0);
	assert.equal(codec.serialize(view.state.doc), `[attachment=0]a.png[/attachment]hi`);
	assert.deepEqual(said, [`Uploading a.png`, `Uploaded a.png`]);
});

test(`a file that is still going writes nothing to the text`, () => {
	const { view, uploads } = setup(`hi`, { upload: () => new Promise(() => {}) });
	uploads.add(view, [png(`a.png`)]);
	assert.equal(codec.serialize(view.state.doc), `hi`);
});

test(`files that are not images are ignored`, () => {
	const { view, uploads } = setup(`hi`, fakeUploadHandler());
	uploads.add(view, [new File([`x`], `a.pdf`, { type: `application/pdf` })]);
	assert.deepEqual(kinds(view), []);
	assert.equal(uploads.pending, 0);
});

test(`several files keep their order`, async () => {
	const { view, uploads } = setup(``, fakeUploadHandler());
	uploads.add(view, [png(`a.png`), png(`b.png`)]);
	await settle();
	assert.equal(codec.serialize(view.state.doc), `[attachment=0]a.png[/attachment][attachment=0]b.png[/attachment]`);
});

test(`the host can number the other files again`, async () => {
	const handler = {
		upload: async (file) => ({ src: `x`, name: file.name, index: 0, renumber: (index) => index + 1 }),
	};
	const { view, uploads } = setup(`see [attachment=0]old.png[/attachment]`, handler, 1);
	uploads.add(view, [png(`new.png`)]);
	await settle();
	assert.equal(
		codec.serialize(view.state.doc),
		`[attachment=0]new.png[/attachment]see [attachment=1]old.png[/attachment]`,
	);
});

test(`progress goes to the node view that watches the file`, async () => {
	const seen = [];
	const handler = {
		upload: async (file, { onProgress }) => {
			onProgress(0.5);

			return { src: `x`, name: file.name };
		},
	};
	const { view, uploads } = setup(`hi`, handler);
	uploads.watch(`upload-1`, (fraction) => seen.push(fraction));
	uploads.add(view, [png(`a.png`)]);
	await settle();
	assert.deepEqual(seen, [0.5]);
});

test(`a failed upload stays as an error with the host's message and says so`, async () => {
	const handler = {
		upload: async () => {
			throw new Error(`The file is too large.`);
		},
	};
	const { view, uploads, said, busy } = setup(`hi`, handler);
	uploads.add(view, [png(`a.png`)]);
	await settle();
	const node = view.state.doc.firstChild.firstChild;
	assert.equal(node.type.name, `upload`);
	assert.equal(node.attrs.status, `error`);
	assert.equal(node.attrs.message, `The file is too large.`);
	assert.equal(said.at(-1), `Could not upload a.png. The file is too large.`);
	assert.equal(codec.serialize(view.state.doc), `hi`);
	assert.deepEqual(busy, [1, 0]);
});

test(`removing an upload that is going aborts it and takes the node out`, async () => {
	let signal;
	const handler = {
		upload: (_file, options) => {
			signal = options.signal;

			return new Promise(() => {});
		},
	};
	const { view, uploads } = setup(`hi`, handler);
	uploads.add(view, [png(`a.png`)]);
	uploads.remove(view, `upload-1`);
	assert.equal(signal.aborted, true);
	assert.deepEqual(kinds(view), []);
	assert.equal(uploads.pending, 0);
});

test(`an answer that comes after the node was removed changes nothing`, async () => {
	let finish;
	const handler = {
		upload: () =>
			new Promise((resolve) => {
				finish = resolve;
			}),
	};
	const { view, uploads } = setup(`hi`, handler);
	uploads.add(view, [png(`a.png`)]);
	uploads.remove(view, `upload-1`);
	finish({ src: `x`, name: `a.png` });
	await settle();
	assert.deepEqual(kinds(view), []);
});

test(`without a handler uploads are not available and the image command is off`, () => {
	const { view, uploads } = setup(`hi`, null);
	assert.equal(uploads.available, false);
	const command = createImageCommand(uploads, () => assert.fail(`must not open the picker`));
	assert.equal(command.run(view.state), false);
	assert.equal(
		command.run(view.state, () => {}),
		false,
	);
});

test(`with a handler the image command opens the picker`, () => {
	const { view, uploads } = setup(`hi`, fakeUploadHandler());
	let opened = 0;
	const command = createImageCommand(uploads, () => {
		opened += 1;
	});
	assertImplements(`Command`, command);
	assert.equal(command.run(view.state), true);
	assert.equal(opened, 0);
	command.run(view.state, () => {});
	assert.equal(opened, 1);
});

test(`pasting image files starts uploads and other pastes are left alone`, async () => {
	const { view, uploads } = setup(`hi`, fakeUploadHandler());
	const plugin = createUploadPlugin(uploads);
	assert.equal(plugin.props.handlePaste(view, { clipboardData: { files: [png(`a.png`)] } }), true);
	assert.equal(plugin.props.handlePaste(view, { clipboardData: { files: [] } }), false);
	assert.equal(
		plugin.props.handlePaste(view, { clipboardData: { files: [new File([`x`], `a.txt`, { type: `text/plain` })] } }),
		false,
	);
	await settle();
	assert.deepEqual(kinds(view), [`attachment`]);
});

test(`dropped image files start uploads where they were dropped`, async () => {
	const { view, uploads } = setup(`hello`, fakeUploadHandler());
	view.posAtCoords = () => ({ pos: 3 });
	const plugin = createUploadPlugin(uploads);
	let prevented = false;
	const event = {
		dataTransfer: { files: [png(`a.png`)] },
		clientX: 1,
		clientY: 1,
		preventDefault: () => (prevented = true),
	};
	assert.equal(plugin.props.handleDrop(view, event), true);
	assert.equal(prevented, true);
	await settle();
	assert.equal(codec.serialize(view.state.doc), `he[attachment=0]a.png[/attachment]llo`);
});

test(`without a handler a paste of an image is left to the browser`, () => {
	const { view, uploads } = setup(`hi`, null);
	const plugin = createUploadPlugin(uploads);
	assert.equal(plugin.props.handlePaste(view, { clipboardData: { files: [png(`a.png`)] } }), false);
});
