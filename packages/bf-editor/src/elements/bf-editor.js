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
import { createPlugins } from '../plugins.js';
import { schema } from '../schema.js';
import { Toolbar } from '../toolbar.js';

let counter = 0;

/** @typedef {import('../contracts.js').Command & {shortcut?: string, toggle?: boolean}} EditorCommand */

export class BfEditor extends HTMLElement {
	/** @type {EditorView | null} */
	#view = null;
	/** @type {import('../contracts.js').Codec} */
	#codec = createMarkdownBBCodeCodec(schema);
	/** @type {EditorCommand[]} */
	#commands = createBasicCommands(schema);
	#value = '';
	/** @type {Toolbar | null} */
	#toolbar = null;

	/** Builds the toolbar and the editing surface when the element is added to a page. */
	connectedCallback() {
		if (this.#view) {
			return;
		}

		counter += 1;
		const id = `bf-editable-${counter}`;
		const toolbar = new Toolbar(document);
		toolbar.controls(id);
		toolbar.items = this.#commands.map(({ id: commandId, label, shortcut, toggle }) => ({
			id: commandId,
			label,
			shortcut,
			toggle: toggle ?? false,
		}));
		toolbar.element.addEventListener('bf-command', (event) => this.#run(/** @type {CustomEvent} */ (event).detail.id));
		this.#toolbar = toolbar;

		const editable = document.createElement('bf-editable');
		editable.id = id;
		const placeholder = this.getAttribute('placeholder');

		if (placeholder !== null) {
			editable.dataset.placeholder = placeholder;
		}

		this.replaceChildren(toolbar.element, editable);

		const view = new EditorView(
			{ mount: editable },
			{
				state: this.#createState(this.#value),
				attributes: {
					role: 'textbox',
					'aria-multiline': 'true',
					'aria-label': this.getAttribute('label') ?? 'Message',
					spellcheck: 'true',
				},
				dispatchTransaction: (transaction) => {
					const state = view.state.apply(transaction);
					view.updateState(state);
					this.#syncToolbar(state);

					if (transaction.docChanged) {
						this.dispatchEvent(new CustomEvent('bf-change', { bubbles: true }));
					}
				},
			},
		);
		this.#view = view;
		this.#syncToolbar(view.state);
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
		this.#codec = /** @type {import('../contracts.js').Codec} */ (assertImplements('Codec', codec));
	}

	/**
	 * The toolbar actions. Set them before the element is added.
	 * @param {EditorCommand[]} commands
	 */
	set commands(commands) {
		this.#commands = commands.map((command) => /** @type {EditorCommand} */ (assertImplements('Command', command)));
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
			plugins: createPlugins(schema, this.#commands),
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
