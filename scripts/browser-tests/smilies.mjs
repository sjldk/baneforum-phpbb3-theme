import { connect } from './connect.mjs';
import { login } from './login.mjs';

const browser = await connect();
const page = await browser.newPage();
await page.setCacheEnabled(false);
await login(page);
const report = async (name) => {
	const r = await page.evaluate(() => {
		const rest = [...document.querySelectorAll(`.content, .signature, .message-box, .postbody`)].filter((e) => /(^|\s)(:\)|:D|;\)|:-\))(\s|$)/.test(e.textContent) && !e.querySelector(`.content, .signature`));

		return { images: document.querySelectorAll(`img.smilies, img.emoji`).length, textSmiliesLeft: rest.length, sample: rest.slice(0, 2).map((e) => e.parentElement?.className + `>` + e.className) };
	});
	console.log(name, JSON.stringify(r));
};

await page.goto(`http://localhost:8080/viewtopic.php?t=1`, { waitUntil: `networkidle0` });
await report(`viewtopic`);
await page.goto(`http://localhost:8080/search.php?keywords=bold&terms=all&sr=posts&sf=all&sd=d&st=0&ch=300&t=0&submit=Search`, { waitUntil: `networkidle0` });
await report(`search results`);
await page.goto(`http://localhost:8080/posting.php?mode=reply&t=1`, { waitUntil: `networkidle0` });
await report(`reply page with topic review`);
await page.waitForSelector(`bf-editor`);
await page.evaluate(() => document.querySelector(`bf-editor`).focus());
await page.keyboard.type(`preview :) and :D `);
console.log(`typed -> textarea:`, JSON.stringify(await page.$eval(`#message`, (t) => t.value)));
await Promise.all([page.waitForNavigation({ waitUntil: `networkidle0` }), page.click(`input[name="preview"]`)]);
await report(`preview`);
console.log(`editor value after preview:`, JSON.stringify(await page.$eval(`bf-editor`, (e) => e.value)));
await page.goto(`http://localhost:8080/ucp.php?i=ucp_profile&mode=signature`, { waitUntil: `networkidle0` });
await report(`signature page`);
await page.close();
await browser.disconnect();
