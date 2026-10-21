export const fakeLinkPolicy = {
	normalize: (url) => (/^https?:\/\//.test(url) ? url : null),
	attributes: () => ({ target: '_blank', rel: 'noopener noreferrer' }),
};
