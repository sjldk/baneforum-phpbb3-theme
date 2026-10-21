// Entry point for pages that only show posts. No editor code.
import { BfYoutube } from './elements/bf-youtube.js';
import { useNewWindowLinks } from './render/external-links.js';
import { useNativeEmoji, useNativeEmojiForText } from './render/native-emoji.js';
import { useYoutubePlayers } from './render/youtube.js';

export { useNativeEmoji, useNativeEmojiForText, useNewWindowLinks, useYoutubePlayers };

if (typeof document !== `undefined`) {
	if (!customElements.get(`bf-youtube`)) {
		customElements.define(`bf-youtube`, BfYoutube);
	}

	useNativeEmoji(document);

	for (const body of document.querySelectorAll(`.postbody .content, .signature, .message-box`)) {
		useNativeEmojiForText(body);
		useYoutubePlayers(body);
		useNewWindowLinks(body);
	}
}
