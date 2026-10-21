import puppeteer from 'puppeteer-core';
import { login } from './login.mjs';

const PHOTO = process.argv[2];
const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:9222` });
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 1100 });
await page.setCacheEnabled(false);
const out = [];
const check = (name, ok, extra = ``) => console.log(`${ok ? `PASS` : `FAIL`} ${name} ${extra}`);
page.on(`pageerror`, (error) => console.log(`PAGEERROR ${error.message}`));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const editorState = () => page.evaluate(() => {
	const root = document.querySelector(`bf-editor`).shadowRoot;
	const img = root.querySelector(`bf-editable .attachment img`);

	return {
		attachments: root.querySelectorAll(`bf-editable .attachment`).length,
		shown: !!img && !img.hidden && img.naturalWidth > 0,
		alt: img?.alt,
		textarea: document.querySelector(`#message`).value,
		data: (window.phpbb.plupload.data ?? []).map((d) => [d.attach_id, d.attach_comment]),
	};
});

await login(page);
await page.goto(`http://localhost:8080/posting.php?mode=reply&t=1`, { waitUntil: `networkidle0` });
await page.waitForSelector(`bf-editor`);
await wait(1500);
check(`no tab bar`, await page.evaluate(() => !document.querySelector(`#tabs`)));
check(`options show without a tab`, await page.evaluate(() => document.querySelector(`#options-panel`)?.offsetHeight > 0));
check(`attachment panel is out of sight`, await page.evaluate(() => document.querySelector(`#attach-panel`)?.offsetHeight === 0));

const input = await page.evaluateHandle(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`input[type="file"]`));
await input.uploadFile(PHOTO);
await page.waitForFunction(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`bf-editable .attachment img`)?.naturalWidth > 0, { timeout: 15000 }).catch(() => {});
let state = await editorState();
check(`uploaded picture is shown in the editor`, state.attachments === 1 && state.shown, JSON.stringify(state));
await page.screenshot({ path: `/w/pictures-1.png`, clip: { x: 0, y: 150, width: 1000, height: 700 } });

// Open the menu by clicking the picture.
await page.evaluate(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`bf-editable .attachment`).click());
await wait(300);
const menu = await page.evaluate(() => {
	const form = document.querySelector(`bf-editor`).shadowRoot.querySelector(`form[popover]`);

	return { open: form.matches(`:popover-open`), focused: document.querySelector(`bf-editor`).shadowRoot.activeElement?.name, rect: form.getBoundingClientRect().toJSON() };
});
check(`clicking the picture opens the menu with focus in the description`, menu.open && menu.focused === `description`, JSON.stringify(menu));
await page.screenshot({ path: `/w/pictures-2.png`, clip: { x: 0, y: 150, width: 1000, height: 700 } });
await page.keyboard.type(`A red square in the corner`);
await page.keyboard.press(`Enter`);
await wait(300);
state = await editorState();
check(`description is stored as the attachment comment`, state.data[0]?.[1] === `A red square in the corner`, JSON.stringify(state.data));
check(`and is the alt text`, state.alt === `A red square in the corner`);
check(`and is in the field phpBB sends`, await page.evaluate(() => [document.querySelector(`[data-attach-id] textarea`)?.value, document.querySelector(`input[name="attachment_data[0][attach_comment]"]`)?.value].join(`|`)) === `A red square in the corner|A red square in the corner`);
check(`menu closed after saving`, await page.evaluate(() => !document.querySelector(`bf-editor`).shadowRoot.querySelector(`form[popover]`).matches(`:popover-open`)));

// Preview reloads the page. The picture must still be there.
await page.evaluate(() => document.querySelector(`bf-editor`).focus());
await page.keyboard.type(` text`);
await Promise.all([page.waitForNavigation({ waitUntil: `networkidle0` }), page.click(`input[name="preview"]`)]);
await page.waitForSelector(`bf-editor`);
await wait(800);
state = await editorState();
check(`after Preview the picture is still shown in the editor`, state.attachments === 1 && state.shown, JSON.stringify(state));
check(`with its description`, state.alt === `A red square in the corner`);
await page.screenshot({ path: `/w/pictures-3.png`, clip: { x: 0, y: 150, width: 1000, height: 900 } });

// Delete from the menu.
await page.keyboard.press(`Escape`);
await page.evaluate(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`bf-editable .attachment`).click());
await wait(300);
await page.evaluate(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`form[popover] button[value="remove"]`).click());
await wait(2500);
state = await editorState();
check(`deleting removes the picture from the editor`, state.attachments === 0, JSON.stringify(state));
check(`and from the text`, !state.textarea.includes(`[attachment`), JSON.stringify(state.textarea));
check(`and the file from phpBB's list`, state.data.length === 0, JSON.stringify(state.data));
await page.close();
await browser.disconnect();
