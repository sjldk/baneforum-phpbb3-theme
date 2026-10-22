/* Sends a vote without a page load. Without this script the buttons are a normal form. */
(function () {
	'use strict';

	function show(button, active, count) {
		button.classList.toggle('is-active', active);
		button.setAttribute('aria-pressed', active ? 'true' : 'false');
		button.querySelector('.bf-vote-count').textContent = String(count);

		var icon = button.querySelector('.icon');
		var kind = button.value === 'up' ? 'up' : 'down';

		icon.classList.remove('fa-thumbs-' + kind, 'fa-thumbs-o-' + kind);
		icon.classList.add(active ? 'fa-thumbs-' + kind : 'fa-thumbs-o-' + kind);
	}

	document.querySelectorAll('.bf-votes[data-low]').forEach(function (group) {
		group.classList.add('is-ready');
	});

	document.addEventListener('click', function (event) {
		var toggle = event.target.closest && event.target.closest('.bf-collapsed-toggle');

		if (toggle) {
			var open = toggle.closest('.post').classList.toggle('bf-shown');

			toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
			toggle.textContent = open ? toggle.dataset.hide : toggle.dataset.show;
			return;
		}

		var button = event.target.closest && event.target.closest('button.bf-vote');

		if (!button || !button.form || !button.form.classList.contains('bf-votes-form')) {
			return;
		}

		event.preventDefault();

		var form = button.form;
		var group = form.closest('.bf-votes');
		var status = group.querySelector('.bf-votes-status');
		var data = new FormData(form);

		data.set('value', button.value);
		group.classList.add('is-busy');
		status.textContent = '';

		fetch(form.action, {
			method: 'POST',
			body: data,
			credentials: 'same-origin',
			headers: { 'X-Requested-With': 'XMLHttpRequest' },
		})
			.then(function (response) {
				return response.json();
			})
			.then(function (result) {
				if (result.error) {
					status.textContent = result.error;
					return;
				}

				var buttons = form.querySelectorAll('button.bf-vote');

				show(buttons[0], result.mine === 1, result.up);
				show(buttons[1], result.mine === -1, result.down);
				// The post folds on the next page load, not under the reader's hands.
				buttons[1].classList.toggle('is-over', result.down > Number(group.dataset.limit));
			})
			.catch(function () {
				form.requestSubmit(button);
			})
			.then(function () {
				group.classList.remove('is-busy');
			});
	});
})();
