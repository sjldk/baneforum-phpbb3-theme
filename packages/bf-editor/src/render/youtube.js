// Videos in saved posts become <bf-youtube> players that load nothing from Google until the
// visitor presses play. Two forms are found:
//   - what phpBB's MediaEmbed extension makes of a video address: a span that holds an iframe
//     (the iframe would fetch a picture from Google as soon as it is near the screen)
//   - a plain link that is alone in its paragraph (a board without MediaEmbed)
import { youtubeProvider } from '../embeds/youtube.js';

/**
 * @param {Document} document
 * @param {string} url the address of the video
 * @param {Element | null} link a link to keep inside the player, or null to make one
 */
function createPlayer(document, url, link) {
	const player = document.createElement(`bf-youtube`);
	player.setAttribute(`url`, url);

	if (link) {
		player.append(link);
	} else {
		player.innerHTML = `<a></a>`;
		const anchor = /** @type {HTMLAnchorElement} */ (player.firstElementChild);
		anchor.href = url;
		anchor.textContent = url;
	}

	return player;
}

/**
 * Puts the thumbnail behind the play button of every player in root. The address comes from the page (a meta tag
 * "bf-youtube-thumb", with a stand-in for the video id). The picture is used only when it has loaded: if the board has none, or the
 * meta tag is not there, the player stays as it is.
 * @param {ParentNode} root
 * @returns {number} how many pictures were asked for
 */
export function useYoutubeThumbnails(root) {
	const document = root.ownerDocument ?? /** @type {Document} */ (root);
	const template = document.querySelector(`meta[name="bf-youtube-thumb"]`)?.getAttribute(`content`);
	let asked = 0;

	if (!template) {
		return asked;
	}

	for (const player of root.querySelectorAll(`bf-youtube:not([thumb])`)) {
		const found = youtubeProvider.match(player.getAttribute(`url`) ?? player.querySelector(`a`)?.href ?? ``);

		if (!found) {
			continue;
		}

		const address = template.replace(`AAAAAAAAAAA`, found.attrs.id);
		const picture = new Image();

		picture.addEventListener(`load`, () => {
			/** @type {HTMLElement} */ (player).style.setProperty(`--bf-youtube-thumb`, `url("${address}")`);
			player.setAttribute(`thumb`, ``);
		});
		picture.src = address;
		asked += 1;
	}

	return asked;
}

/**
 * @param {ParentNode} root  the part of the page to look in
 * @returns {number} how many players were made
 */
export function useYoutubePlayers(root) {
	const document = root.ownerDocument ?? /** @type {Document} */ (root);
	let made = 0;

	for (const span of root.querySelectorAll(`span[data-s9e-mediaembed="youtube"]`)) {
		const found = youtubeProvider.match(span.querySelector(`iframe`)?.getAttribute(`src`) ?? ``);

		if (found) {
			span.replaceWith(createPlayer(document, youtubeProvider.toUrl(found.attrs), null));
			made += 1;
		}
	}

	for (const link of root.querySelectorAll(`p > a[href]:only-child`)) {
		const url = link.getAttribute(`href`) ?? ``;

		const text = link.textContent?.trim() ?? ``;

		// The text of a link that is only an address is the address, or phpBB's shortened "start ... end".
		if ((text === url || text.includes(` ... `)) && youtubeProvider.match(url)) {
			link.replaceWith(createPlayer(document, url, /** @type {Element} */ (link.cloneNode(true))));
			made += 1;
		}
	}

	return made;
}
