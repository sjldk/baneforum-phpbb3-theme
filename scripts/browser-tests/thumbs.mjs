import { connect } from './connect.mjs';
import { login } from './login.mjs';
const browser = await connect();
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 1100 });
await page.setCacheEnabled(false);
await login(page);
await page.goto(`http://localhost:8080/posting.php?mode=reply&t=1`, { waitUntil: `networkidle0` });
await page.waitForSelector(`bf-editor`);
await new Promise((r) => setTimeout(r, 1500));
const input = await page.evaluateHandle(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`input[type="file"]`));
await input.uploadFile(process.argv[2]);
await new Promise((r) => setTimeout(r, 3500));
// take the tag out of the text so the file is listed with a thumbnail
await page.evaluate(() => { const t = document.querySelector(`#message`); t.value = ``; document.querySelector(`bf-editor`).value = ``; });
await page.evaluate(() => { document.querySelector(`#message`).value = `x`; document.querySelector(`bf-editor`).value = `x`; });
await new Promise((r) => setTimeout(r, 1600));
await Promise.all([page.waitForNavigation({ waitUntil: `networkidle0` }), page.click(`input[name="preview"]`)]);
await page.waitForSelector(`bf-editor`);
await new Promise((r) => setTimeout(r, 1500));
const check = (name, ok, extra = ``) => console.log(`${ok ? `PASS` : `FAIL`} ${name} ${extra}`);
const info = await page.evaluate(async () => {
	const img = document.querySelector(`#file-list .attach-row:not(.attach-row-tpl) .attach-thumb`);
	if (!img) return null;
	const whole = await fetch(img.src.replace(/&t=1/, ``)).then((r) => r.arrayBuffer());
	const small = await fetch(img.src).then((r) => r.arrayBuffer());

	return { src: img.src, width: img.naturalWidth, wholeBytes: whole.byteLength, thumbBytes: small.byteLength };
});
check(`a picture that is not in the text shows its small copy`, !!info && info.src.endsWith(`&t=1`) && info.width > 0 && info.width <= 400 && info.thumbBytes < info.wholeBytes, JSON.stringify(info));

// An old picture has no small copy. The list shows it whole.
await page.goto(`http://localhost:8080/posting.php?mode=edit&p=2`, { waitUntil: `networkidle0` });
await page.waitForSelector(`bf-editor`);
await new Promise((r) => setTimeout(r, 1500));
const old = await page.evaluate(() => [...document.querySelectorAll(`#file-list .attach-row:not(.attach-row-tpl) .attach-thumb`)].map((img) => img.naturalWidth));
check(`a picture with no small copy is shown whole`, old.length > 0 && old.every((width) => width > 0), JSON.stringify(old));
await page.close();
await browser.disconnect();
