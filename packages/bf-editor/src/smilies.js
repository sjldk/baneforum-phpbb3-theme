// phpBB smilie codes and the Unicode emoji that replace them.
// The default phpBB set. Codes are matched as whole words, longest first.
// Covers the default phpBB set and the 20 codes the Baneforum board has.
export const defaultSmilies = Object.freeze({
	':-)': '🙂',
	':)': '🙂',
	':smile:': '🙂',
	';-)': '😉',
	';)': '😉',
	':wink:': '😉',
	':-D': '😀',
	':D': '😀',
	':grin:': '😀',
	':-(': '🙁',
	':(': '🙁',
	':sad:': '🙁',
	':-P': '😛',
	':P': '😛',
	':razz:': '😛',
	':-o': '😮',
	':o': '😮',
	':O': '😮',
	':eek:': '😮',
	':shock:': '😲',
	':-?': '😕',
	':?': '😕',
	':???:': '😕',
	'8-)': '😎',
	'8)': '😎',
	':cool:': '😎',
	':lol:': '😂',
	':x': '😠',
	':-x': '😠',
	':mad:': '😠',
	':oops:': '😳',
	':cry:': '😭',
	':evil:': '😈',
	':twisted:': '😈',
	':roll:': '🙄',
	':!:': '❗',
	':?:': '❓',
	':idea:': '💡',
	':arrow:': '➡️',
	':|': '😐',
	':-|': '😐',
	':mrgreen:': '😁',
	':geek:': '🤓',
	':ugeek:': '🤓',
});

// phpBB smilie pictures by file name, for a picture whose code is not in the map above.
export const smilieImages = Object.freeze({
	icon_e_smile: '🙂',
	icon_e_biggrin: '😀',
	icon_e_confused: '😕',
	icon_e_sad: '🙁',
	icon_e_surprised: '😮',
	icon_e_wink: '😉',
	icon_e_geek: '🤓',
	icon_e_ugeek: '🤓',
	icon_razz: '😛',
	icon_lol: '😂',
	icon_mad: '😠',
	icon_cool: '😎',
	icon_cry: '😭',
	icon_evil: '😈',
	icon_twisted: '😈',
	icon_redface: '😳',
	icon_rolleyes: '🙄',
	icon_neutral: '😐',
	icon_arrow: '➡️',
	icon_idea: '💡',
	icon_question: '❓',
	icon_exclaim: '❗',
	icon_mrgreen: '😁',
	icon_eek: '😮',
	icon_surprised: '😮',
});

/** @param {string} text */
function escapeRegExp(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {Record<string, string>} [map] code to emoji
 * @returns {(text: string) => string} replaces the codes in a piece of text
 */
export function createSmilieReplacer(map = defaultSmilies) {
	const codes = Object.keys(map)
		.sort((a, b) => b.length - a.length)
		.map(escapeRegExp);
	// A code must not touch a letter, digit or slash on either side, so "http://x" and "a:b" stay.
	const pattern = new RegExp(`(?<![\\p{L}\\p{N}/:])(${codes.join('|')})(?![\\p{L}\\p{N}])`, 'gu');

	return (text) => text.replace(pattern, (code) => map[code]);
}
