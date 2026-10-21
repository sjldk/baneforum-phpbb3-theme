// The small interfaces the editor core depends on (SOLID: interface segregation and
// dependency inversion). The core never imports a concrete implementation. A host
// project, or a test, passes implementations in.

/**
 * @typedef {object} Codec  Turns stored text into an editor document and back.
 * @property {string} id  Short name, for example "markdown" or "bbcode-legacy".
 * @property {(text: string) => import('prosemirror-model').Node} parse
 * @property {(doc: import('prosemirror-model').Node) => string} serialize
 */

/**
 * @typedef {object} UploadResult
 * @property {string} src  Address the browser can show the file from.
 * @property {string} name  File name.
 * @property {string|number} [id]  Host specific id, for example a phpBB attachment id.
 */

/**
 * @typedef {object} UploadHandler  Sends one file to the host and reports back.
 * @property {(file: File, options: {onProgress?: (fraction: number) => void, signal?: AbortSignal}) => Promise<UploadResult>} upload
 */

/**
 * @typedef {object} EmbedMatch
 * @property {string} provider  Provider id, for example "youtube".
 * @property {Record<string, string>} attrs  Attributes for the embed node.
 */

/**
 * @typedef {object} EmbedProvider  Recognises a link that should become an inline player.
 * @property {string} id
 * @property {(url: string) => EmbedMatch | null} match
 * @property {(attrs: Record<string, string>) => string} toUrl  The text saved for this embed.
 */

/**
 * @typedef {object} LinkPolicy  Decides what a link looks like.
 * @property {(url: string) => string | null} normalize  Clean address, or null if not allowed.
 * @property {(url: string) => {target?: string, rel?: string}} attributes
 */

/**
 * @typedef {object} Command  One toolbar action.
 * @property {string} id
 * @property {string} label  Visible and spoken name.
 * @property {(state: import('prosemirror-state').EditorState, dispatch?: (tr: import('prosemirror-state').Transaction) => void, view?: import('prosemirror-view').EditorView) => boolean} run
 * @property {(state: import('prosemirror-state').EditorState) => boolean} [isActive]
 */

const contracts = {
	Codec: ['id', 'parse', 'serialize'],
	UploadHandler: ['upload'],
	EmbedProvider: ['id', 'match', 'toUrl'],
	LinkPolicy: ['normalize', 'attributes'],
	Command: ['id', 'label', 'run'],
};

/**
 * Fails with a clear message if an object does not have the members of a contract.
 * Used by the editor when it receives its collaborators, and by the tests.
 *
 * @param {keyof typeof contracts} contract
 * @param {object} candidate
 * @returns {object} the candidate, so the call can wrap an argument
 */
export function assertImplements(contract, candidate) {
	const members = contracts[contract];

	if (!members) {
		throw new Error(`Unknown contract "${contract}"`);
	}

	if (candidate === null || typeof candidate !== 'object') {
		throw new TypeError(`${contract}: expected an object, got ${typeof candidate}`);
	}

	const missing = members.filter((name) => !(name in candidate));

	if (missing.length > 0) {
		throw new TypeError(`${contract}: missing ${missing.join(', ')}`);
	}

	return candidate;
}

export const contractNames = Object.keys(contracts);
