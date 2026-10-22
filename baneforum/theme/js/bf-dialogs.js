// Messages and questions (confirm) are native <dialog> elements, opened with showModal(). phpBB's own script
// (core.js) fades a <div> in and out over a dark layer. Here its open and close steps use the dialog instead,
// and everything that calls phpbb.alert() or phpbb.confirm() gets the dialog without a change:
// the delete and restore of a post below, the quick tools of a topic, the ajax errors.
// Deleting and restoring a post asks in a dialog on the same page, not on a page of its own.
// phpBB can do this itself: its ajax layer asks the server for the confirm box, shows it as a dialog, sends the
// answer and, when the server says so, goes to the page it names. Prosilver only turns it on for a few links
// (the topic tools); here it is turned on for the buttons of a post too.
(function ($, phpbb) {
	'use strict';

	if (!$ || !phpbb || typeof phpbb.ajaxify !== `function`) {
		return;
	}

	// After the server has done it, go where it says. phpBB's own "refresh" does `window.location = url`, and when
	// the url is this very page (only the #hash differs) the browser just scrolls and the post stays as it was.
	const openAlert = phpbb.alert.open;
	const closeAlert = phpbb.alert.close;

	/** @param {HTMLElement} element */
	const isDialog = (element) => element instanceof HTMLDialogElement;

	phpbb.alert.open = function ($alert) {
		const dialog = $alert[0];

		if (!isDialog(dialog)) {
			return openAlert.call(this, $alert);
		}

		$(`#loading_indicator`).hide();

		if (!dialog.open) {
			dialog.showModal();
		}

		// The cross, and a click on the dimmed page behind, close it. For a question that is "no".
		const dismiss = () => {
			const no = dialog.querySelector(`input[name="cancel"]`);

			if (no) {
				no.click();
			} else {
				phpbb.alert.close($alert, true);
			}
		};

		$alert.find(`.alert_close`).one(`click`, (event) => {
			event.preventDefault();
			dismiss();
		});
		dialog.addEventListener(`click`, (event) => event.target === dialog && dismiss(), { once: true });
		// Escape: the browser closes the dialog itself. For a question that is "no" as well.
		dialog.addEventListener(`cancel`, (event) => {
			event.preventDefault();
			dismiss();
		}, { once: true });
	};

	phpbb.alert.close = function ($alert, fadedark) {
		const dialog = $alert[0];

		if (!isDialog(dialog)) {
			return closeAlert.call(this, $alert, fadedark);
		}

		if (dialog.open) {
			dialog.close();
		}

		$alert.find(`.alert_close`).off(`click`);
		$(document).off(`keydown.phpbb.alert`);
	};

	// phpBB hides the message it showed with jQuery's hide(). A hidden but still open modal dialog would leave the
	// page locked, so a hide() on a dialog closes it.
	const hide = $.fn.hide;

	$.fn.hide = function (...args) {
		this.each((_, element) => isDialog(element) && element.open && element.close());

		return hide.apply(this, args);
	};

	phpbb.addAjaxCallback(`bf_after_post_action`, (response) => {
		// Some answers (a restore) name no page to go to. Then this page is shown again, so it shows the new state.
		const refresh = response.REFRESH_DATA ?? { url: window.location.href, time: 2 };

		window.setTimeout(() => {
			const target = new URL(refresh.url, window.location.href);
			const samePage = target.href.split(`#`)[0] === window.location.href.split(`#`)[0];

			window.location.href = target.href;

			if (samePage) {
				window.location.reload();
			}
		}, refresh.time * 1000);
	});

	// The delete button of a post. A soft delete and a permanent delete both ask first.
	phpbb.ajaxify({
		selector: `a[href*="posting.php?mode=delete"], a[href*="posting.php?mode=soft_delete"]`,
		callback: `bf_after_post_action`,
	});

	// "Restore" and "Delete" under a post that was deleted (the notice with two buttons).
	phpbb.ajaxify({
		selector: `form.mcp_approve`,
		callback: `bf_after_post_action`,
	});
})(window.jQuery, window.phpbb);
