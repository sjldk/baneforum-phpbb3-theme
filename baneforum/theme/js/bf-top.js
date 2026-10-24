/* The back-to-top button (.bf-top in overall_footer.html). It is hidden in the markup and shows once the page has
   scrolled more than one screen. Without this script it stays hidden. */
(function () {
	'use strict';

	var button = document.querySelector('.bf-top');

	if (!button) {
		return;
	}

	function update() {
		button.hidden = window.scrollY < window.innerHeight;
	}

	button.addEventListener('click', function (event) {
		var smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		event.preventDefault();
		window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
	});

	window.addEventListener('scroll', update, { passive: true });
	update();
})();
