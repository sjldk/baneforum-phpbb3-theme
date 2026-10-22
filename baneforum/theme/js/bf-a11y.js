// Names for links that are only an icon on some screens.
//   - On a small screen prosilver hides the words of the menu links ("Private messages", "Quick links") with
//     display: none. A link with no visible text has no name for a screen reader. The hidden words become its name.
//   - The "..." button that folds the buttons of a post into a menu is made by script and has no words at all.
(function () {
	'use strict';

	const more = document.documentElement.lang.startsWith(`da`) ? `Flere handlinger` : `More actions`;

	function name() {
		for (const link of document.querySelectorAll(`.navbar a:has(> .icon)`)) {
			const words = (link.textContent ?? ``).replace(/\s+/g, ` `).trim();

			if (words && !link.hasAttribute(`aria-label`)) {
				link.setAttribute(`aria-label`, words);
			}
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
