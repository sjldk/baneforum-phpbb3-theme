// Adding images: pick, paste or drop a file, see it at once, and let it go to the host in the
// background. The editor knows nothing about the host. It asks an UploadHandler (contracts.js).
//
// While a file goes, the document holds an `upload` node (a local preview, no saved text).
// When the host answers, that node becomes an `attachment` node. If it fails, the node stays
// as an error until the writer removes it.
import { Plugin } from 'prosemirror-state';
import { format, labelsFor } from './labels.js';

/**
 * The files of a drop or a paste as a plain list. It is empty when there are none.
 * @param {DataTransfer | null | undefined} data
 */
function droppedFiles(data) {
	return [...(data?.files ?? [])];
}

/**
 * Starts and follows uploads. It keeps the running ones, so a file can be stopped and the host can wait for all of
 * them before the form is sent.
 * @param {object} options
 * @param {import('prosemirror-model').Schema} options.schema
 * @param {() => import('./contracts.js').UploadHandler | null} options.handler  the handler now in use, or null
 * @param {(text: string) => void} options.announce  says something to screen readers
 * @param {() => Record<string, string>} [options.labels]  the words to use, see labels.js
 * @param {(count: number) => void} [options.onBusy]  called when the number of running uploads changes
 * @param {(files: File[]) => void} [options.onFiles]  called with the files that are not pictures. Those are not shown in the text, the host keeps them in its own list.
 */
export function createUploads({ schema, handler, announce, onBusy, onFiles, labels = () => labelsFor() }) {
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
				throw new Error(labels().uploadUnavailable);
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
			announce(format(labels().uploaded, { name: result.name }));
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

			announce(format(labels().uploadFailed, { name: file.name, message }));
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
		 * Shows the pictures at once and sends them in the background. Other files go to `onFiles`.
		 * @param {import('prosemirror-view').EditorView} view
		 * @param {File[]} files
		 * @param {number} [at]  where to put them. Default: the cursor.
		 */
		add(view, files, at) {
			let position = at ?? view.state.selection.to;
			const others = files.filter((file) => !file.type.startsWith(`image/`));

			if (others.length > 0) {
				onFiles?.(others);
			}

			for (const file of files.filter((candidate) => candidate.type.startsWith(`image/`))) {
				counter += 1;
				const id = `upload-${counter}`;
				const src = typeof URL.createObjectURL === `function` ? URL.createObjectURL(file) : ``;
				view.dispatch(
					view.state.tr.insert(position, schema.nodes.upload.create({ id, name: file.name, src, status: `uploading` })),
				);
				position += 1;
				announce(format(labels().uploading, { name: file.name }));
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
 * Paste and drop of files. While a file is dragged over the text, the text shows it can take it.
 * @param {ReturnType<typeof createUploads>} uploads
 */
export function createUploadPlugin(uploads) {
	return new Plugin({
		props: {
			handleDOMEvents: {
				dragover: (view, event) => {
					if (uploads.available && [...(event.dataTransfer?.types ?? [])].includes(`Files`)) {
						view.dom.toggleAttribute(`data-dropping`, true);
					}

					return false;
				},
				dragleave: (view) => {
					view.dom.toggleAttribute(`data-dropping`, false);

					return false;
				},
				drop: (view) => {
					view.dom.toggleAttribute(`data-dropping`, false);

					return false;
				},
			},
			handlePaste: (view, event) => {
				const files = droppedFiles(event.clipboardData);
				const onlyFiles = [...(event.clipboardData?.types ?? [])].every((type) => type === `Files`);

				// Text that comes with a file (a copied table, for example) is a paste of text.
				if (files.length === 0 || !onlyFiles || !uploads.available) {
					return false;
				}

				uploads.add(view, files);

				return true;
			},
			handleDrop: (view, event) => {
				const files = droppedFiles(event.dataTransfer);

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
export function createAttachCommand(uploads, pick) {
	return {
		id: `attach`,
		label: `Attach file`,
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
