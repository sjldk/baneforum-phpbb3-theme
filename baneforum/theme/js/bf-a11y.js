// Names for links that are only an icon on some screens.
//   - On a small screen prosilver hides the words of the menu links ("Private messages", "Quick links") with
//     display: none. A link with no visible text has no name for a screen reader. The hidden words become its name.
//   - The "..." button that folds the buttons of a post into a menu is made by script and has no words at all.
//   - A select that no <label> points at (prosilver's search page labels the wrong field, the profile has a group picker
//     with no label) gets the words of its own row ("Sort results by") as its name.
(function () {
	'use strict';

	const danish = document.documentElement.lang.startsWith(`da`);
	const more = danish ? `Flere handlinger` : `More actions`;
	const choose = danish ? `Vælg` : `Select`;

	function name() {
		for (const link of document.querySelectorAll(`.navbar a:has(> .icon)`)) {
			const words = (link.textContent ?? ``).replace(/\s+/g, ` `).trim();

			if (words && !link.hasAttribute(`aria-label`)) {
				link.setAttribute(`aria-label`, words);
			}
		}

		for (const select of document.querySelectorAll(`select:not([aria-label], [aria-labelledby])`)) {
			if (select.labels.length === 0) {
				const words = (select.closest(`dl`)?.querySelector(`dt`)?.textContent ?? ``).replace(/\s+/g, ` `).replace(/:\s*$/, ``).trim();

				// No words in its row: the choices name it (the action menu of the private message list).
				const choices = [...select.options].map((option) => option.textContent.trim()).join(` / `).slice(0, 80);

				select.setAttribute(`aria-label`, words || choices);
			}
		}

		// The check box of a row in a list (private messages) has no label: the title of its row names it.
		for (const box of document.querySelectorAll(`input[type="checkbox"]:not([aria-label], [aria-labelledby])`)) {
			if (box.labels.length === 0) {
				const title = box.closest(`dl, tr, li`)?.querySelector(`.topictitle, a`)?.textContent.trim();

				box.setAttribute(`aria-label`, title ? `${choose}: ${title}` : choose);
			}
		}

		// The "..." in the page numbers has role="separator" in phpBB's template, which is not allowed inside a list.
		for (const dots of document.querySelectorAll(`.pagination li.ellipsis[role="separator"]`)) {
			dots.removeAttribute(`role`);
		}

		// The empty link that covers a row of the forum list (an unread forum) is a mouse help. It has no words and is not a tab stop.
		for (const link of document.querySelectorAll(`a.row-item-link:not([aria-hidden])`)) {
			link.setAttribute(`aria-hidden`, `true`);
			link.setAttribute(`tabindex`, `-1`);
		}

		for (const link of document.querySelectorAll(`.responsive-menu-link`)) {
			if (!link.hasAttribute(`aria-label`)) {
				link.setAttribute(`aria-label`, more);
			}
		}
	}

	name();
	// The menu links of a post are made a moment after the page has loaded.
	window.setTimeout(name, 500);
})();
