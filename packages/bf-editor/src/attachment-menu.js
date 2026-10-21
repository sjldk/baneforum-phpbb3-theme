// The small menu of a picture in the text: change its description or delete it. It is a native
// popover (the Popover API) on a <form>, so the browser handles the layer, Escape and a click
// outside. The markup is in bf-editor.html. This file puts it by the picture and reads the answer.
//
// The editor does not know what a description is for. It tells the host with events on <bf-editor>:
//   bf-attachment-describe  {index, name, description}
//   bf-attachment-remove    {index, name}   (the picture is already out of the text)
import { Plugin } from 'prosemirror-state';

/**
 * @param {object} options
 * @param {ShadowRoot} options.root  the editor's shadow root
 * @param {(name: string, detail: Record<string, unknown>) => void} options.emit  tells the host
 * @param {() => ((index: number) => {src?: string, description?: string, image?: boolean} | null) | null} options.info  what the host knows about a file
 */
export function createAttachmentMenu({ root, emit, info }) {
	const menu = /** @type {HTMLFormElement} */ (root.querySelector(`form[popover]`));
	const field = /** @type {HTMLInputElement} */ (menu.querySelector(`input[name="description"]`));
	/** @type {{view: import('prosemirror-view').EditorView, node: import('prosemirror-model').Node, image: HTMLElement | null} | null} */
	let target = null;

	/** @returns {number} where the picture is now, or -1 */
	function where() {
		let found = -1;

		target?.view.state.doc.descendants((node, position) => {
			if (node === target?.node) {
				found = position;
			}

			return found === -1;
		});

		return found;
	}

	/** Takes the picture out of the text and tells the host. */
	function remove() {
		if (!target) {
			return;
		}

		const { view, node } = target;
		const position = where();

		if (position !== -1) {
			view.dispatch(view.state.tr.delete(position, position + 1));
		}

		close();
		emit(`bf-attachment-remove`, { index: node.attrs.index, name: node.attrs.name });
	}

	/** Gives the picture its description and tells the host. */
	function save() {
		if (!target) {
			return;
		}

		const { node, image } = target;
		const description = field.value.trim();

		if (image instanceof HTMLImageElement) {
			image.alt = description || node.attrs.name;
		}

		close();
		emit(`bf-attachment-describe`, { index: node.attrs.index, name: node.attrs.name, description });
	}

	function close() {
		menu.hidePopover();
		target?.view.focus();
		target = null;
	}

	// Enter in the field saves. Delete is not a submit button, so Enter can never delete.
	menu.addEventListener(`submit`, (event) => {
		event.preventDefault();
		save();
	});
	menu.querySelector(`button[value="remove"]`)?.addEventListener(`click`, remove);

	return {
		/**
		 * Opens the menu under a picture.
		 * @param {import('prosemirror-view').EditorView} view
		 * @param {import('prosemirror-model').Node} node  the attachment node
		 * @param {HTMLElement} anchor  the picture on the screen
		 */
		open(view, node, anchor) {
			target = { view, node, image: anchor.querySelector(`img`) };
			field.value = info()?.(node.attrs.index)?.description ?? ``;
			const box = anchor.getBoundingClientRect();
			menu.style.insetInlineStart = `${Math.max(8, box.left)}px`;
			menu.style.insetBlockStart = `${box.bottom + 6}px`;
			menu.showPopover();
			field.focus();
		},
	};
}

/**
 * Enter on a selected picture opens its menu, so it works without a mouse.
 * @param {ReturnType<typeof createAttachmentMenu>} menu
 */
export function createAttachmentMenuPlugin(menu) {
	return new Plugin({
		props: {
			handleKeyDown(view, event) {
				const { selection } = view.state;
				const node = /** @type {import('prosemirror-state').NodeSelection} */ (selection).node;

				if (event.key !== `Enter` || node?.type.name !== `attachment`) {
					return false;
				}

				const dom = view.nodeDOM(selection.from);

				if (dom instanceof HTMLElement) {
					menu.open(view, node, dom);
				}

				return true;
			},
		},
	});
}
