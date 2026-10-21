// The toolbar: a row of buttons in a <menu>, which HTML defines as a toolbar of commands.
// It knows nothing about editing. It shows the items it is given, tells the world which one
// was pressed ("bf-command" event), and shows which ones are on.
//
// Keyboard (WAI-ARIA toolbar): one Tab stop for the whole row, arrow keys move between buttons.
import { icons } from './icons.js';

const svgNamespace = 'http://www.w3.org/2000/svg';

/** @param {string | undefined} shortcut */
function shortcutText(shortcut) {
	if (!shortcut) {
		return '';
	}

	const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

	return shortcut
		.replace('Mod', mac ? '⌘' : 'Ctrl')
		.replace(/-/g, '+')
		.replace('Shift', 'Shift');
}

export class Toolbar {
	/** @type {HTMLMenuElement} */
	#menu;
	/** @type {Array<{id: string, label: string, shortcut?: string, toggle?: boolean}>} */
	#items = [];

	/** @param {Document} document */
	constructor(document) {
		this.#menu = document.createElement('menu');
		this.#menu.setAttribute('role', 'toolbar');
		this.#menu.setAttribute('aria-label', 'Formatting');
		this.#menu.addEventListener('keydown', this.#onKeydown);
		this.#menu.addEventListener('click', this.#onClick);
		// Pressing a button must not take the focus (and the selection) away from the text.
		this.#menu.addEventListener('mousedown', (event) => {
			if (/** @type {Element} */ (event.target).closest('button')) {
				event.preventDefault();
			}
		});
	}

	/** The `<menu>` element to put in the page. */
	get element() {
		return this.#menu;
	}

	/** @param {string} id the element the toolbar controls */
	controls(id) {
		this.#menu.setAttribute('aria-controls', id);
	}

	/** @param {Array<{id: string, label: string, shortcut?: string, toggle?: boolean}>} items */
	set items(items) {
		this.#items = items;
		this.#menu.replaceChildren(...items.map((item, index) => this.#entry(item, index === 0)));
	}

	/** The buttons currently shown. */
	get items() {
		return this.#items;
	}

	/**
	 * @param {{active?: Iterable<string>, disabled?: Iterable<string>}} state ids of buttons that are on or unavailable
	 */
	setState({ active = [], disabled = [] }) {
		const on = new Set(active);
		const off = new Set(disabled);

		for (const button of this.#menu.querySelectorAll('button')) {
			const item = this.#items.find((candidate) => candidate.id === button.dataset.command);

			if (item?.toggle) {
				button.setAttribute('aria-pressed', String(on.has(item.id)));
			}

			if (off.has(button.dataset.command ?? '')) {
				button.setAttribute('aria-disabled', 'true');
			} else {
				button.removeAttribute('aria-disabled');
			}
		}
	}

	/**
	 * @param {{id: string, label: string, shortcut?: string, toggle?: boolean}} item
	 * @param {boolean} first  the one button that is a Tab stop
	 */
	#entry(item, first) {
		const entry = this.#menu.ownerDocument.createElement('li');
		entry.append(this.#button(item, first));

		return entry;
	}

	/**
	 * @param {{id: string, label: string, shortcut?: string, toggle?: boolean}} item
	 * @param {boolean} first  the one button that is a Tab stop
	 */
	#button(item, first) {
		const document = this.#menu.ownerDocument;
		const button = document.createElement('button');
		button.type = 'button';
		button.dataset.command = item.id;
		button.tabIndex = first ? 0 : -1;
		const shortcut = shortcutText(item.shortcut);
		button.title = shortcut ? `${item.label} (${shortcut})` : item.label;
		button.setAttribute('aria-label', item.label);

		if (item.shortcut) {
			button.setAttribute('aria-keyshortcuts', item.shortcut.replace('Mod', 'Control'));
		}

		if (item.toggle) {
			button.setAttribute('aria-pressed', 'false');
		}

		const svg = document.createElementNS(svgNamespace, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('aria-hidden', 'true');
		svg.setAttribute('focusable', 'false');
		const path = document.createElementNS(svgNamespace, 'path');
		path.setAttribute('d', icons[/** @type {keyof typeof icons} */ (item.id)] ?? icons.normal);
		svg.append(path);
		button.append(svg);

		return button;
	}

	/** @param {Event} event */
	#onClick = (event) => {
		const button = /** @type {Element} */ (event.target).closest('button');

		if (!button || button.getAttribute('aria-disabled') === 'true') {
			return;
		}

		this.#menu.dispatchEvent(new CustomEvent('bf-command', { bubbles: true, detail: { id: button.dataset.command } }));
	};

	/** @param {KeyboardEvent} event */
	#onKeydown = (event) => {
		const buttons = [...this.#menu.querySelectorAll('button')];
		const index = buttons.indexOf(/** @type {HTMLButtonElement} */ (this.#menu.ownerDocument.activeElement));

		if (index === -1) {
			return;
		}

		let next = index;

		if (event.key === 'ArrowRight') {
			next = (index + 1) % buttons.length;
		} else if (event.key === 'ArrowLeft') {
			next = (index - 1 + buttons.length) % buttons.length;
		} else if (event.key === 'Home') {
			next = 0;
		} else if (event.key === 'End') {
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
