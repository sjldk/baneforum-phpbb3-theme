// How the picture nodes look inside the editing surface. The markup is in the <template>
// elements of bf-editor.html. This file clones them and keeps them up to date.
import { format } from './labels.js';

/**
 * The node views for the upload and attachment nodes. A node view draws the node with the template, not with
 * the schema's default markup, so it can show progress, errors and the menu.
 * @param {ShadowRoot} root  the editor's shadow root, which holds the templates
 * @param {ReturnType<import('./upload.js').createUploads>} uploads
 * @param {() => Record<string, string>} labels  the words to use, see labels.js
 * @param {() => ((index: number) => {src?: string, description?: string, image?: boolean} | null) | null} info  what the host knows about a file that came with the text
 * @param {ReturnType<import('./attachment-menu.js').createAttachmentMenu>} menu  the small menu of a picture
 */
export function createNodeViews(root, uploads, labels, info, menu) {
	/** @param {string} id @returns {HTMLElement} */
	const clone = (id) =>
		/** @type {HTMLElement} */ (
			/** @type {DocumentFragment} */ (
				/** @type {HTMLTemplateElement} */ (root.querySelector(`template#${id}`)).content.cloneNode(true)
			).firstElementChild
		);

	return {
		/** @type {import('prosemirror-view').NodeViewConstructor} */
		upload(node, view) {
			const dom = clone(`upload`);
			const image = /** @type {HTMLImageElement} */ (dom.querySelector(`img`));
			const progress = /** @type {HTMLProgressElement} */ (dom.querySelector(`progress`));
			const message = /** @type {HTMLOutputElement} */ (dom.querySelector(`output`));
			const remove = /** @type {HTMLButtonElement} */ (dom.querySelector(`button`));
			remove.addEventListener(`click`, () => uploads.remove(view, node.attrs.id));
			uploads.watch(node.attrs.id, (fraction) => {
				progress.value = fraction;
			});

			/** @param {import('prosemirror-model').Node} current */
			const render = (current) => {
				dom.dataset.status = current.attrs.status;
				image.src = current.attrs.src;
				image.alt = current.attrs.name;
				message.textContent =
					current.attrs.status === `error` ? format(labels().uploadError, { message: current.attrs.message }) : ``;
				remove.textContent = current.attrs.status === `error` ? labels().uploadRemove : labels().uploadCancel;
			};
			render(node);

			return {
				dom,
				update(updated) {
					if (updated.type !== node.type || updated.attrs.id !== node.attrs.id) {
						return false;
					}

					render(updated);

					return true;
				},
				ignoreMutation: () => true,
				stopEvent: (event) => event.target === remove,
			};
		},

		/** @type {import('prosemirror-view').NodeViewConstructor} */
		attachment(node, view) {
			const dom = clone(`attachment`);
			const image = /** @type {HTMLImageElement} */ (dom.querySelector(`img`));
			const name = /** @type {HTMLElement} */ (dom.querySelector(`.name`));
			const known = info()?.(node.attrs.index);
			// A file that is not a picture shows as its name.
			const isImage = known?.image ?? node.attrs.image;
			const src = isImage ? node.attrs.src || known?.src || `` : ``;
			image.hidden = src === ``;
			image.src = src;
			image.alt = known?.description || node.attrs.name;
			name.textContent = src === `` ? node.attrs.name : ``;
			dom.addEventListener(`click`, () => menu.open(view, node, dom));

			return { dom, ignoreMutation: () => true };
		},
	};
}
