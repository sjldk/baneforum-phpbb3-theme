// <bf-editor>: the toolbar and the editing surface together.
//
//   <bf-editor label="Message" placeholder="Write here"></bf-editor>
//
// Everything it needs is passed in (dependency inversion):
//   editor.codec     a Codec, turns text into a document and back (default: Markdown with BBCode)
//   editor.commands  extra toolbar actions
// It tells the host about changes with a "bf-change" event. Read the text from `editor.value`.
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { createMarkdownBBCodeCodec } from '../codecs/markdown-bbcode.js';
import { createBasicCommands } from '../commands.js';
import { assertImplements } from '../contracts.js';
import { createLinkCommand } from '../link-command.js';
import { createLinkDialog } from '../link-dialog.js';
import { createPlugins } from '../plugins.js';
import { schema } from '../schema.js';
import { template } from '../template.js';
import { Toolbar } from '../toolbar.js';
import { createImageCommand, createUploadPlugin, createUploads } from '../upload.js';
import { createNodeViews } from '../views.js';

/** @typedef {import('../contracts.js').Command & {shortcut?: string, toggle?: boolean}} EditorCommand */

export class BfEditor extends HTMLElement {
	/** @type {EditorView | null} */
	#view = null;
	/** @type {import('../contracts.js').Codec} */
	#codec = createMarkdownBBCodeCodec(schema);
	#value = ``;
	#toolbar;
	#linkDialog;
	#editable;
	/** @type {import('../contracts.js').UploadHandler | null} */
	#uploadHandler = null;
	#uploads;
	#picker;
	#status;
	#nodeViews;
	/** @type {EditorCommand[]} */
	#commands;

	constructor() {
		super();
		// The markup and styles are one template in a shadow root, so ids are private to this editor
		// and the page's CSS does not reach in.
		const root = this.attachShadow({ mode: `open` });
		root.innerHTML = template;
		this.#editable = /** @type {HTMLElement} */ (root.querySelector(`bf-editable`));
		this.#editable.id = `editable`;
		this.#editable.addEventListener(`command`, (event) => {
			const { command } = /** @type {Event & {command?: string}} */ (event);

			if (command?.startsWith(`--`)) {
				this.#run(command.slice(2));
			}
		});
		this.#toolbar = new Toolbar(/** @type {HTMLMenuElement} */ (root.querySelector(`menu`)));
		this.#toolbar.controls(`editable`);
		this.#linkDialog = createLinkDialog(/** @type {HTMLDialogElement} */ (root.querySelector(`dialog`)));
		this.#picker = /** @type {HTMLInputElement} */ (root.querySelector(`input[type="file"]`));
		this.#status = /** @type {HTMLElement} */ (root.querySelector(`output.visually-hidden`));
		this.#uploads = createUploads({
			schema,
			handler: () => this.#uploadHandler,
			announce: (text) => {
				this.#status.textContent = text;
			},
			onBusy: (count) => this.dispatchEvent(new CustomEvent(`bf-uploading`, { bubbles: true, detail: { count } })),
		});
		this.#nodeViews = createNodeViews(root, this.#uploads);
		this.#picker.addEventListener(`change`, () => {
			if (this.#view) {
				this.#uploads.add(this.#view, [...(this.#picker.files ?? [])]);
			}

			this.#picker.value = ``;
		});
		this.#commands = this.#withBuiltIns(createBasicCommands(schema));
	}

	/** Puts the editing surface in place when the element is added to a page. */
	connectedCallback() {
		if (this.#view) {
			return;
		}

		const placeholder = this.getAttribute(`placeholder`);

		if (placeholder !== null) {
			this.#editable.dataset.placeholder = placeholder;
		}

		const view = new EditorView(
			{ mount: this.#editable },
			{
				nodeViews: this.#nodeViews,
				state: this.#createState(this.#value),
				attributes: {
					role: `textbox`,
					'aria-multiline': `true`,
					'aria-label': this.getAttribute(`label`) ?? `Message`,
					spellcheck: `true`,
				},
				dispatchTransaction: (transaction) => {
					const state = view.state.apply(transaction);
					view.updateState(state);
					this.#syncToolbar(state);

					if (transaction.docChanged) {
						this.dispatchEvent(new CustomEvent(`bf-change`, { bubbles: true }));
					}
				},
			},
		);
		this.#view = view;
		this.#syncToolbar(view.state);
	}

	/**
	 * The commands plus the link and image commands, which need the dialog and the file picker of this editor.
	 * @param {EditorCommand[]} commands
	 * @returns {EditorCommand[]}
	 */
	#withBuiltIns(commands) {
		const have = new Set(commands.map((command) => command.id));

		return [
			...commands,
			...(have.has(`link`) ? [] : [createLinkCommand(schema, { ask: (current) => this.#linkDialog.ask(current) })]),
			...(have.has(`image`) ? [] : [createImageCommand(this.#uploads, () => this.#picker.click())]),
		];
	}

	/**
	 * Sends the files for images. Without it the Image button stays off and pasted images are ignored.
	 * @param {import('../contracts.js').UploadHandler | null} handler
	 */
	set uploadHandler(handler) {
		this.#uploadHandler =
			handler === null
				? null
				: /** @type {import('../contracts.js').UploadHandler} */ (assertImplements(`UploadHandler`, handler));

		if (this.#view) {
			this.#syncToolbar(this.#view.state);
		}
	}

	/** How many files are still on their way. Wait for 0 before the form is sent. */
	get uploading() {
		return this.#uploads.pending;
	}

	/** Removes the editor again when the element leaves the page. */
	disconnectedCallback() {
		this.#view?.destroy();
		this.#view = null;
	}

	/**
	 * The codec that turns text into a document and back. Set it before the element is added.
	 * @param {import('../contracts.js').Codec} codec
	 */
	set codec(codec) {
		this.#codec = /** @type {import('../contracts.js').Codec} */ (assertImplements(`Codec`, codec));
	}

	/**
	 * The toolbar actions. Set them before the element is added.
	 * @param {EditorCommand[]} commands
	 */
	set commands(commands) {
		this.#commands = this.#withBuiltIns(
			commands.map((command) => /** @type {EditorCommand} */ (assertImplements(`Command`, command))),
		);
	}

	/** The text to save, written by the codec. */
	get value() {
		return this.#view ? this.#codec.serialize(this.#view.state.doc) : this.#value;
	}

	/** @param {string} text  Replaces the whole content. */
	set value(text) {
		this.#value = text;

		if (this.#view) {
			this.#view.updateState(this.#createState(text));
		}
	}

	/** Puts the cursor in the editing surface. */
	focus() {
		this.#view?.focus();
	}

	/** The ProseMirror view, for hosts that need to reach in. */
	get view() {
		return this.#view;
	}

	/** @param {string} text */
	#createState(text) {
		return EditorState.create({
			doc: this.#codec.parse(text),
			plugins: createPlugins(schema, this.#commands, { uploads: this.#uploads }),
		});
	}

	/** @param {string} id */
	#run(id) {
		const view = this.#view;
		const command = this.#commands.find((candidate) => candidate.id === id);

		if (!command || !view) {
			return;
		}

		command.run(view.state, view.dispatch, view);
		view.focus();
	}

	/** @param {import('prosemirror-state').EditorState} state */
	#syncToolbar(state) {
		this.#toolbar?.setState({
			active: this.#commands.filter((command) => command.isActive?.(state)).map((command) => command.id),
			disabled: this.#commands.filter((command) => !command.run(state)).map((command) => command.id),
		});
	}
}
