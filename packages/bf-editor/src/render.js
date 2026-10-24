// Entry point for pages that only show posts. No editor code.

import { BfYoutube } from './elements/bf-youtube.js';
import { useAttachmentList } from './render/attachments.js';
import { useNewWindowLinks } from './render/external-links.js';
import { useNativeEmoji, useNativeEmojiForText } from './render/native-emoji.js';
import { useYoutubePlayers, useYoutubeThumbnails } from './render/youtube.js';

export { useAttachmentList, useNativeEmoji, useNativeEmojiForText, useNewWindowLinks, useYoutubePlayers, useYoutubeThumbnails };

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

	for (const contact of document.querySelectorAll(`.postprofile .bf-contact`)) {
		useNewWindowLinks(contact);
	}

	useYoutubeThumbnails(document);
}
