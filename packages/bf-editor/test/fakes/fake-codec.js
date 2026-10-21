// A codec that keeps the text as it is. Lets tests run without ProseMirror documents.
export const fakeCodec = {
	id: `fake`,
	parse: (text) => ({ text }),
	serialize: (doc) => doc.text,
};
