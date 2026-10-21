// The default LinkPolicy: which addresses are allowed, and how a link opens.
// Only web and mail addresses pass. Anything else (javascript:, data:) is refused.

const allowedSchemes = new Set([`http:`, `https:`, `mailto:`]);

/**
 * @param {string} url what the user typed or pasted
 * @returns {string | null} a clean address, or null if it is not allowed
 */
function normalize(url) {
	const text = url.trim();

	if (text === `` || /\s/.test(text)) {
		return null;
	}

	if (/^[a-z][a-z0-9+.-]*:/i.test(text)) {
		try {
			return allowedSchemes.has(new URL(text).protocol) ? text : null;
		} catch {
			return null;
		}
	}

	// "example.com/page" is a web address without its scheme.
	if (/^[^/?#.]+(\.[^/?#.]+)+([/?#].*)?$/.test(text)) {
		return `https://${text}`;
	}

	return null;
}

/** @type {import('./contracts.js').LinkPolicy} */
export const defaultLinkPolicy = {
	normalize,
	attributes: (url) => (/^mailto:/i.test(url) ? {} : { target: `_blank`, rel: `noopener noreferrer` }),
};
