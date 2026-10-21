// An embed provider for addresses like fake://clip/123.
export const fakeEmbedProvider = {
	id: `fake`,
	match(url) {
		const found = /^fake:\/\/clip\/(\d+)$/.exec(url);

		return found ? { provider: `fake`, attrs: { id: found[1] } } : null;
	},
	toUrl: (attrs) => `fake://clip/${attrs.id}`,
};
