// <bf-editor>: the toolbar and the editing surface together.
//
//   <bf-editor label="Message" placeholder="Write here"></bf-editor>
//
// Everything it needs is passed in (dependency inversion):
//   editor.codec     a Codec, turns text into a document and back (default: BBCode)
//   editor.commands  extra toolbar actions
// It tells the host about changes with a "bf-change" event. Read the text from `editor.value`.
import { Slice } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { createAttachmentMenu } from '../attachment-menu.js';
import { createBBCodeCodec } from '../codecs/bbcode.js';
import { createBasicCommands } from '../commands.js';
import { assertImplements } from '../contracts.js';
import { applyLabels, format, labelsFor } from '../labels.js';
import { createLinkCommand } from '../link-command.js';
import { createLinkDialog } from '../link-dialog.js';
import { createPlugins } from '../plugins.js';
import { MAX_TABLE_COLUMNS, MAX_TABLE_ROWS, schema } from '../schema.js';
import { createTableCommands } from '../table-commands.js';
import { createTablePicker } from '../table-picker.js';
import { template } from '../template.js';
import { Toolbar } from '../toolbar.js';
import { createAttachCommand, createUploads } from '../upload.js';
import { createNodeViews } from '../views.js';

/** @typedef {import('../contracts.js').Command & {shortcut?: string, toggle?: boolean}} EditorCommand */

/** The custom element. It builds the shadow root, the toolbars and the ProseMirror view, and keeps them in step. */
export class BfEditor extends HTMLElement {
	/**
	 * The ProseMirror view. It is null until the element is in a page, and again after it leaves.
	 * @type {EditorView | null}
	 */
	#view = null;
	/**
	 * Turns text into a document and back.
	 * @type {import('../contracts.js').Codec}
	 */
	#codec = createBBCodeCodec(schema);
	/** The text set before the view exists. The view takes over the text once it is made. */
	#value = ``;
	/** The formatting toolbar. */
	#toolbar;
	/** The floating toolbar that shows while the cursor is in a table. */
	#tableBar;
	/** The small form that asks how many rows and columns a new table gets. */
	#tablePicker;
	/** The dialog that asks for the address of a link. */
	#linkDialog;
	/** The element that holds the editing surface. */
	#editable;
	/** The shadow root. Ids and styles in it are private to this editor. */
	#root;
	/**
	 * The words for buttons and messages, in the page language.
	 * @type {Record<string, string>}
	 */
	#words = labelsFor();
	/**
	 * Sends files to the host. Null means no uploads.
	 * @type {import('../contracts.js').UploadHandler | null}
	 */
	#uploadHandler = null;
	/** Does the work of adding files: placeholders, the upload and the count of files still on their way. */
	#uploads;
	/**
	 * Asks the host where to show an attachment from. Null means the host knows nothing, so the name shows.
	 * @type {((index: number) => {src?: string, description?: string} | null) | null}
	 */
	#attachmentInfo = null;
	/** The small menu on an image or file in the text. */
	#menu;
	/** The hidden file field. A toolbar button opens it. */
	#picker;
	/** A hidden output element. Screen readers read what is written to it. */
	#status;
	/** How images, files and videos are drawn in the editing surface. */
	#nodeViews;
	/**
	 * The toolbar actions, with the built in ones added.
	 * @type {EditorCommand[]}
	 */
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
		this.#toolbar = new Toolbar(/** @type {HTMLMenuElement} */ (root.querySelector(`menu[data-label="formatting"]`)));
		this.#toolbar.controls(`editable`);
		this.#tableBar = new Toolbar(/** @type {HTMLMenuElement} */ (root.querySelector(`menu.table-bar`)));
		this.#tableBar.controls(`editable`);
		this.#tablePicker = createTablePicker(
			/** @type {HTMLFormElement} */ (root.querySelector(`form.table-picker`)),
			() => this.#words,
			() => root.querySelector(`button[command="--table"]`),
		);
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
			emit: (name, detail, cancelable = false) =>
				this.dispatchEvent(new CustomEvent(name, { bubbles: true, cancelable, detail })),
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
			...(have.has(`table`) ? [] : createTableCommands(schema, { ask: () => this.#tablePicker.ask() })),
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

	/**
	 * The word the editor uses for a key, in the page language. A host can use it to match the editor's wording.
	 * @param {string} key  a word the editor uses, see labels.js
	 */
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

	/**
	 * Replaces the whole content. Before the element is in a page, the text is kept until the view exists.
	 * @param {string} text
	 */
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

	/**
	 * Puts the cursor on the last line, ready to write. If the text ends in a block that cannot be left with
	 * the keyboard (a quote), an empty paragraph is added after it, so the writer has a line outside it.
	 */
	focusEnd() {
		const view = this.#view;

		if (!view) {
			return;
		}

		let transaction = view.state.tr;

		if (view.state.doc.lastChild?.type !== schema.nodes.paragraph) {
			transaction = transaction.insert(view.state.doc.content.size, schema.nodes.paragraph.create());
		}

		view.dispatch(transaction.setSelection(TextSelection.atEnd(transaction.doc)).scrollIntoView());
		view.focus();
	}

	/**
	 * Puts text (in the codec's format, for example a quote) at the cursor. The cursor ends after it. If it ends in a
	 * quote, an empty paragraph follows, so the writer has a line outside the quote.
	 * @param {string} text
	 */
	insertText(text) {
		const view = this.#view;

		if (!view) {
			return;
		}

		let transaction = view.state.tr.replaceSelection(new Slice(this.#codec.parse(text).content, 0, 0));
		const { $head } = transaction.selection;

		for (let depth = $head.depth; depth > 0; depth--) {
			if ($head.node(depth).type === schema.nodes.blockquote) {
				const after = $head.after(depth);

				transaction = transaction.insert(after, schema.nodes.paragraph.create());
				transaction = transaction.setSelection(TextSelection.create(transaction.doc, after + 1));
				break;
			}
		}

		view.dispatch(transaction.scrollIntoView());
		view.focus();
		// A click on a link that jumps to the editor takes the focus when it ends, after this call. Take it back.
		setTimeout(() => view.focus(), 0);
	}

	/** The ProseMirror view, for hosts that need to reach in. */
	get view() {
		return this.#view;
	}

	/**
	 * A fresh editor state for the text. A new state also drops the undo history, which suits a new content.
	 * @param {string} text
	 */
	#createState(text) {
		return EditorState.create({
			doc: this.#codec.parse(text),
			plugins: createPlugins(schema, this.#commands, {
				uploads: this.#uploads,
				menu: this.#menu,
				onTableCut: () => {
					this.#status.textContent = format(this.#words.tableCut, {
						columns: String(MAX_TABLE_COLUMNS),
						rows: String(MAX_TABLE_ROWS),
					});
				},
			}),
		});
	}

	/**
	 * Runs the toolbar command with this id on the text, then gives the focus back to the text.
	 * @param {string} id
	 */
	#run(id) {
		const view = this.#view;
		const command = this.#commands.find((candidate) => candidate.id === id);

		if (!command || !view) {
			return;
		}

		command.run(view.state, view.dispatch, view);
		view.focus();
	}

	/**
	 * Shows which buttons are on or unavailable for the state, and shows the table bar only inside a table.
	 * @param {import('prosemirror-state').EditorState} state
	 */
	#syncToolbar(state) {
		const buttons = {
			active: this.#commands.filter((command) => command.isActive?.(state)).map((command) => command.id),
			disabled: this.#commands.filter((command) => !command.run(state)).map((command) => command.id),
		};
		this.#toolbar?.setState(buttons);
		this.#tableBar?.setState(buttons);

		// The table bar shows while the cursor is in a table, and its buttons are all on or all off with it.
		const bar = this.#root.querySelector(`menu.table-bar`);

		if (bar instanceof HTMLElement) {
			bar.hidden = !this.#commands.some((command) => command.id === `table` && command.isActive?.(state));
			this.#placeTableBar(bar, state);
		}
	}

	/**
	 * Puts the table bar just under the table that the cursor is in, at the left edge of the table.
	 * The bar floats, so nothing else moves.
	 * @param {HTMLElement} bar
	 * @param {import('prosemirror-state').EditorState} state
	 */
	#placeTableBar(bar, state) {
		const view = this.#view;

		if (bar.hidden || !view) {
			return;
		}

		const { $from } = state.selection;

		for (let depth = $from.depth; depth > 0; depth -= 1) {
			if ($from.node(depth).type === schema.nodes.table) {
				const table = view.nodeDOM($from.before(depth));

				if (table instanceof HTMLElement && bar.parentElement) {
					const surface = bar.parentElement.getBoundingClientRect();
					const box = table.getBoundingClientRect();
					bar.style.insetBlockStart = `${box.bottom - surface.top + 4}px`;
					bar.style.insetInlineStart = `${Math.max(0, box.left - surface.left)}px`;
				}

				return;
			}
		}
	}
}
