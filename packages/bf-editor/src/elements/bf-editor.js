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
import { createAttachmentMenu } from '../attachment-menu.js';
import { createMarkdownBBCodeCodec } from '../codecs/markdown-bbcode.js';
import { createBasicCommands } from '../commands.js';
import { assertImplements } from '../contracts.js';
import { applyLabels, labelsFor } from '../labels.js';
import { createLinkCommand } from '../link-command.js';
import { createLinkDialog } from '../link-dialog.js';
import { createPlugins } from '../plugins.js';
import { schema } from '../schema.js';
import { template } from '../template.js';
import { Toolbar } from '../toolbar.js';
import { createAttachCommand, createUploads } from '../upload.js';
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
	#root;
	/** @type {Record<string, string>} */
	#words = labelsFor();
	/** @type {import('../contracts.js').UploadHandler | null} */
	#uploadHandler = null;
	#uploads;
	/** @type {((index: number) => {src?: string, description?: string} | null) | null} */
	#attachmentInfo = null;
	#menu;
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
		this.#root = root;
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
			labels: () => this.#words,
			onFiles: (files) => this.dispatchEvent(new CustomEvent(`bf-attach-files`, { bubbles: true, detail: { files } })),
			onBusy: (count) => this.dispatchEvent(new CustomEvent(`bf-uploading`, { bubbles: true, detail: { count } })),
		});
		this.#menu = createAttachmentMenu({
			root,
			emit: (name, detail) => this.dispatchEvent(new CustomEvent(name, { bubbles: true, detail })),
			info: () => this.#attachmentInfo,
		});
		this.#nodeViews = createNodeViews(
			root,
			this.#uploads,
			() => this.#words,
			() => this.#attachmentInfo,
			this.#menu,
		);
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

		this.labels = {};

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
					'aria-label': this.getAttribute(`label`) ?? this.#words.message,
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
			...(have.has(`attach`) ? [] : [createAttachCommand(this.#uploads, () => this.#picker.click())]),
		];
	}

	/**
	 * Words that replace the built in ones (see labels.js). The page language chooses the rest.
	 * @param {Record<string, string>} overrides
	 */
	set labels(overrides) {
		this.#words = labelsFor(document.documentElement.lang, overrides);
		applyLabels(this.#root, this.#words);
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

	/** @param {string} key  a word the editor uses, see labels.js */
	labelFor(key) {
		return this.#words[key] ?? ``;
	}

	/**
	 * Tells the editor what the host knows about a file that came with the text, as
	 * `[attachment=2]name[/attachment]`: where to show it from and its description.
	 * Without it such a file shows as its name.
	 * @param {((index: number) => {src?: string, description?: string} | null) | null} info
	 */
	set attachmentInfo(info) {
		this.#attachmentInfo = info;
	}

	/**
	 * Puts a file that is already on the host at the cursor.
	 * @param {{index: number, name: string, src?: string}} file
	 */
	insertAttachment({ index, name, src = `` }) {
		const view = this.#view;

		if (view) {
			view.dispatch(view.state.tr.replaceSelectionWith(schema.nodes.attachment.create({ index, name, src })));
			view.focus();
		}
	}

	/**
	 * Which files the picker offers, as the `accept` attribute of a file field (".pdf,.zip" or "image/*").
	 * Empty means every file.
	 * @param {string} types
	 */
	set accept(types) {
		this.#picker.accept = types;
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
			plugins: createPlugins(schema, this.#commands, { uploads: this.#uploads, menu: this.#menu }),
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
