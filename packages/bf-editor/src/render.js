// Entry point for pages that only show posts. No editor code.
import { useNativeEmoji, useNativeEmojiForText } from './render/native-emoji.js';

export { useNativeEmoji, useNativeEmojiForText };

if (typeof document !== 'undefined') {
	useNativeEmoji(document);

	for (const body of document.querySelectorAll('.postbody .content, .signature, .message-box')) {
		useNativeEmojiForText(body);
	}
}
