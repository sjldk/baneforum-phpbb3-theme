/* The appearance switch (light or dark theme). The choice is kept in localStorage under "bf-theme" ("dark" or "light").
   The small script in the page head has already set data-theme before the page was drawn. */
(function () {
	'use strict';

	var KEY = 'bf-theme';
	var root = document.documentElement;
	var item = document.querySelector('.bf-theme-switch');

	if (!item) {
		return;
	}

	var button = item.querySelector('.bf-theme-switch__button');
	var icon = item.querySelector('.bf-theme-switch__icon');

	function isDark() {
		return root.getAttribute('data-theme') === 'dark';
	}

	function show() {
		button.setAttribute('aria-pressed', isDark() ? 'true' : 'false');
		icon.classList.toggle('fa-moon-o', !isDark());
		icon.classList.toggle('fa-sun-o', isDark());
	}

	function save(value) {
		try {
			localStorage.setItem(KEY, value);
		} catch (e) {
			// Private window or blocked storage: the choice lasts until the page closes.
		}
	}

	button.addEventListener('click', function (event) {
		event.preventDefault();

		if (isDark()) {
			root.removeAttribute('data-theme');
			save('light');
		} else {
			root.setAttribute('data-theme', 'dark');
			save('dark');
		}

		show();
	});

	// The choice made in another tab applies here too.
	window.addEventListener('storage', function (event) {
		if (event.key !== KEY) {
			return;
		}

		if (event.newValue === 'dark') {
			root.setAttribute('data-theme', 'dark');
		} else {
			root.removeAttribute('data-theme');
		}

		show();
	});

	show();
	item.classList.remove('hidden');
})();
