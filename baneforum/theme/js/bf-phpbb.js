// The phpBB adapter for <bf-editor>. The editor itself knows nothing about phpBB. This file
// binds it to the posting form:
//   - the textarea stays in the page. It holds the text that is sent, and it is the fallback
//     when the editor is off (the "Disable Markdown" box is ticked) or JavaScript is missing
//   - pictures are sent by phpBB's own uploader (Plupload), so chunking, the hidden
//     attachment fields, the limits and the permission checks stay exactly as phpBB makes them
import { defineBfEditor } from './bf-editor.js';

const form = document.getElementById(`postform`);
const textarea = form?.querySelector(`textarea#message`);
const markdownBox = document.getElementById(`disable_markdown`);

/** @type {HTMLElement & Record<string, any> | null} */
let editor = null;

/** The uploader phpBB set up for this page, or null if the user may not attach files. */
function phpbbUploader() {
	return window.phpbb?.plupload?.uploader ?? null;
}

/** Where a file that is already attached can be shown from. @param {number} index */
function attachmentSrc(index) {
	const attachment = window.phpbb?.plupload?.data?.[index];

	return attachment ? `./download/file.php?id=${attachment.attach_id}` : ``;
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
				link = JSON.parse(answer.response).download_url?.[0] ?? ``;
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

// The old "Place inline" button of the attachment tab calls this function.
window.attachInline = (/** @type {number} */ index, /** @type {string} */ name) => {
	editor?.insertAttachment({ index, name, src: attachmentSrc(index) });
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

	textarea.before(editor);
	editor.value = textarea.value;
	editor.attachmentSrc = attachmentSrc;
	editor.uploadHandler = phpbbUploader() ? { upload } : null;
	editor.addEventListener(`bf-change`, () => {
		textarea.value = editor?.value ?? textarea.value;
	});
	textarea.hidden = true;
}

function turnOff() {
	if (!editor || !textarea) {
		return;
	}

	textarea.value = editor.value;
	editor.remove();
	editor = null;
	textarea.hidden = false;
}

// phpBB changes the text of the textarea itself when a file is removed in the attachment tab
// (it takes out the `[attachment=N]` tag and numbers the others again). The editor follows.
phpbbUploader()?.bind(`FilesRemoved`, () => {
	if (editor && editor.uploading === 0 && textarea && textarea.value !== editor.value) {
		editor.value = textarea.value;
	}
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

	// The Markdown extension's own box: ticked means this post is plain text, so no editor.
	if (markdownBox) {
		markdownBox.addEventListener(`change`, () => (markdownBox.checked ? turnOff() : turnOn()));

		if (!markdownBox.checked) {
			turnOn();
		}
	}
}
