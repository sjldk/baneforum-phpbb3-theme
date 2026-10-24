// A link policy that lets only http and https addresses through and opens them in a new window.
export const fakeLinkPolicy = {
	normalize: (url) => (/^https?:\/\//.test(url) ? url : null),
	attributes: () => ({ target: `_blank`, rel: `noopener noreferrer` }),
};
