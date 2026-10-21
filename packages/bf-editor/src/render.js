// Entry point for pages that only show posts. No editor code.

import { BfYoutube } from './elements/bf-youtube.js';
import { useAttachmentList } from './render/attachments.js';
import { useNewWindowLinks } from './render/external-links.js';
import { useNativeEmoji, useNativeEmojiForText } from './render/native-emoji.js';
import { useYoutubePlayers } from './render/youtube.js';

export { useAttachmentList, useNativeEmoji, useNativeEmojiForText, useNewWindowLinks, useYoutubePlayers };

if (typeof document !== `undefined`) {
	if (!customElements.get(`bf-youtube`)) {
		customElements.define(`bf-youtube`, BfYoutube);
	}

	useNativeEmoji(document);

	for (const post of document.querySelectorAll(`.postbody`)) {
		useAttachmentList(post);
	}

	for (const body of document.querySelectorAll(`.postbody .content, .signature, .message-box`)) {
		useNativeEmojiForText(body);
		useYoutubePlayers(body);
		useNewWindowLinks(body);
	}

	for (const list of document.querySelectorAll(`.postbody dl.attachbox`)) {
		useNewWindowLinks(list);
	}
}
