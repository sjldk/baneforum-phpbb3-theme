import { BfEditor } from './elements/bf-editor.js';

/** Registers <bf-editor>. Safe to call more than once. */
export function defineBfEditor() {
	if (!customElements.get('bf-editor')) {
		customElements.define('bf-editor', BfEditor);
	}
}
