import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { applyLabels, format, labelsFor } from '../src/labels.js';

test(`the page language chooses the words, and English fills any gap`, () => {
	assert.equal(labelsFor(`da`).bold, `Fed`);
	assert.equal(labelsFor(`da-DK`).bold, `Fed`);
	assert.equal(labelsFor(`en-gb`).bold, `Bold`);
	assert.equal(labelsFor(`fr`).bold, `Bold`);
	assert.equal(labelsFor(``).bold, `Bold`);
});

test(`a host can replace a word`, () => {
	assert.equal(labelsFor(`da`, { bold: `Halvfed` }).bold, `Halvfed`);
	assert.equal(labelsFor(`da`, { bold: `Halvfed` }).italic, `Kursiv`);
});

test(`every English word has a Danish one`, () => {
	// "Link" is the same word in both languages.
	const english = Object.keys(labelsFor(`en`)).filter((key) => key !== `link`);
	const danish = labelsFor(`da`);

	for (const key of english) {
		assert.notEqual(danish[key], labelsFor(`en`)[key], key);
	}
});

test(`format fills the named places`, () => {
	assert.equal(format(`Uploading {name}`, { name: `a.png` }), `Uploading a.png`);
	assert.equal(format(`{name} and {missing}`, { name: `x` }), `x and `);
});

test(`applyLabels names buttons and fills texts`, () => {
	const dom = new JSDOM(
		`<button data-label="bold" aria-keyshortcuts="Control+B"></button><dialog data-label="link"></dialog><span data-text="play">Play</span>`,
	);
	const { document } = dom.window;
	globalThis.HTMLButtonElement ??= dom.window.HTMLButtonElement;
	applyLabels(document, labelsFor(`da`));
	assert.equal(document.querySelector(`button`).getAttribute(`aria-label`), `Fed`);
	assert.equal(document.querySelector(`button`).title, `Fed (Ctrl+B)`);
	assert.equal(document.querySelector(`dialog`).getAttribute(`aria-label`), `Link`);
	assert.equal(document.querySelector(`span`).textContent, `Afspil video`);
});
