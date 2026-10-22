// The phpBB adapter for <bf-editor>. The editor itself knows nothing about phpBB. This file
// binds it to the posting form:
//   - the textarea stays in the page. It holds the text that is sent, and it is the fallback
//     when JavaScript is missing
//   - pictures are sent by phpBB's own uploader (Plupload), so chunking, the hidden
//     attachment fields, the limits and the permission checks stay exactly as phpBB makes them
import { defineBfEditor } from './bf-editor.js';

const form = document.getElementById(`postform`);
const textarea = form?.querySelector(`textarea#message`);

/** @type {HTMLElement & Record<string, any> | null} */
let editor = null;

/** The uploader phpBB set up for this page, or null if the user may not attach files. */
function phpbbUploader() {
	return window.phpbb?.plupload?.uploader ?? null;
}

/** What phpBB knows about an attached file: where to show it from, its description, and if it is a picture. @param {number} index */
function attachmentInfo(index) {
	const attachment = window.phpbb?.plupload?.data?.[index];

	return attachment
		? {
				src: `./download/file.php?id=${attachment.attach_id}`,
				description: attachment.attach_comment ?? ``,
				image: /\.(gif|jpe?g|png|webp|avif|bmp|tiff?|tga)$/i.test(attachment.real_filename ?? ``),
			}
		: null;
}

/** The row of the attachment panel for a file. It holds the fields that are sent with the form. @param {number} index */
function attachmentRow(index) {
	const attachment = window.phpbb?.plupload?.data?.[index];

	return attachment ? document.querySelector(`[data-attach-id="${attachment.attach_id}"]`) : null;
}

/** The file types phpBB allows, as the accept attribute of a file field. */
function acceptedTypes() {
	const groups = window.phpbb?.plupload?.config?.filters?.mime_types ?? [];

	return groups
		.flatMap((/** @type {{extensions: string}} */ group) => group.extensions.split(`,`))
		.map((/** @type {string} */ extension) => (extension.trim() === `*` ? `` : `.${extension.trim()}`))
		.filter(Boolean)
		.join(`,`);
}

/**
 * The attachment panel of phpBB lists the files of the post. A file that is in the text is shown in
 * the editor, so its row is hidden, and the panel only shows when a file is left that is not in the text
 * (for example in an old post, where the files were listed under the text).
 */
function syncAttachmentRows() {
	const panel = document.getElementById(`attach-panel`);
	const text = textarea?.value ?? ``;
	const data = window.phpbb?.plupload?.data ?? [];
	let left = 0;

	for (const row of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(`#file-list > .attach-row`))) {
		const index = data.findIndex((/** @type {{attach_id: string}} */ attachment) => String(attachment.attach_id) === row.dataset.attachId);
		const placed = index !== -1 && new RegExp(`\\[attachment=${index}\\]`).test(text);
		row.style.display = placed ? `none` : ``;
		left += placed ? 0 : 1;
	}

	// The description field of a row has no label in phpBB's markup. The column title is its name.
	const title = document.querySelector(`th.attach-comment`)?.textContent?.trim() ?? ``;

	for (const field of document.querySelectorAll(`#file-list textarea`)) {
		field.setAttribute(`aria-label`, title);
		field.setAttribute(`placeholder`, title);
	}

	if (panel) {
		panel.toggleAttribute(`data-bf-files`, left > 0);
	}
}

/**
 * Sends a file through phpBB's own uploader and says how it went.
 * @param {File} file
 * @param {{onProgress?: (fraction: number) => void, signal?: AbortSignal}} options
 */
function upload(file, { onProgress, signal } = {}) {
	const uploader = /** @type {any} */ (phpbbUploader());
	const taken = new Set(uploader.files.map((/** @type {{name: string}} */ queued) => queued.name));
	// Pasted pictures are all called image.png, and the uploader refuses a name it already has.
	const name = taken.has(file.name) ? file.name.replace(/(\.\w+)?$/, `-${Date.now()}$1`) : file.name;
	const sent = name === file.name ? file : new File([file], name, { type: file.type });

	running += 1;

	return new Promise((resolve, reject) => {
		/** @type {any} */
		let queued = null;
		const mine = (/** @type {any} */ candidate) => candidate && (candidate === queued || candidate.name === name);

		const onAdded = (/** @type {any} */ _up, /** @type {any[]} */ files) => {
			queued ??= files.find((candidate) => candidate.name === name) ?? null;
			bridging = false;
		};
		const onProgressEvent = (/** @type {any} */ _up, /** @type {any} */ candidate) => {
			if (candidate === queued) {
				onProgress?.(candidate.percent / 100);
			}
		};
		const onUploaded = (/** @type {any} */ _up, /** @type {any} */ candidate, /** @type {{response: string}} */ answer) => {
			if (candidate !== queued) {
				return;
			}

			finish();

			if (candidate.error || !candidate.attachment_data) {
				reject(new Error(candidate.error ?? `Upload failed.`));

				return;
			}

			let link = ``;

			try {
				// phpBB answers with one address as a string.
				const { download_url: address } = JSON.parse(answer.response);
				link = (Array.isArray(address) ? address[0] : address) ?? ``;
			} catch {
				link = ``;
			}

			resolve({
				src: link.replace(`&amp;`, `&`),
				name: candidate.attachment_data.real_filename,
				id: candidate.attachment_data.attach_id,
				index: 0,
				renumber: (/** @type {number} */ index) => index + 1,
			});
		};
		const onError = (/** @type {any} */ _up, /** @type {{message: string, file?: any}} */ problem) => {
			if (mine(problem.file) || (!problem.file && queued === null)) {
				finish();
				reject(new Error(problem.message));
			}
		};
		const onAbort = () => {
			finish();

			if (queued) {
				uploader.removeFile(queued);
				document.getElementById(queued.id)?.remove();
			}

			reject(new DOMException(`Aborted`, `AbortError`));
		};
		let settled = false;
		const finish = () => {
			if (settled) {
				return;
			}

			settled = true;
			running -= 1;
			uploader.unbind(`FilesAdded`, onAdded);
			uploader.unbind(`UploadProgress`, onProgressEvent);
			uploader.unbind(`FileUploaded`, onUploaded);
			uploader.unbind(`Error`, onError);
			signal?.removeEventListener(`abort`, onAbort);
			bridging = false;
		};

		uploader.bind(`FilesAdded`, onAdded);
		uploader.bind(`UploadProgress`, onProgressEvent);
		uploader.bind(`FileUploaded`, onUploaded);
		uploader.bind(`Error`, onError);
		signal?.addEventListener(`abort`, onAbort);
		bridging = true;
		uploader.addFile(sent);
	});
}

// phpBB opens a dialog for every upload error. The editor shows the error at the picture, so
// while one of its uploads is running the dialog is not shown.
let running = 0;
const alertBox = window.phpbb?.alert;

if (typeof alertBox === `function`) {
	window.phpbb.alert = (/** @type {unknown[]} */ ...args) => (running > 0 ? undefined : alertBox.apply(window.phpbb, args));
}

// phpBB shows the attachment tab when a file is added. The writer is in the editor, so it stays.
let bridging = false;
const activate = window.activateSubPanel;

if (typeof activate === `function`) {
	window.activateSubPanel = (/** @type {string} */ id) => (bridging && id === `attach-panel` ? undefined : activate(id));
}

// phpBB's "Quote" buttons (in the topic review) and its BBCode buttons put text in the textarea with insert_text().
// The textarea is hidden behind the editor, so the text goes into the editor instead.
const phpbbInsertText = window.insert_text;
window.insert_text = (/** @type {string} */ text, /** @type {boolean} */ spaces, /** @type {boolean} */ popup) => {
	if (editor && !popup) {
		editor.insertText(spaces ? ` ${text} ` : text);

		return;
	}

	phpbbInsertText?.(text, spaces, popup);
};

// The old "Place inline" button of the attachment tab calls this function.
window.attachInline = (/** @type {number} */ index, /** @type {string} */ name) => {
	editor?.insertAttachment({ index, name, src: attachmentInfo(index)?.src });
};

function turnOn() {
	if (editor || !textarea) {
		return;
	}

	defineBfEditor();
	editor = /** @type {HTMLElement & Record<string, any>} */ (document.createElement(`bf-editor`));

	if (textarea.placeholder) {
		editor.setAttribute(`placeholder`, textarea.placeholder);
	}

	if (textarea.dataset.bfLabel) {
		editor.setAttribute(`label`, textarea.dataset.bfLabel);
	}

	// Before the text is loaded, so the pictures in it can be shown at once.
	editor.attachmentInfo = attachmentInfo;
	textarea.before(editor);
	editor.value = textarea.value;
	editor.uploadHandler = phpbbUploader() ? { upload } : null;
	editor.accept = acceptedTypes();
	editor.addEventListener(`bf-change`, () => {
		textarea.value = editor?.value ?? textarea.value;
		syncAttachmentRows();
	});
	syncAttachmentRows();
	// Files that are not pictures are not put in the text. They go to phpBB's own list under the editor.
	editor.addEventListener(`bf-attach-files`, (/** @type {CustomEvent} */ event) => {
		const uploader = /** @type {any} */ (phpbbUploader());

		if (!uploader) {
			return;
		}

		bridging = true;

		for (const file of event.detail.files) {
			uploader.addFile(file);
		}

		window.setTimeout(() => {
			bridging = false;
			syncAttachmentRows();
		}, 500);
	});
	editor.addEventListener(`bf-attachment-describe`, (/** @type {CustomEvent} */ event) => {
		const { index, description } = event.detail;
		const attachment = window.phpbb?.plupload?.data?.[index];
		const row = attachmentRow(index);

		if (!attachment) {
			return;
		}

		// The description is the comment of the attachment. phpBB sends it in two places.
		attachment.attach_comment = description;
		const field = row?.querySelector(`textarea`);
		const hidden = row?.querySelector(`input[name$="[attach_comment]"]`);

		if (field) {
			field.value = description;
		}

		if (hidden instanceof HTMLInputElement) {
			hidden.value = description;
		}
	});
	editor.addEventListener(`bf-attachment-remove`, (/** @type {CustomEvent} */ event) => {
		const row = attachmentRow(event.detail.index);
		const attachId = window.phpbb?.plupload?.data?.[event.detail.index]?.attach_id;

		// phpBB deletes the file, takes the tag out of the text and numbers the others again.
		if (row && attachId !== undefined) {
			window.phpbb.plupload.deleteFile(window.jQuery(row), attachId);
		}
	});
	textarea.hidden = true;
}

// phpBB changes the text of the textarea itself when a file is removed in the attachment tab
// (it takes out the `[attachment=N]` tag and numbers the others again). The editor follows.
phpbbUploader()?.bind(`FilesAdded`, () => window.setTimeout(syncAttachmentRows, 0));
phpbbUploader()?.bind(`FileUploaded`, () => window.setTimeout(syncAttachmentRows, 0));
phpbbUploader()?.bind(`FilesRemoved`, () => {
	if (editor && editor.uploading === 0 && textarea && textarea.value !== editor.value) {
		editor.value = textarea.value;
	}

	syncAttachmentRows();
});

if (form && textarea) {
	form.addEventListener(
		`submit`,
		(event) => {
			if (!editor) {
				return;
			}

			if (editor.uploading > 0) {
				event.preventDefault();
				window.phpbb?.alert?.(``, editor.labelFor?.(`uploadsBusy`) ?? `Wait until the pictures have been uploaded.`);

				return;
			}

			// The textarea is not rewritten here. The editor writes it when the writer changes the
			// text, so a post that is only opened and saved again keeps its text exactly as it was.
		},
		true,
	);

	// The Markdown extension's own box is not in the template. The editor is always on.
	// Without JavaScript the plain textarea stays.
	turnOn();

	// Quoting: the text ends in the quote. The cursor goes on a line after it, outside the quote, ready to write.
	if (new URLSearchParams(window.location.search).get(`mode`) === `quote`) {
		editor?.focusEnd();
	}
}
