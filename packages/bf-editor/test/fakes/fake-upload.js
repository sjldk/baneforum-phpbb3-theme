// An uploader that finishes at once and records what it was given.
export function fakeUploadHandler() {
	const uploaded = [];

	return {
		uploaded,
		async upload(file, { onProgress } = {}) {
			onProgress?.(1);
			uploaded.push(file.name);

			return { src: `blob:fake/${file.name}`, name: file.name, id: uploaded.length };
		},
	};
}
