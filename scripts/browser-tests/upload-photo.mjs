// Uploads one picture through the editor of a reply page and waits until it is an attachment. It posts nothing.
//
//   scripts/browser-tests/run.sh upload-photo.mjs tmp-flip6.jpg
//
// The file must be inside scripts/browser-tests/ (Chrome runs on the host and needs a host path). Used to look at what happens to a picture on
// its way: the browser's resize, the board's own checks and the imagecompress extension. Add BASE, BF_USER and BF_PASS for another board.
import { connect } from './connect.mjs';
import { login } from './login.mjs';

const base = process.env.BASE ?? `http://localhost:8080`;
const topic = process.env.TOPIC ?? `1`;
const file = process.argv[2];
const browser = await connect();
const page = await browser.newPage();
page.on(`pageerror`, (error) => console.log(`PAGEERROR ${error.message}`));

await login(page);
await page.goto(`${base}/viewtopic.php?t=${topic}`, { waitUntil: `networkidle0` });
await page.goto(await page.$eval(`a[href*="mode=reply"]`, (a) => a.href), { waitUntil: `networkidle0` });
await page.waitForSelector(`bf-editor`, { timeout: 15000 });
// phpBB refuses an upload sent in the same second the page was made.
await new Promise((resolve) => setTimeout(resolve, 1500));

const input = await page.evaluateHandle(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`input[type="file"]`));
await input.uploadFile(`${process.env.HOST_DIR}/${file}`);

let state = { attachments: 0, uploads: 1, status: `` };
for (let tries = 0; tries < 60 && !(state.attachments === 1 && state.uploads === 0); tries += 1) {
	await new Promise((resolve) => setTimeout(resolve, 1000));
	state = await page.evaluate(() => {
		const root = document.querySelector(`bf-editor`).shadowRoot;

		return { attachments: root.querySelectorAll(`.attachment`).length, uploads: root.querySelectorAll(`.upload`).length, status: root.querySelector(`output.visually-hidden`).textContent };
	});
}

console.log(JSON.stringify({ file, ...state }));
await page.close();
browser.disconnect();
