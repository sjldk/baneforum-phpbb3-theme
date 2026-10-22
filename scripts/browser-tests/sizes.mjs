import { connect } from './connect.mjs';
import { login } from './login.mjs';

const HOST = process.argv[2];
const browser = await connect();
const page = await browser.newPage();
await page.setCacheEnabled(false);
await login(page);
await page.goto(`http://localhost:8080/posting.php?mode=reply&t=1`, { waitUntil: `networkidle0` });
await page.waitForSelector(`bf-editor`);
console.log(`limits`, JSON.stringify(await page.evaluate(() => ({ max: window.phpbb.plupload.config.max_file_size, chunk: window.phpbb.plupload.config.chunk_size, maxFiles: window.phpbb.plupload.maxFiles }))));

for (const name of (process.argv[3] ?? `small.png,mid.png,big.png,huge.png`).split(`,`)) {
	await page.goto(`http://localhost:8080/posting.php?mode=reply&t=1`, { waitUntil: `networkidle0` });
	await page.waitForSelector(`bf-editor`);
	await new Promise((r) => setTimeout(r, 1500));
	const input = await page.evaluateHandle(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`input[type="file"]`));
	await input.uploadFile(`${HOST}/${name}`);
	await new Promise((r) => setTimeout(r, 4000));
	console.log(name, JSON.stringify(await page.evaluate(() => {
		const root = document.querySelector(`bf-editor`).shadowRoot;

		return { status: root.querySelector(`output.visually-hidden`).textContent, attachments: root.querySelectorAll(`.attachment`).length, error: root.querySelector(`.upload output`)?.textContent };
	})));
}

await page.close();
await browser.disconnect();
