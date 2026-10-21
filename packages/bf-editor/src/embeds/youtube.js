// The YouTube EmbedProvider: recognises the address forms people paste and says which one to save.
// Forms: watch?v=ID, youtu.be/ID, /shorts/ID, /live/ID, /embed/ID, with a start time as
// t=90, t=1m30s or start=90. Hosts: youtube.com (with www, m, music) and youtube-nocookie.com.

const hosts = /^(?:www\.|m\.|music\.)?(?:youtube\.com|youtube-nocookie\.com)$/;
const idPattern = /^[\w-]{11}$/;

/**
 * "90", "1m30s" or "1h2m3s" as seconds.
 * @param {string | null} text
 * @returns {number}
 */
export function parseStart(text) {
	if (!text) {
		return 0;
	}

	if (/^\d+$/.test(text)) {
		return Number(text);
	}

	const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(text);

	return parts ? Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0) : 0;
}

/**
 * @param {string} text
 * @returns {import('../contracts.js').EmbedMatch | null}
 */
function match(text) {
	let url;

	try {
		url = new URL(text.trim());
	} catch {
		return null;
	}

	if (!/^https?:$/.test(url.protocol)) {
		return null;
	}

	/** @type {string | undefined} */
	let id;

	if (url.hostname === `youtu.be`) {
		id = url.pathname.slice(1);
	} else if (hosts.test(url.hostname)) {
		const path = /^\/(?:shorts|live|embed|v)\/([^/]+)/.exec(url.pathname);
		id = path ? path[1] : url.pathname === `/watch` ? (url.searchParams.get(`v`) ?? undefined) : undefined;
	}

	if (!id || !idPattern.test(id)) {
		return null;
	}

	const start = parseStart(url.searchParams.get(`t`) ?? url.searchParams.get(`start`));

	return { provider: `youtube`, attrs: { id, start: String(start) } };
}

/** @type {import('../contracts.js').EmbedProvider} */
export const youtubeProvider = {
	id: `youtube`,
	match,
	toUrl: (attrs) => `https://www.youtube.com/watch?v=${attrs.id}${Number(attrs.start) > 0 ? `&t=${attrs.start}` : ``}`,
};

/**
 * The address of the player that shows the video. Nothing loads from it until the visitor clicks.
 * @param {{id: string, start?: string}} attrs
 */
export function playerUrl({ id, start }) {
	const query = new URLSearchParams({ autoplay: `1`, rel: `0` });

	if (Number(start) > 0) {
		query.set(`start`, String(start));
	}

	return `https://www.youtube-nocookie.com/embed/${id}?${query}`;
}
