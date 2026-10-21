// Links to other sites in a post open in a new window. The link says so, to everyone:
// an icon (drawn by the theme from the data attribute) and a hidden text for screen readers.
// WCAG 3.2.5 asks for a warning before a link changes the context.
import { labelsFor } from '../labels.js';

/**
 * @param {ParentNode} root  the part of the page to look in
 * @param {{origin?: string, text?: string}} [options]
 * @returns {number} how many links were changed
 */
export function useNewWindowLinks(root, options = {}) {
	const document = root.ownerDocument ?? /** @type {Document} */ (root);
	const origin = options.origin ?? document.location?.origin ?? ``;
	const text = options.text ?? labelsFor(document.documentElement.lang).newWindow;
	let changed = 0;

	for (const link of root.querySelectorAll(`a[href]:not([data-bf-external])`)) {
		let url;

		try {
			url = new URL(/** @type {string} */ (link.getAttribute(`href`)), document.baseURI);
		} catch {
			continue;
		}

		if (!/^https?:$/.test(url.protocol) || url.origin === origin) {
			continue;
		}

		link.setAttribute(`target`, `_blank`);
		link.setAttribute(
			`rel`,
			[...new Set([...(link.getAttribute(`rel`) ?? ``).split(/\s+/), `noopener`, `noreferrer`])]
				.filter(Boolean)
				.join(` `),
		);
		link.setAttribute(`data-bf-external`, ``);
		const hidden = document.createElement(`span`);
		hidden.className = `bf-visually-hidden`;
		hidden.textContent = ` ${text}`;
		link.append(hidden);
		changed += 1;
	}

	return changed;
}
