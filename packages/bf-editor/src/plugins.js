// The behaviour of the editing surface: keys, history, and typing shortcuts.
import { baseKeymap, chainCommands, exitCode } from 'prosemirror-commands';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { history, redo, undo } from 'prosemirror-history';
import { InputRule, inputRules, wrappingInputRule } from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import { liftListItem, sinkListItem, splitListItem } from 'prosemirror-schema-list';
import { Plugin } from 'prosemirror-state';
import { deleteCellSelection, tableEditing } from 'prosemirror-tables';
import { createAttachmentMenuPlugin } from './attachment-menu.js';
import { backspaceInList } from './commands.js';
import { youtubeProvider } from './embeds/youtube.js';
import { setLink } from './link-command.js';
import { defaultLinkPolicy } from './link-policy.js';
import { defaultSmilies } from './smilies.js';
import {
	enterTable,
	keepCursorInCells,
	leaveTable,
	limitPastedTables,
	lineBreakInCell,
	moveInTable,
	nextCell,
	previousCell,
} from './table-commands.js';
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
 * @param {{smilies?: Record<string, string>, linkPolicy?: import('./contracts.js').LinkPolicy, embeds?: import('./contracts.js').EmbedProvider[], uploads?: ReturnType<typeof import('./upload.js').createUploads>, menu?: ReturnType<typeof import('./attachment-menu.js').createAttachmentMenu>, onTableCut?: () => void}} [options]
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
		// "- ", "* " or "+ " at the start of a line starts a bullet list. "1. " starts a numbered one.
		wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list),
		wrappingInputRule(/^\s*(\d{1,3})\.\s$/, schema.nodes.ordered_list, () => ({ marker: `1` })),
		smilieRule(options.smilies ?? defaultSmilies),
	];

	return [
		...(options.uploads ? [createUploadPlugin(options.uploads)] : []),
		...(options.menu ? [createAttachmentMenuPlugin(options.menu)] : []),
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
		// In a table: Tab and Shift+Tab move between cells (Tab in the last cell adds a row), Enter is a line break in the cell,
		// and an arrow key moves from cell to cell, and at the edge of the table to a line above or below it (made if there is none).
		// These come before the gap cursor, which would otherwise take the arrow keys and hide the cursor between two cells.
		// A pasted table keeps at most MAX_TABLE_COLUMNS columns and MAX_TABLE_ROWS rows. Delete clears the selected cells.
		new Plugin({
			props: {
				transformPasted: (slice) => limitPastedTables(schema, slice, options.onTableCut ?? (() => {})),
			},
		}),
		keymap({
			Tab: nextCell,
			'Shift-Tab': previousCell,
			Enter: lineBreakInCell(schema),
			ArrowDown: chainCommands(leaveTable(`down`, schema), moveInTable(`down`), enterTable(`down`, schema)),
			ArrowUp: chainCommands(leaveTable(`up`, schema), moveInTable(`up`), enterTable(`up`, schema)),
			ArrowRight: chainCommands(leaveTable(`right`, schema), moveInTable(`right`), enterTable(`right`, schema)),
			ArrowLeft: chainCommands(leaveTable(`left`, schema), moveInTable(`left`), enterTable(`left`, schema)),
			Backspace: deleteCellSelection,
			Delete: deleteCellSelection,
		}),
		// In a list: Enter makes a new item (in an empty one it leaves the list), Tab and Shift+Tab move an item in and out,
		// Backspace at the start of an item clears its bullet (first item) or joins the line above.
		// Where they do nothing, the key goes on to the browser, so the keyboard is never trapped in the editor.
		keymap({
			Enter: splitListItem(schema.nodes.list_item),
			Backspace: backspaceInList(schema),
			Tab: sinkListItem(schema.nodes.list_item),
			'Shift-Tab': liftListItem(schema.nodes.list_item),
			'Mod-]': sinkListItem(schema.nodes.list_item),
			'Mod-[': liftListItem(schema.nodes.list_item),
		}),
		keymap(baseKeymap),
		history(),
		dropCursor(),
		gapCursor(),
		pasteLink(schema, options.linkPolicy ?? defaultLinkPolicy, options.embeds ?? [youtubeProvider]),
		// After the paste plugin above, so a pasted web address is still made a link.
		tableEditing(),
		keepCursorInCells(schema),
		emptyMarker(),
	];
}
