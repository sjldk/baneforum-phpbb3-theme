import { connect } from './connect.mjs';
import { login } from './login.mjs';

const DIR = process.argv[2];
const browser = await connect();
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 1200 });
await page.setCacheEnabled(false);
const check = (name, ok, extra = ``) => console.log(`${ok ? `PASS` : `FAIL`} ${name} ${extra}`);
page.on(`pageerror`, (error) => console.log(`PAGEERROR ${error.message}`));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const state = () => page.evaluate(() => {
	const root = document.querySelector(`bf-editor`).shadowRoot;

	return {
		inText: [...root.querySelectorAll(`bf-editable .attachment`)].map((a) => !!a.querySelector(`img:not([hidden])`)),
		textarea: document.querySelector(`#message`).value,
		panelShown: document.querySelector(`#attach-panel`)?.offsetHeight > 0,
		rows: [...document.querySelectorAll(`#file-list > .attach-row`)].filter((r) => r.offsetHeight > 0).map((r) => r.querySelector(`.file-name`)?.textContent.trim()),
		tab: document.querySelector(`#attach-panel-tab`)?.classList.contains(`activetab`),
	};
});

await login(page);
await page.goto(`${process.env.BASE ?? `http://localhost:8080`}/posting.php?mode=reply&t=1`, { waitUntil: `networkidle0` });
await page.waitForSelector(`bf-editor`);
await wait(1500);
const input = await page.evaluateHandle(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`input[type="file"]`));
await input.uploadFile(`${DIR}/manual.pdf`);
await wait(3000);
let s = await state();
check(`a PDF is not put in the text`, s.inText.length === 0 && !s.textarea.includes(`[attachment`), JSON.stringify(s));
check(`it is in the list under the editor`, s.panelShown && s.rows.some((n) => n?.includes(`manual.pdf`)), JSON.stringify(s.rows));

await page.evaluate(() => {
	const editable = document.querySelector(`bf-editor`).shadowRoot.querySelector(`bf-editable`);
	const transfer = new DataTransfer();
	transfer.items.add(new File([new Uint8Array([80, 75, 3, 4])], `pack.zip`, { type: `application/zip` }));
	const rect = editable.getBoundingClientRect();
	editable.dispatchEvent(new DragEvent(`drop`, { clientX: rect.left + 50, clientY: rect.top + 20, bubbles: true, cancelable: true, dataTransfer: transfer }));
});
await wait(3000);
s = await state();
check(`a dropped ZIP joins the list`, s.rows.length === 2 && s.rows.some((n) => n?.includes(`pack.zip`)), JSON.stringify(s.rows));
await page.screenshot({ path: `/w/files-editor.png`, clip: { x: 0, y: 200, width: 1000, height: 900 } });

// A picture goes in the text.
const input2 = await page.evaluateHandle(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`input[type="file"]`));
await input2.uploadFile(`${DIR}/small.png`);
await wait(3000);
s = await state();
check(`a picture goes in the text and not in the list`, s.inText.length === 1 && s.inText[0] === true && s.rows.length === 2, JSON.stringify(s));

await page.evaluate(() => document.querySelector(`bf-editor`).focus());
await Promise.all([page.waitForNavigation({ waitUntil: `networkidle0` }), page.click(`input[name="post"]`)]);
await wait(500);
const post = await page.evaluate(() => {
	const body = [...document.querySelectorAll(`.postbody`)].pop();
	const link = body.querySelector(`figure.file a`);

	return {
		files: [...body.querySelectorAll(`dl.attachbox .attachment-file .attachment-name`)].map((a) => a.textContent.trim()),
		inTextFiles: body.querySelectorAll(`.content .attachment-file`).length,
		pictureLink: link ? { target: link.target, rel: link.rel, warned: !!link.querySelector(`.bf-visually-hidden`), href: link.getAttribute(`href`) } : null,
	};
});
check(`the post lists both files under the text`, post.files.length === 2, JSON.stringify(post));
check(`and the picture opens whole in a new tab`, post.pictureLink?.target === `_blank` && post.pictureLink.rel.includes(`noopener`) && post.pictureLink.warned, JSON.stringify(post.pictureLink));
await page.screenshot({ path: `/w/files-post.png`, fullPage: false });

// An older post with a file placed in the text: it moves to the list.
await page.goto(`${process.env.BASE ?? `http://localhost:8080`}/viewtopic.php?t=1`, { waitUntil: `networkidle0` });
const old = await page.evaluate(() => ({
	placed: document.querySelectorAll(`.content .inline-attachment .attachment-file`).length,
	listed: document.querySelectorAll(`dl.attachbox .attachment-file`).length,
	emptyWrappers: [...document.querySelectorAll(`.inline-attachment`)].filter((e) => e.children.length === 0).length,
}));
check(`files placed in the text of older posts are moved to the list`, old.placed === 0 && old.listed >= 3 && old.emptyWrappers === 0, JSON.stringify(old));
await page.close();
await browser.disconnect();
