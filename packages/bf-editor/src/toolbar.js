// The toolbar: the <menu role="toolbar"> that is already in the page. The HTML holds the
// buttons, labels and icons. This class only hooks up behaviour:
//   - each button's "command" (for example "--bold") is sent by the browser to the controlled
//     element, which is the editing surface (Invoker Commands API)
//   - buttons with aria-pressed show which commands are on, and any button can be disabled
//   - Keyboard (WAI-ARIA toolbar): one Tab stop for the whole row, arrow keys move between buttons.

export class Toolbar {
	/** @type {HTMLMenuElement} */
	#menu;

	/** @param {HTMLMenuElement} menu the toolbar from the page */
	constructor(menu) {
		this.#menu = menu;
		const buttons = this.#buttons();
		buttons.forEach((button, index) => {
			button.tabIndex = index === 0 ? 0 : -1;
		});
		this.#menu.addEventListener(`keydown`, this.#onKeydown);
		// Pressing a button must not take the focus (and the selection) away from the text.
		this.#menu.addEventListener(`mousedown`, (event) => {
			if (/** @type {Element} */ (event.target).closest(`button`)) {
				event.preventDefault();
			}
		});
	}

	/** @param {string} id the element the toolbar controls */
	controls(id) {
		this.#menu.setAttribute(`aria-controls`, id);

		for (const button of this.#buttons()) {
			button.setAttribute(`commandfor`, id);
		}
	}

	/** The commands the buttons in the page ask for, for example "bold". */
	get commandIds() {
		return this.#buttons().map((button) => button.getAttribute(`command`)?.slice(2) ?? ``);
	}

	/**
	 * @param {{active?: Iterable<string>, disabled?: Iterable<string>}} state ids of buttons that are on or unavailable
	 */
	setState({ active = [], disabled = [] }) {
		const on = new Set(active);
		const off = new Set(disabled);

		for (const button of this.#buttons()) {
			const id = button.getAttribute(`command`)?.slice(2) ?? ``;

			if (button.hasAttribute(`aria-pressed`)) {
				button.setAttribute(`aria-pressed`, String(on.has(id)));
			}

			if (off.has(id)) {
				button.setAttribute(`aria-disabled`, `true`);
			} else {
				button.removeAttribute(`aria-disabled`);
			}
		}
	}

	/** @returns {HTMLButtonElement[]} */
	#buttons() {
		return [...this.#menu.querySelectorAll(`button[command^="--"]`)].filter(
			(element) => element instanceof HTMLButtonElement,
		);
	}

	/** @param {KeyboardEvent} event */
	#onKeydown = (event) => {
		const buttons = this.#buttons();
		const root = /** @type {Document | ShadowRoot} */ (this.#menu.getRootNode());
		const index = buttons.indexOf(/** @type {HTMLButtonElement} */ (root.activeElement));

		if (index === -1) {
			return;
		}

		let next = index;

		if (event.key === `ArrowRight`) {
			next = (index + 1) % buttons.length;
		} else if (event.key === `ArrowLeft`) {
			next = (index - 1 + buttons.length) % buttons.length;
		} else if (event.key === `Home`) {
			next = 0;
		} else if (event.key === `End`) {
			next = buttons.length - 1;
		} else {
			return;
		}

		event.preventDefault();

		for (const button of buttons) {
			button.tabIndex = -1;
		}

		buttons[next].tabIndex = 0;
		buttons[next].focus();
	};
}
