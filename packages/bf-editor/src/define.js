// Registers the custom elements of the package with the browser.

import { BfEditor } from './elements/bf-editor.js';
import { BfYoutube } from './elements/bf-youtube.js';

/** Registers <bf-editor> and <bf-youtube>. Safe to call more than once. */
export function defineBfEditor() {
	if (!customElements.get(`bf-youtube`)) {
		customElements.define(`bf-youtube`, BfYoutube);
	}

	if (!customElements.get(`bf-editor`)) {
		customElements.define(`bf-editor`, BfEditor);
	}
}
