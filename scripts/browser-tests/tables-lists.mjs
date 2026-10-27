// Lists and tables in the editor, with the real keyboard and pointer: the buttons, the picker, Tab and Enter in a table,
// the table bar, the limit of 8 columns and 5 rows, and the text that is written to the textarea.
import fs from 'node:fs';
import { connect } from './connect.mjs';
import { login } from './login.mjs';

const browser = await connect();
const page = await browser.newPage();
const out = [];
const check = (name, ok, extra = ``) => out.push(`${ok ? `PASS` : `FAIL`} ${name} ${ok ? `` : extra}`);
page.on(`pageerror`, (error) => out.push(`PAGEERROR ${error.message} ${String(error.stack).split(`\n`).slice(0, 3).join(` | `)}`));

// The login sometimes does not stick when tests follow each other closely, so it is tried again.
for (let attempt = 0; attempt < 4; attempt += 1) {
	await login(page);
	await page.goto(`${process.env.BASE ?? `http://localhost:8080`}/viewtopic.php?t=1`, { waitUntil: `networkidle0` });
	await page.goto(await page.$eval(`a[href*="mode=reply"]`, (a) => a.href), { waitUntil: `networkidle0` });

	if (await page.$(`bf-editor`)) {
		break;
	}

	await new Promise((resolve) => setTimeout(resolve, 2000));
}

await page.waitForSelector(`bf-editor`, { timeout: 5000 });

const value = () => page.$eval(`#message`, (textarea) => textarea.value);
/** Runs a function in the page with the shadow root of the editor (and one argument). */
const inEditor = (code, argument) =>
	page.evaluate(
		(source, given) => new Function(`root`, `given`, `return (${source})(root, given)`)(document.querySelector(`bf-editor`).shadowRoot, given),
		String(code),
		argument,
	);
const press = async (selector) => {
	await inEditor((root, given) => root.querySelector(given).click(), selector);
};
const focusEditor = () => page.evaluate(() => document.querySelector(`bf-editor`).focus());

// Lists: the typing rule, Enter, Tab for a nested item.
await focusEditor();
await page.keyboard.type(`- apples`);
await page.keyboard.press(`Enter`);
await page.keyboard.type(`pears`);
await page.keyboard.press(`Enter`);
await page.keyboard.press(`Tab`);
await page.keyboard.type(`green pears`);
check(`a list is typed with "- ", Enter and Tab`, (await value()) === `[list]\n[*]apples\n[*]pears\n[list]\n[*]green pears\n[/list]\n[/list]`, JSON.stringify(await value()));

// Enter makes an empty nested item, Enter lifts it out of the nested list, Enter leaves the list.
for (let step = 0; step < 3; step += 1) {
	await page.keyboard.press(`Enter`);
}

await page.keyboard.type(`after`);
check(`Enter on an empty item leaves the list`, /\[\/list\]\n\nafter$/.test(await value()), JSON.stringify(await value()));

// Backspace in an empty item in the middle of a nested list removes the item, and the list keeps its flow.
await page.evaluate(async () => {
	const editor = document.querySelector(`bf-editor`);
	editor.value = `[list]\n[*]a\n[list]\n[*]b\n[*]c\n[*]d\n[/list]\n[*]e\n[/list]`;
	editor.focus();
	await new Promise((resolve) => setTimeout(resolve, 100));
	const { view } = editor;
	let at = 0;
	view.state.doc.descendants((node, position) => {
		if (node.isText && node.text === `c`) {
			at = position + 1;
		}
	});
	view.dispatch(view.state.tr.setSelection(view.state.selection.constructor.near(view.state.doc.resolve(at))));
});
await page.keyboard.press(`Backspace`);
await page.keyboard.press(`Backspace`);
await page.keyboard.type(`X`);
check(`Backspace on an empty item in a nested list removes it and joins the line above`, (await value()) === `[list]\n[*]a\n[list]\n[*]bX\n[*]d\n[/list]\n[*]e\n[/list]`, JSON.stringify(await value()));

// Numbered lists change their marker with the level, as in Word (1. then a. then i.), and a list with its own marker keeps it.
const markers = await inEditor((root) => {
	const editor = root.host;
	editor.value = `[list=1]\n[*]one\n[list=1]\n[*]two\n[list=1]\n[*]three\n[list=1]\n[*]four\n[/list]\n[/list]\n[/list]\n[*]five\n[list=A]\n[*]own\n[/list]\n[/list]`;

	return [...root.querySelectorAll(`bf-editable ol`)].map((list) => getComputedStyle(list).listStyleType);
});
check(`numbered list markers by level: decimal, lower-alpha, lower-roman, decimal; own marker kept`, markers.join() === `decimal,lower-alpha,lower-roman,decimal,upper-alpha`, markers.join());

// Tables: open the picker, choose 4 x 3 with the pointer.
await page.evaluate(() => {
	document.querySelector(`bf-editor`).value = ``;
});
const topBefore = await inEditor((root) => root.querySelector(`bf-editable`).getBoundingClientRect().top);
await focusEditor();
await press(`button[command="--table"]`);
const picker = await inEditor((root) => {
	const form = root.querySelector(`form.table-picker`);

	return { open: form.matches(`:popover-open`), squares: form.querySelectorAll(`.grid span`).length, hidden: form.querySelector(`.grid`).getAttribute(`aria-hidden`) };
});
check(`the picker is a popover with a fixed 8 x 5 grid that screen readers skip`, picker.open && picker.squares === 40 && picker.hidden === `true`, JSON.stringify(picker));
const lit = await inEditor((root) => {
	const form = root.querySelector(`form.table-picker`);
	form.querySelector(`.grid span[data-column="5"][data-row="2"]`).dispatchEvent(new PointerEvent(`pointerover`, { bubbles: true }));

	return { on: form.querySelectorAll(`.grid span.on`).length, size: form.querySelector(`.size`).textContent, fields: [form.querySelector(`input[name="columns"]`).value, form.querySelector(`input[name="rows"]`).value] };
});
check(`the pointer colours the squares inside the grid and fills the fields`, lit.on === 10 && lit.fields.join() === `5,2`, JSON.stringify(lit));
await inEditor((root) => {
	const square = root.querySelector(`.grid span[data-column="4"][data-row="3"]`);
	square.dispatchEvent(new PointerEvent(`pointerover`, { bubbles: true }));
	square.click();
});
await new Promise((resolve) => setTimeout(resolve, 200));
check(`a click on a square makes a table of that size, the first row is header cells`, (await value()) === `[table]\n[tr][th][/th][th][/th][th][/th][th][/th][/tr]\n[tr][td][/td][td][/td][td][/td][td][/td][/tr]\n[tr][td][/td][td][/td][td][/td][td][/td][/tr]\n[/table]`, JSON.stringify(await value()));
check(`the table bar shows while the cursor is in the table`, await inEditor((root) => !root.querySelector(`menu.table-bar`).hidden));
const floating = await inEditor((root) => {
	const bar = root.querySelector(`menu.table-bar`).getBoundingClientRect();
	const table = root.querySelector(`bf-editable table`).getBoundingClientRect();

	return { top: root.querySelector(`bf-editable`).getBoundingClientRect().top, below: bar.top >= table.bottom, aligned: Math.abs(bar.left - table.left) < 2 };
});
check(`the editor does not move when the table bar appears`, floating.top === topBefore, `${topBefore} -> ${floating.top}`);
check(`the table bar floats right under the table, at its left edge`, floating.below && floating.aligned, JSON.stringify(floating));

// Tab goes through the cells, and Tab in the last cell adds a row.
await page.keyboard.type(`Name`);
await page.keyboard.press(`Tab`);
await page.keyboard.type(`Age`);
// 12 cells: 10 more Tabs reach the last one, the 11th adds the row.
for (let step = 0; step < 11; step += 1) {
	await page.keyboard.press(`Tab`);
}

check(`Tab through all cells adds a row at the end`, ((await value()).match(/\[tr\]/g) ?? []).length === 4, JSON.stringify(await value()));

// The bar: add a column to the right until 8, and it stops. The same for rows at 5.
for (let step = 0; step < 10; step += 1) {
	await press(`button[command="--column-right"]`);
}

const widest = await value();
const columns = (widest.split(`\n`)[1].match(/\[th\]/g) ?? []).length;
check(`add column stops at 8`, columns === 8, String(columns));
check(`the add column buttons are off at 8`, await inEditor((root) => root.querySelector(`button[command="--column-right"]`).getAttribute(`aria-disabled`) === `true`));
for (let step = 0; step < 10; step += 1) {
	await press(`button[command="--row-below"]`);
}

check(`add row stops at 5`, ((await value()).match(/\[tr\]/g) ?? []).length === 5, String(((await value()).match(/\[tr\]/g) ?? []).length));

// The number fields: 21 is refused by the form.
await press(`button[command="--table"]`);
const refused = await inEditor((root) => {
	const form = root.querySelector(`form.table-picker`);
	form.querySelector(`input[name="columns"]`).value = `9`;

	return form.checkValidity();
});
check(`9 columns in the number field is refused`, refused === false);
await page.keyboard.press(`Escape`);

// axe (A, AA, AAA) with the table bar showing and with the picker open, in the light and the dark theme.
const axeSource = fs.readFileSync(`/w/node_modules/axe-core/axe.min.js`, `utf8`);
const axeProblems = async () => {
	await page.evaluate(axeSource);

	return page.evaluate(async () => {
		const result = await window.axe.run(document, { runOnly: { type: `tag`, values: [`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `wcag2aaa`] } });

		return result.violations.map((v) => `${v.id} ${v.nodes[0].target.join(` `).slice(0, 80)}`);
	});
};

for (const theme of [`light`, `dark`]) {
	await page.evaluate((name) => document.documentElement.setAttribute(`data-theme`, name), theme);
	check(`axe, ${theme} theme, table bar showing`, (await axeProblems()).length === 0, (await axeProblems()).join(`; `));
	await press(`button[command="--table"]`);
	check(`axe, ${theme} theme, picker open`, (await axeProblems()).length === 0, (await axeProblems()).join(`; `));
	await page.keyboard.press(`Escape`);
}

// Arrow keys leave the table at its top and bottom, to a line to write on (no invisible gap cursor).
await page.evaluate(async () => {
	const editor = document.querySelector(`bf-editor`);
	editor.value = `[table]\n[tr][th]a[/th][/tr]\n[tr][td]b[/td][/tr]\n[/table]`;
	editor.focus();
	await new Promise((resolve) => setTimeout(resolve, 100));
	const { view } = editor;
	view.dispatch(view.state.tr.setSelection(view.state.selection.constructor.near(view.state.doc.resolve(3))));
});
await page.keyboard.press(`ArrowDown`);
await page.keyboard.press(`ArrowDown`);
await page.keyboard.type(`below`);
check(`Arrow down out of the last row gives a line under the table`, /\[\/table\]\n\nbelow$/.test(await value()), JSON.stringify(await value()));
await page.keyboard.press(`ArrowUp`);
await page.keyboard.press(`ArrowUp`);
await page.keyboard.press(`ArrowUp`);
await page.keyboard.type(`above`);
check(`Arrow up out of the first row gives a line over the table`, /^above\n\n\[table\]/.test(await value()), JSON.stringify(await value()));
check(`the cursor is never an invisible gap cursor`, await page.evaluate(() => document.querySelector(`bf-editor`).view.state.selection.constructor.name !== `GapCursor` && document.querySelector(`bf-editor`).view.state.selection.toJSON().type === `text`));

await focusEditor();
await page.evaluate(() => {
	const { view } = document.querySelector(`bf-editor`);
	let at = 0;
	view.state.doc.descendants((node, position) => {
		if (node.isText && node.text === `a`) {
			at = position + 1;
		}
	});
	view.dispatch(view.state.tr.setSelection(view.state.selection.constructor.near(view.state.doc.resolve(at))));
});
// The steps of the bug report: make a table, go up over it to a line, come back in, type. The first row must not shift.
await page.evaluate(() => {
	document.querySelector(`bf-editor`).value = ``;
});
await focusEditor();
await press(`button[command="--table"]`);
await inEditor((root) => {
	const square = root.querySelector(`.grid span[data-column="3"][data-row="2"]`);
	square.dispatchEvent(new PointerEvent(`pointerover`, { bubbles: true }));
	square.click();
});
await new Promise((resolve) => setTimeout(resolve, 200));
await page.keyboard.press(`ArrowUp`);
await page.keyboard.type(`line`);
await page.keyboard.press(`ArrowDown`);
await page.keyboard.type(`X`);
check(`out over the table and back in: the first row does not shift`, /^line\n\n\[table\]\n\[tr\]\[th\]X\[\/th\]\[th\]\[\/th\]\[th\]\[\/th\]\[\/tr\]/.test(await value()), JSON.stringify(await value()));

// Delete table.
await focusEditor();
await press(`button[command="--delete-table"]`);
check(`delete table removes it`, !/\[table\]/.test(await value()), JSON.stringify(await value()));

console.log(out.join(`\n`));
await page.close();
browser.disconnect();
