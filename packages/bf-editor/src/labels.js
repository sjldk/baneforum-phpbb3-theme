// The words the editor shows and speaks. English and Danish are built in, the page language
// (`<html lang>`) chooses, and a host can replace any word. The HTML templates name a word with
// `data-label` (button name) or `data-text` (visible text), and this file holds the words.

/** @type {Record<string, Record<string, string>>} */
const languages = {
	en: {
		formatting: `Formatting`,
		message: `Message`,
		bold: `Bold`,
		italic: `Italic`,
		strike: `Strikethrough`,
		normal: `Normal text`,
		quote: `Quote`,
		bulletList: `Bullet list`,
		numberedList: `Numbered list`,
		table: `Table`,
		tableBar: `Table tools`,
		tableColumns: `Columns`,
		tableRows: `Rows`,
		tableSize: `{columns} columns × {rows} rows`,
		tableInsert: `Insert`,
		tableCut: `The table was larger than {columns} × {rows}. The rest was cut off.`,
		rowAbove: `Insert row above`,
		rowBelow: `Insert row below`,
		columnLeft: `Insert column left`,
		columnRight: `Insert column right`,
		deleteRow: `Delete row`,
		deleteColumn: `Delete column`,
		deleteTable: `Delete table`,
		link: `Link`,
		attach: `Attach file`,
		linkAddress: `Web address`,
		linkRemove: `Remove link`,
		linkCancel: `Cancel`,
		linkSave: `Save`,
		uploadRemove: `Remove`,
		uploadCancel: `Cancel`,
		uploading: `Uploading {name}`,
		uploaded: `Uploaded {name}`,
		uploadFailed: `Could not upload {name}. {message}`,
		uploadError: `Could not upload: {message}`,
		uploadUnavailable: `Uploading is not available here.`,
		uploadsBusy: `Wait until the pictures have been uploaded.`,
		attachmentMenu: `Attachment`,
		attachmentDescription: `Description`,
		attachmentSave: `Save`,
		attachmentRemove: `Delete`,
		play: `Play video`,
		newWindow: `(opens in a new window)`,
		attachments: `Attachments`,
	},
	da: {
		formatting: `Formatering`,
		message: `Besked`,
		bold: `Fed`,
		italic: `Kursiv`,
		strike: `Gennemstreget`,
		normal: `Normal tekst`,
		quote: `Citat`,
		bulletList: `Punktliste`,
		numberedList: `Nummereret liste`,
		table: `Tabel`,
		tableBar: `Tabelværktøjer`,
		tableColumns: `Kolonner`,
		tableRows: `Rækker`,
		tableSize: `{columns} kolonner × {rows} rækker`,
		tableInsert: `Indsæt`,
		tableCut: `Tabellen var større end {columns} × {rows}. Resten er skåret væk.`,
		rowAbove: `Indsæt række over`,
		rowBelow: `Indsæt række under`,
		columnLeft: `Indsæt kolonne til venstre`,
		columnRight: `Indsæt kolonne til højre`,
		deleteRow: `Slet række`,
		deleteColumn: `Slet kolonne`,
		deleteTable: `Slet tabel`,
		link: `Link`,
		attach: `Vedhæft fil`,
		linkAddress: `Webadresse`,
		linkRemove: `Fjern link`,
		linkCancel: `Annuller`,
		linkSave: `Gem`,
		uploadRemove: `Fjern`,
		uploadCancel: `Annuller`,
		uploading: `Uploader {name}`,
		uploaded: `{name} er uploadet`,
		uploadFailed: `Kunne ikke uploade {name}. {message}`,
		uploadError: `Kunne ikke uploade: {message}`,
		uploadUnavailable: `Upload er ikke tilgængelig her.`,
		uploadsBusy: `Vent til billederne er uploadet.`,
		attachmentMenu: `Vedhæftning`,
		attachmentDescription: `Beskrivelse`,
		attachmentSave: `Gem`,
		attachmentRemove: `Slet`,
		play: `Afspil video`,
		newWindow: `(åbner i et nyt vindue)`,
		attachments: `Vedhæftede filer`,
	},
};

/**
 * Gives the words for a language. English fills every gap, and the host can replace single words.
 * @param {string} [language]  for example "da" or "en-gb"
 * @param {Record<string, string>} [overrides]  words that replace the built in ones
 * @returns {Record<string, string>}
 */
export function labelsFor(language = ``, overrides = {}) {
	return { ...languages.en, ...languages[language.slice(0, 2).toLowerCase()], ...overrides };
}

/**
 * Fills `{name}` style places in a word.
 * @param {string} text
 * @param {Record<string, string>} [values]
 */
export function format(text, values = {}) {
	return text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? ``);
}

/**
 * Puts the words into the elements of a template.
 * `data-label`: the name of a button or region (aria-label, and the tooltip for a button).
 * `data-text`: the visible text.
 * @param {ParentNode} root
 * @param {Record<string, string>} words
 */
export function applyLabels(root, words) {
	for (const element of root.querySelectorAll(`[data-label]`)) {
		const word = words[/** @type {string} */ (element.getAttribute(`data-label`))];

		if (word === undefined) {
			continue;
		}

		element.setAttribute(`aria-label`, word);

		if (element instanceof HTMLButtonElement) {
			const keys = element.getAttribute(`aria-keyshortcuts`)?.replace(`Control`, `Ctrl`);
			element.title = keys ? `${word} (${keys})` : word;
		}
	}

	for (const element of root.querySelectorAll(`[data-text]`)) {
		element.textContent = words[/** @type {string} */ (element.getAttribute(`data-text`))] ?? element.textContent;
	}
}
