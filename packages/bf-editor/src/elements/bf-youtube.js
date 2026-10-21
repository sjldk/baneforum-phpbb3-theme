// <bf-youtube url="https://youtu.be/ID"><a href="...">link</a></bf-youtube>
//
// A card with a play button. The video player is loaded from youtube-nocookie.com only when the
// button is pressed, so a page with a video makes no request to Google until the visitor asks.
// The link inside the element stays visible. Without JavaScript it is all there is.
import { playerUrl, youtubeProvider } from '../embeds/youtube.js';
import { template } from '../youtube-template.js';

export class BfYoutube extends HTMLElement {
	constructor() {
		super();
		const root = this.attachShadow({ mode: `open` });
		root.innerHTML = template;
		const button = /** @type {HTMLButtonElement} */ (root.querySelector(`button`));
		button.addEventListener(`click`, () => this.#play(root, button));
	}

	/**
	 * @param {ShadowRoot} root
	 * @param {HTMLButtonElement} button
	 */
	#play(root, button) {
		const url = this.getAttribute(`url`) ?? this.querySelector(`a`)?.href ?? ``;
		const found = youtubeProvider.match(url);

		if (!found) {
			return;
		}

		const template = /** @type {HTMLTemplateElement} */ (root.querySelector(`template`));
		const frame = /** @type {HTMLIFrameElement} */ (
			/** @type {DocumentFragment} */ (template.content.cloneNode(true)).firstElementChild
		);
		frame.src = playerUrl({ id: found.attrs.id, start: found.attrs.start });
		button.replaceWith(frame);
		frame.focus();
	}
}
