// The small menu of a picture in the text: change its description or delete it. It is a bar like the
// table bar. It floats under the picture inside the editor, so it scrolls with the text. The markup is
// in bf-editor.html. This file puts it by the picture, closes it on Escape and on a click outside, and
// reads the answer.
//
// The editor does not know what a description is for. It tells the host with events on <bf-editor>:
//   bf-attachment-describe  {index, name, description}
//   bf-attachment-remove    {index, name}   (the picture is already out of the text)
import { Plugin } from 'prosemirror-state';

/**
 * Builds the menu from the markup in the page. It keeps the picture it was opened for, so a save or a delete
 * acts on that picture, also if the text has moved on.
 * @param {object} options
 * @param {ShadowRoot} options.root  the editor's shadow root
 * @param {(name: string, detail: Record<string, unknown>, cancelable?: boolean) => boolean} options.emit  tells the host, false if the host cancelled it
 * @param {() => ((index: number) => {src?: string, description?: string, image?: boolean} | null) | null} options.info  what the host knows about a file
 */
export function createAttachmentMenu({ root, emit, info }) {
	const menu = /** @type {HTMLFormElement} */ (root.querySelector(`form.attachment-menu`));
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

	/**
	 * Asks the host first. A host that wants to ask the writer cancels the request and calls `proceed` when the answer is yes.
	 * Without a host that cancels it, the picture goes at once.
	 */
	function remove() {
		if (!target) {
			return;
		}

		const picked = target;
		const { node } = picked;
		const proceed = () => take(picked);

		if (emit(`bf-attachment-remove-request`, { index: node.attrs.index, name: node.attrs.name, proceed }, true)) {
			proceed();
		} else {
			hide();
		}
	}

	/**
	 * Takes the picture out of the text and tells the host.
	 * @param {NonNullable<typeof target>} picked
	 */
	function take(picked) {
		target = picked;
		const { view, node } = picked;
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

	function hide() {
		menu.hidden = true;
	}

	function close() {
		hide();
		target?.view.focus();
		target = null;
	}

	// Enter in the field saves. Delete is not a submit button, so Enter can never delete.
	menu.addEventListener(`submit`, (event) => {
		event.preventDefault();
		save();
	});
	menu.querySelector(`button[value="remove"]`)?.addEventListener(`click`, remove);
	menu.addEventListener(`keydown`, (event) => {
		if (event.key === `Escape` && target) {
			event.stopPropagation();
			close();
		}
	});
	// A click anywhere else closes the menu without saving. A click on a picture opens it again.
	document.addEventListener(`pointerdown`, (event) => {
		if (!menu.hidden && !event.composedPath().includes(menu)) {
			hide();
			target = null;
		}
	});

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
			field.placeholder = field.getAttribute(`aria-label`) ?? ``;
			menu.hidden = false;
			const surface = (menu.offsetParent ?? menu.parentElement)?.getBoundingClientRect();
			const box = anchor.getBoundingClientRect();

			if (surface) {
				// Under the picture. At the bottom of the text there is no room under it (the page may cut it off), so it
				// goes above it, or, if the picture fills the editor, over the lower edge of the picture.
				const height = menu.offsetHeight;
				const below = box.bottom - surface.top + 4;
				const above = box.top - surface.top - height - 4;
				const top =
					below + height <= surface.height ? below : above >= 0 ? above : Math.max(0, surface.height - height - 4);
				menu.style.insetBlockStart = `${top}px`;
				menu.style.insetInlineStart = `${Math.max(0, Math.min(box.left - surface.left, surface.width - menu.offsetWidth))}px`;
			}

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
