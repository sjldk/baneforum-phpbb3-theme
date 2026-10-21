// Adding images: pick, paste or drop a file, see it at once, and let it go to the host in the
// background. The editor knows nothing about the host. It asks an UploadHandler (contracts.js).
//
// While a file goes, the document holds an `upload` node (a local preview, no saved text).
// When the host answers, that node becomes an `attachment` node. If it fails, the node stays
// as an error until the writer removes it.
import { Plugin } from 'prosemirror-state';

/** @param {DataTransfer | null | undefined} data */
function imageFiles(data) {
	return [...(data?.files ?? [])].filter((file) => file.type.startsWith(`image/`));
}

/**
 * @param {object} options
 * @param {import('prosemirror-model').Schema} options.schema
 * @param {() => import('./contracts.js').UploadHandler | null} options.handler  the handler now in use, or null
 * @param {(text: string) => void} options.announce  says something to screen readers
 * @param {(count: number) => void} [options.onBusy]  called when the number of running uploads changes
 */
export function createUploads({ schema, handler, announce, onBusy }) {
	let counter = 0;
	/** @type {Map<string, AbortController>} */
	const running = new Map();
	/** @type {Map<string, (fraction: number) => void>} */
	const progressViews = new Map();

	const busy = () => onBusy?.(running.size);

	/**
	 * @param {import('prosemirror-view').EditorView} view
	 * @param {string} id
	 * @returns {number} where the upload node is, or -1
	 */
	function find(view, id) {
		let found = -1;
		view.state.doc.descendants((node, position) => {
			if (node.type === schema.nodes.upload && node.attrs.id === id) {
				found = position;
			}

			return found === -1;
		});

		return found;
	}

	/**
	 * @param {import('prosemirror-view').EditorView} view
	 * @param {string} id
	 * @param {File} file
	 */
	async function send(view, id, file) {
		const uploadHandler = handler();
		const controller = new AbortController();
		running.set(id, controller);
		busy();

		try {
			if (!uploadHandler) {
				throw new Error(`Uploading is not available here.`);
			}

			const result = await uploadHandler.upload(file, {
				onProgress: (fraction) => progressViews.get(id)?.(fraction),
				signal: controller.signal,
			});
			const position = find(view, id);

			if (position === -1) {
				return;
			}

			const tr = view.state.tr;

			// The host may number the files again when it adds one (phpBB puts the newest first).
			if (result.renumber) {
				const renumber = result.renumber;
				view.state.doc.descendants((node, at) => {
					if (node.type === schema.nodes.attachment) {
						tr.setNodeMarkup(at, undefined, { ...node.attrs, index: renumber(node.attrs.index) });
					}
				});
			}

			tr.replaceWith(
				position,
				position + 1,
				schema.nodes.attachment.create({ index: result.index ?? 0, name: result.name, src: result.src }),
			);
			view.dispatch(tr);
			announce(`Uploaded ${result.name}`);
		} catch (error) {
			if (controller.signal.aborted) {
				return;
			}

			const position = find(view, id);
			const message = error instanceof Error ? error.message : String(error);

			if (position !== -1) {
				const node = view.state.doc.nodeAt(position);
				view.dispatch(view.state.tr.setNodeMarkup(position, undefined, { ...node?.attrs, status: `error`, message }));
			}

			announce(`Could not upload ${file.name}. ${message}`);
		} finally {
			running.delete(id);
			progressViews.delete(id);
			busy();
		}
	}

	return {
		/** True if a handler is set, so adding images works. */
		get available() {
			return handler() !== null;
		},

		/** How many files are on their way. */
		get pending() {
			return running.size;
		},

		/**
		 * Shows the files at once and sends them in the background.
		 * @param {import('prosemirror-view').EditorView} view
		 * @param {File[]} files
		 * @param {number} [at]  where to put them. Default: the cursor.
		 */
		add(view, files, at) {
			let position = at ?? view.state.selection.to;

			for (const file of files.filter((candidate) => candidate.type.startsWith(`image/`))) {
				counter += 1;
				const id = `upload-${counter}`;
				const src = typeof URL.createObjectURL === `function` ? URL.createObjectURL(file) : ``;
				view.dispatch(
					view.state.tr.insert(position, schema.nodes.upload.create({ id, name: file.name, src, status: `uploading` })),
				);
				position += 1;
				announce(`Uploading ${file.name}`);
				void send(view, id, file);
			}
		},

		/**
		 * Stops an upload and takes its node out, or takes out a failed one.
		 * @param {import('prosemirror-view').EditorView} view
		 * @param {string} id
		 */
		remove(view, id) {
			running.get(id)?.abort();
			const position = find(view, id);

			if (position !== -1) {
				view.dispatch(view.state.tr.delete(position, position + 1));
			}

			running.delete(id);
			busy();
		},

		/**
		 * The node view of an upload calls this to be told about progress.
		 * @param {string} id
		 * @param {(fraction: number) => void} update
		 */
		watch(id, update) {
			progressViews.set(id, update);
		},
	};
}

/**
 * Paste and drop of image files.
 * @param {ReturnType<typeof createUploads>} uploads
 */
export function createUploadPlugin(uploads) {
	return new Plugin({
		props: {
			handlePaste: (view, event) => {
				const files = imageFiles(event.clipboardData);

				if (files.length === 0 || !uploads.available) {
					return false;
				}

				uploads.add(view, files);

				return true;
			},
			handleDrop: (view, event) => {
				const files = imageFiles(event.dataTransfer);

				if (files.length === 0 || !uploads.available) {
					return false;
				}

				event.preventDefault();
				uploads.add(view, files, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos);

				return true;
			},
		},
	});
}

/**
 * The toolbar action that opens the file picker.
 * @param {ReturnType<typeof createUploads>} uploads
 * @param {() => void} pick  opens the picker
 * @returns {import('./contracts.js').Command & {toggle: boolean}}
 */
export function createImageCommand(uploads, pick) {
	return {
		id: `image`,
		label: `Image`,
		toggle: false,
		run(_state, dispatch) {
			if (!uploads.available) {
				return false;
			}

			if (dispatch) {
				pick();
			}

			return true;
		},
	};
}
