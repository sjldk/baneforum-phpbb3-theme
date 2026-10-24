/* The back-to-top button (.bf-top in overall_footer.html). It is hidden in the markup and shows once the page has
   scrolled more than one screen. Without this script it stays hidden. While the cookie notice is on the screen (it is fixed at the
   bottom and on a phone it covers the whole width) the button is lifted above it, so a tap does not land on the notice. */
(function () {
	'use strict';

	var button = document.querySelector('.bf-top');

	if (!button) {
		return;
	}

	function update() {
		button.hidden = window.scrollY < window.innerHeight;
	}

	// The height of the cookie notice in pixels, 0 when there is none on the screen. The notice is removed or made invisible when it is dismissed.
	function lift() {
		var notice = document.querySelector('.cc-window:not(.cc-invisible)');
		var box = notice ? notice.getBoundingClientRect() : null;
		var height = box && box.height > 0 ? Math.max(0, window.innerHeight - box.top) : 0;

		button.style.setProperty('--bf-top-lift', Math.round(height) + 'px');
	}

	button.addEventListener('click', function (event) {
		var smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		event.preventDefault();
		window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
	});

	window.addEventListener('scroll', update, { passive: true });
	window.addEventListener('resize', lift);
	new MutationObserver(lift).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
	update();
	lift();
})();
