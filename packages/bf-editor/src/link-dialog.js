// The link dialog: a native <dialog> that is already in the page (see bf-editor.html). The
// browser gives it the focus trap, the Escape key and the return of focus. This file only fills
// the field and reads the answer.

let counter = 0;

/**
 * Hooks up the dialog from the page. Each id is unique, because the Cancel button finds the dialog by id.
 * @param {HTMLDialogElement} dialog the dialog from the page
 */
export function createLinkDialog(dialog) {
	const form = /** @type {HTMLFormElement} */ (dialog.querySelector(`form`));
	const input = /** @type {HTMLInputElement} */ (dialog.querySelector(`input[name="href"]`));
	const remove = /** @type {HTMLButtonElement} */ (dialog.querySelector(`button[value="remove"]`));
	counter += 1;
	dialog.id = `bf-link-dialog-${counter}`;

	// The Cancel button closes the dialog from markup. The Invoker Commands API needs an id.
	for (const button of dialog.querySelectorAll(`button[command]`)) {
		button.setAttribute(`commandfor`, dialog.id);
	}

	return {
		/**
		 * @param {string} current  the address of the link being changed, or ''
		 * @returns {Promise<{href: string} | {remove: true} | null>}
		 */
		ask(current) {
			input.value = current;
			remove.hidden = current === ``;

			return new Promise((resolve) => {
				let done = false;
				/** @param {{href: string} | {remove: true} | null} answer */
				const finish = (answer) => {
					if (!done) {
						done = true;
						form.removeEventListener(`submit`, onSubmit);
						dialog.removeEventListener(`close`, onClose);
						resolve(answer);
					}
				};
				// A button press is read from the submit, which does not wait for the dialog to close.
				const onSubmit = (/** @type {SubmitEvent} */ event) => {
					const value = event.submitter instanceof HTMLButtonElement ? event.submitter.value : ``;

					if (value === `ok` && input.value.trim() !== ``) {
						finish({ href: input.value.trim() });
					} else if (value === `remove`) {
						finish({ remove: true });
					} else {
						finish(null);
					}
				};
				// Escape and Cancel close the dialog without a submit.
				const onClose = () => finish(null);
				form.addEventListener(`submit`, onSubmit);
				dialog.addEventListener(`close`, onClose);
				dialog.showModal();
				input.select();
			});
		},
		dialog,
	};
}
