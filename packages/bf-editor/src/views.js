// How the picture nodes look inside the editing surface. The markup is in the <template>
// elements of bf-editor.html. This file clones them and keeps them up to date.

/**
 * @param {ShadowRoot} root  the editor's shadow root, which holds the templates
 * @param {ReturnType<import('./upload.js').createUploads>} uploads
 */
export function createNodeViews(root, uploads) {
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
				message.textContent = current.attrs.status === `error` ? `Could not upload: ${current.attrs.message}` : ``;
				remove.textContent = current.attrs.status === `error` ? `Remove` : `Cancel`;
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
		attachment(node) {
			const dom = clone(`attachment`);
			const image = /** @type {HTMLImageElement} */ (dom.querySelector(`img`));
			const name = /** @type {HTMLElement} */ (dom.querySelector(`.name`));
			image.hidden = node.attrs.src === ``;
			image.src = node.attrs.src;
			image.alt = node.attrs.name;
			name.textContent = node.attrs.src === `` ? node.attrs.name : ``;

			return { dom, ignoreMutation: () => true };
		},
	};
}
