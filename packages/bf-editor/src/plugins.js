// The behaviour of the editing surface: keys, history, and typing shortcuts.
import { baseKeymap, chainCommands, exitCode } from 'prosemirror-commands';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { history, redo, undo } from 'prosemirror-history';
import { InputRule, inputRules, wrappingInputRule } from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import { Plugin } from 'prosemirror-state';
import { youtubeProvider } from './embeds/youtube.js';
import { setLink } from './link-command.js';
import { defaultLinkPolicy } from './link-policy.js';
import { defaultSmilies } from './smilies.js';
import { createUploadPlugin } from './upload.js';

/** @param {string} text */
const escapePattern = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`);

/**
 * Typing "**word**" makes bold, "*word*" italic, "~~word~~" strikethrough.
 * @param {RegExp} pattern
 * @param {import('prosemirror-model').MarkType} markType
 */
function markRule(pattern, markType) {
	return new InputRule(pattern, (state, match, start, end) => {
		const [full, , , text] = match;
		const tr = state.tr;
		tr.delete(start + (full.length - full.trimStart().length), end);
		const from = start + (full.length - full.trimStart().length);
		tr.insertText(text, from);
		tr.addMark(from, from + text.length, markType.create());
		tr.removeStoredMark(markType);

		return tr;
	});
}

/**
 * Typing a smilie code and then a space turns the code into an emoji.
 * @param {Record<string, string>} smilies code to emoji
 */
function smilieRule(smilies) {
	const codes = Object.keys(smilies)
		.sort((a, b) => b.length - a.length)
		.map(escapePattern);

	return new InputRule(new RegExp(`(^|\\s)(${codes.join(`|`)}) $`), (state, match, start, end) => {
		const lead = match[1];

		return state.tr.insertText(`${lead}${smilies[match[2]]} `, start, end);
	});
}

/** Shows the hint text while the document is empty. The hint itself is drawn by CSS. */
function emptyMarker() {
	return new Plugin({
		props: {
			attributes: (state) => {
				const doc = state.doc;
				const only = doc.firstChild;
				const empty = doc.childCount === 1 && only?.type.name === `paragraph` && only.content.size === 0;

				return /** @type {Record<string, string>} */ (empty ? { 'data-empty': `` } : {});
			},
		},
	});
}

/**
 * Pasting a web address makes a link: over selected text it links the text, otherwise the
 * address is written as a link. A video address pasted into an empty paragraph becomes a player.
 * Any other paste is left to ProseMirror.
 * @param {import('prosemirror-model').Schema} schema
 * @param {import('./contracts.js').LinkPolicy} policy
 * @param {import('./contracts.js').EmbedProvider[]} embeds
 */
function pasteLink(schema, policy, embeds) {
	return new Plugin({
		props: {
			handlePaste: (view, event) => {
				const text = event.clipboardData?.getData(`text/plain`).trim() ?? ``;

				if (!/^(https?:\/\/|mailto:)\S+$/i.test(text)) {
					return false;
				}

				const { $from, empty } = view.state.selection;
				const provider = embeds.find((candidate) => candidate.match(text));

				if (provider && empty && $from.parent.type === schema.nodes.paragraph && $from.parent.content.size === 0) {
					const player = schema.nodes.embed.create({ provider: provider.id, url: text, source: `` });
					const last = view.state.doc.lastChild === $from.parent;
					view.dispatch(
						view.state.tr
							.replaceWith($from.before(), $from.after(), last ? [player, schema.nodes.paragraph.create()] : player)
							.scrollIntoView(),
					);

					return true;
				}

				const href = policy.normalize(text);

				return href ? setLink(schema, href)(view.state, view.dispatch) : false;
			},
		},
	});
}

/**
 * @param {import('prosemirror-model').Schema} schema
 * @param {Array<import('./contracts.js').Command & {shortcut?: string}>} commands
 * @param {{smilies?: Record<string, string>, linkPolicy?: import('./contracts.js').LinkPolicy, embeds?: import('./contracts.js').EmbedProvider[], uploads?: ReturnType<typeof import('./upload.js').createUploads>}} [options]
 */
export function createPlugins(schema, commands, options = {}) {
	/** @type {Record<string, import('prosemirror-state').Command>} */
	const shortcuts = {};

	for (const command of commands) {
		if (command.shortcut) {
			shortcuts[command.shortcut] = command.run;
		}
	}

	const rules = [
		markRule(/(^|[\s])(\*\*)([^*\s](?:[^*]*[^*\s])?)\*\*$/, schema.marks.strong),
		markRule(/(^|[\s])(\*)([^*\s](?:[^*]*[^*\s])?)\*$/, schema.marks.em),
		markRule(/(^|[\s])(~~)([^~\s](?:[^~]*[^~\s])?)~~$/, schema.marks.strike),
		wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
		smilieRule(options.smilies ?? defaultSmilies),
	];

	return [
		...(options.uploads ? [createUploadPlugin(options.uploads)] : []),
		inputRules({ rules }),
		keymap({
			...shortcuts,
			'Mod-z': undo,
			'Mod-y': redo,
			'Shift-Mod-z': redo,
			// Shift+Enter is a line break, as in a phpBB post. Plain Enter is a new paragraph.
			'Shift-Enter': chainCommands(exitCode, (state, dispatch) => {
				if (dispatch) {
					dispatch(state.tr.replaceSelectionWith(schema.nodes.hard_break.create()).scrollIntoView());
				}

				return true;
			}),
		}),
		keymap(baseKeymap),
		history(),
		dropCursor(),
		gapCursor(),
		pasteLink(schema, options.linkPolicy ?? defaultLinkPolicy, options.embeds ?? [youtubeProvider]),
		emptyMarker(),
	];
}
