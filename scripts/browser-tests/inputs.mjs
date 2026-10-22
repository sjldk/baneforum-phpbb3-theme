// A focused text field changes its border colour and has no outline or halo on top of it.
import { connect } from './connect.mjs';
import { login } from './login.mjs';

const browser = await connect();
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 1000 });
await page.setCacheEnabled(false);
const check = (name, ok, extra = ``) => console.log(`${ok ? `PASS` : `FAIL`} ${name} ${extra}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const read = (el) => {
	const cs = getComputedStyle(el);

	return { border: cs.borderTopWidth, color: cs.borderTopColor, outline: `${cs.outlineStyle} ${cs.outlineWidth}`, shadow: cs.boxShadow };
};

await login(page);
await page.goto(`http://localhost:8080/posting.php?mode=reply&t=1`, { waitUntil: `networkidle0` });
await page.waitForSelector(`bf-editor`);
await wait(500);

for (const [name, selector] of [[`subject`, `#subject`], [`search box`, `search.php #keywords`]]) {
	if (selector.startsWith(`search.php`)) {
		await page.goto(`http://localhost:8080/search.php`, { waitUntil: `networkidle0` });
	}

	const target = await page.$(selector.replace(`search.php `, ``));

	if (!target) {
		continue;
	}

	await page.evaluate((el) => el.blur(), target);
	await wait(300);
	const before = await page.evaluate(read, target);
	await target.focus();
	await wait(300);
	const after = await page.evaluate(read, target);
	check(`${name}: the border changes colour`, before.color !== after.color, `${before.color} -> ${after.color}`);
	check(`${name}: same border width`, before.border === after.border, `${before.border} -> ${after.border}`);
	check(`${name}: no outline and no halo`, after.outline.startsWith(`none`) && after.shadow === `none`, JSON.stringify(after));
}

await page.goto(`http://localhost:8080/posting.php?mode=reply&t=1`, { waitUntil: `networkidle0` });
await page.waitForSelector(`bf-editor`);
await wait(500);
// Inside the editor: the link dialog field and the picture menu field.
await page.evaluate(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`[command="--link"]`).click());
await wait(400);
const dialog = await page.evaluate(() => {
	const input = document.querySelector(`bf-editor`).shadowRoot.querySelector(`dialog input`);
	input.focus();
	const cs = getComputedStyle(input);

	return { outline: cs.outlineStyle, color: cs.borderTopColor, width: cs.borderTopWidth };
});
check(`link dialog field: border only`, dialog.outline === `none` && parseFloat(dialog.width) >= 2, JSON.stringify(dialog));
await page.close();
await browser.disconnect();
