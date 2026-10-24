// The table picker, as in Word: a small popover (the Popover API on a <form> that is already in the
// page, see bf-editor.html) under the Table button. It shows a fixed grid of MAX_TABLE_COLUMNS by
// MAX_TABLE_ROWS squares, which is also the largest table there can be. The pointer colours the
// squares from the top left corner, and a click on a square makes a table of that size. The grid is
// hidden from screen readers. The two number fields below it are the way for the keyboard and screen
// readers (the Enter key in a field inserts). The browser handles the layer, Escape and a click
// outside. This file only draws the grid and reads the answer.
import { format } from './labels.js';
import { MAX_TABLE_COLUMNS, MAX_TABLE_ROWS } from './schema.js';

/**
 * @param {HTMLFormElement} form the popover from the page
 * @param {() => Record<string, string>} words the words, see labels.js
 * @param {() => HTMLElement | null} anchor the Table button, which the popover opens under
 */
export function createTablePicker(form, words, anchor) {
	const grid = /** @type {HTMLElement} */ (form.querySelector(`.grid`));
	const size = /** @type {HTMLElement} */ (form.querySelector(`.size`));
	const columns = /** @type {HTMLInputElement} */ (form.querySelector(`input[name="columns"]`));
	const rows = /** @type {HTMLInputElement} */ (form.querySelector(`input[name="rows"]`));
	const ok = /** @type {HTMLButtonElement} */ (form.querySelector(`button[value="ok"]`));
	columns.max = String(MAX_TABLE_COLUMNS);
	rows.max = String(MAX_TABLE_ROWS);
	form.tabIndex = -1;
	grid.style.setProperty(`--columns`, String(MAX_TABLE_COLUMNS));

	/** @type {HTMLElement[]} */
	const squares = [];

	for (let row = 0; row < MAX_TABLE_ROWS; row += 1) {
		for (let column = 0; column < MAX_TABLE_COLUMNS; column += 1) {
			const square = form.ownerDocument.createElement(`span`);
			square.dataset.column = String(column + 1);
			square.dataset.row = String(row + 1);
			squares.push(square);
		}
	}

	grid.append(...squares);

	/** Keeps the popover on the screen. */
	const place = () => {
		const box = anchor()?.getBoundingClientRect();

		if (!box) {
			return;
		}

		const width = form.offsetWidth;
		form.style.insetBlockStart = `${Math.max(8, Math.min(box.bottom + 6, document.documentElement.clientHeight - form.offsetHeight - 8))}px`;
		form.style.insetInlineStart = `${Math.max(8, Math.min(box.left, document.documentElement.clientWidth - width - 8))}px`;
	};

	/**
	 * Colours the squares up to the size and writes it under the grid.
	 * @param {number} wantedColumns
	 * @param {number} wantedRows
	 */
	const show = (wantedColumns, wantedRows) => {
		for (const square of squares) {
			square.classList.toggle(
				`on`,
				Number(square.dataset.column) <= wantedColumns && Number(square.dataset.row) <= wantedRows,
			);
		}

		size.textContent = format(words().tableSize ?? ``, { columns: String(wantedColumns), rows: String(wantedRows) });
	};

	const showFields = () => show(Number(columns.value) || 1, Number(rows.value) || 1);

	/** @param {Event} event */
	const target = (event) => {
		const square = /** @type {HTMLElement | null} */ (/** @type {Element} */ (event.target).closest(`[data-column]`));

		return square ? { column: Number(square.dataset.column), row: Number(square.dataset.row) } : null;
	};

	grid.addEventListener(`pointerover`, (event) => {
		const at = target(event);

		if (at) {
			columns.value = String(at.column);
			rows.value = String(at.row);
			show(at.column, at.row);
		}
	});
	grid.addEventListener(`click`, (event) => {
		if (target(event)) {
			form.requestSubmit(ok);
		}
	});
	columns.addEventListener(`input`, showFields);
	rows.addEventListener(`input`, showFields);

	/** Ends the question that is still open, if any. Only one can be open: one popover, one answer. */
	let cancelOpen = () => {};

	return {
		/** @returns {Promise<{rows: number, columns: number} | null>} */
		ask() {
			cancelOpen();
			columns.value = `3`;
			rows.value = `3`;
			showFields();

			return new Promise((resolve) => {
				let done = false;
				/** @param {{rows: number, columns: number} | null} answer */
				const finish = (answer) => {
					if (!done) {
						done = true;
						cancelOpen = () => {};
						form.removeEventListener(`submit`, onSubmit);
						form.removeEventListener(`toggle`, onToggle);
						resolve(answer);
					}
				};
				const onSubmit = (/** @type {Event} */ event) => {
					// The form checks the limits itself before it sends the event.
					event.preventDefault();
					finish({ rows: Number(rows.value), columns: Number(columns.value) });
					form.hidePopover();
				};
				// Escape and a click outside close the popover without a submit.
				const onToggle = (/** @type {Event} */ event) => {
					if (/** @type {ToggleEvent} */ (event).newState === `closed`) {
						finish(null);
					}
				};
				cancelOpen = () => finish(null);
				form.addEventListener(`submit`, onSubmit);
				form.addEventListener(`toggle`, onToggle);

				if (!form.matches(`:popover-open`)) {
					form.showPopover();
				}

				place();
				form.focus();
			});
		},
		form,
	};
}
