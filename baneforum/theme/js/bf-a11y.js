// Names for links that are only an icon on some screens.
//   - On a small screen prosilver hides the words of the menu links ("Private messages", "Quick links") with
//     display: none. A link with no visible text has no name for a screen reader. The hidden words become its name.
//   - The "..." button that folds the buttons of a post into a menu is made by script and has no words at all.
//   - Tooltips of the top bar. prosilver's forum_fn.js gives every link in the breadcrumbs a tooltip with its own words (also the forum
//     menu and the names in it). A tooltip that repeats the words that are on the screen is noise, so it is removed. It is kept, or
//     added, where it tells something the screen does not: when the words are hidden and only the icon shows (a narrow top bar), or when
//     a name is cut off with an ellipsis. A tooltip with other words (the help icon) is never touched. The name for a screen reader
//     does not come from the tooltip (see above), so none of this changes what a screen reader says.
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

	const normal = (text) => (text ?? ``).replace(/\s+/g, ` `).trim();

	/** The words of a link show beside its icon only if their element is wider than the 1 pixel of the screen reader only style. */
	function iconOnly(link) {
		if (!link.querySelector(`:scope > .icon`)) {
			return false;
		}

		const label = [...link.children].find(
			(child) => child.tagName === `SPAN` && !child.classList.contains(`badge`) && !child.classList.contains(`bf-visually-hidden`) && normal(child.textContent) !== ``,
		);

		return label !== undefined && label.getBoundingClientRect().width <= 2;
	}

	function tidyTitles() {
		for (const link of document.querySelectorAll(`.navbar a`)) {
			const words = normal(link.getAttribute(`aria-label`) ?? link.textContent);
			const title = normal(link.getAttribute(`title`));

			// A tooltip with other words than the link has is a help text. It stays.
			if (!words || (title !== `` && title !== words)) {
				continue;
			}

			const cutOff = link.closest(`.breadcrumbs`) !== null && link.scrollWidth > link.clientWidth;
			const wanted = iconOnly(link) || cutOff;

			if (wanted && title !== words) {
				link.setAttribute(`title`, words);
			} else if (!wanted && link.hasAttribute(`title`)) {
				link.removeAttribute(`title`);
			}
		}
	}

	let tidying = 0;
	const tidySoon = () => {
		window.clearTimeout(tidying);
		tidying = window.setTimeout(tidyTitles, 100);
	};

	name();
	// The menu links of a post are made a moment after the page has loaded.
	window.setTimeout(name, 500);
	tidyTitles();
	window.addEventListener(`load`, tidySoon);
	window.addEventListener(`resize`, tidySoon);

	// forum_fn.js sets the tooltips of the breadcrumbs when it likes. Whenever one of them is set again, it is looked at again.
	const bar = document.querySelector(`.navbar`);

	if (bar) {
		new MutationObserver(tidySoon).observe(bar, { attributes: true, attributeFilter: [`title`], subtree: true });
	}
})();
