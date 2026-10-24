// Does a new post written with Markdown get parsed as Markdown? Used to prove the Markdown switches of the board (ACP, Board configuration:
// "Allow Markdown in posts" and so on). It posts a reply the way the old editor does: without the field disable_markdown, which our editor
// would send. It prints whether the stars were turned into bold or stayed as typed.
//
//   BASE=http://localhost:8081 BF_USER=Baneforum.dk BF_PASS=adminadmin TOPIC=4512 scripts/browser-tests/run.sh markdown-switch.mjs
//
// Makes one throwaway reply on the board, so use it on a copy.
import { connect } from './connect.mjs';
import { login } from './login.mjs';

const base = process.env.BASE ?? `http://localhost:8080`;
const topic = process.env.TOPIC ?? `1`;
const browser = await connect();
const page = await browser.newPage();

await login(page);
await page.goto(`${base}/viewtopic.php?t=${topic}`, { waitUntil: `networkidle0` });
await page.goto(await page.$eval(`a[href*="mode=reply"]`, (a) => a.href), { waitUntil: `networkidle0` });

const marker = `mdswitch${Date.now()}`;
await page.evaluate((text) => {
	// The old editor has no such field. Ours sends it, and then nothing is Markdown, which would hide what this test looks for.
	for (const field of document.querySelectorAll(`input[name="disable_markdown"]`)) {
		field.remove();
	}

	/** @type {HTMLTextAreaElement} */ (document.querySelector(`#message`)).value = `${text} **bold** and *italic*`;
}, marker);
// phpBB refuses a form that is sent in the same second the page was made.
await new Promise((resolve) => setTimeout(resolve, 1500));
await Promise.all([page.waitForNavigation({ waitUntil: `networkidle0` }), page.click(`input[name="post"]`)]);

const result = await page.evaluate((text) => {
	const content = [...document.querySelectorAll(`.postbody .content`)].find((element) => element.textContent.includes(text));

	return content
		? { found: true, stars: content.textContent.includes(`**bold**`), strong: Boolean(content.querySelector(`strong`)), html: content.innerHTML.trim().slice(0, 200) }
		: { found: false };
}, marker);

console.log(JSON.stringify({ marker, ...result }));
await page.close();
browser.disconnect();
