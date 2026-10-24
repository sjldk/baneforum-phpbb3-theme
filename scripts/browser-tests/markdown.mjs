// A post written in Markdown is converted to BBCode when it is opened in the editor, and a post in BBCode is not touched.
// Makes one throwaway reply on topic 1 (with the editor's "no Markdown" field left out, so the board reads it as Markdown).
import { connect } from './connect.mjs';
import { login } from './login.mjs';

const browser = await connect();
const page = await browser.newPage();
const out = [];
const check = (name, ok, extra = ``) => out.push(`${ok ? `PASS` : `FAIL`} ${name} ${extra}`);
page.on(`pageerror`, (error) => out.push(`PAGEERROR ${error.message}`));

const markdown = [
	`# Big heading`,
	``,
	`Some **bold** and *italic* with a [link](https://example.com/a) and ~~gone~~.`,
	``,
	`- one`,
	`- two`,
	``,
	`1. first`,
	`2. second`,
	``,
	`> quoted **text**`,
	``,
	'```',
	`code line`,
	'```',
].join(`\n`);
const bbcode = [
	`[size=150][b]Big heading[/b][/size]`,
	``,
	`Some [b]bold[/b] and [i]italic[/i] with a [url=https://example.com/a]link[/url] and [s]gone[/s].`,
	``,
	`[list]`,
	`[*]one`,
	`[*]two`,
	`[/list]`,
	`[list=1]`,
	`[*]first`,
	`[*]second`,
	`[/list]`,
	``,
	`[quote]`,
	`quoted [b]text[/b]`,
	`[/quote]`,
	``,
	`[code]`,
	`code line`,
	`[/code]`,
].join(`\n`);

await login(page);
await page.goto(`http://localhost:8080/viewtopic.php?t=1`, { waitUntil: `networkidle0` });
const replyUrl = await page.$eval(`a[href*="mode=reply"]`, (a) => a.href);
await page.goto(replyUrl, { waitUntil: `networkidle0` });
await page.waitForSelector(`bf-editor`);
await page.waitForFunction(() => document.querySelector(`input[name="disable_markdown"]`));
check(`the editor tells the board that its text is not Markdown`, true);
// Write Markdown the way the board saw it before the editor: no "disable_markdown" field.
await page.evaluate((text) => {
	document.querySelector(`input[name="disable_markdown"]`).remove();
	document.querySelector(`#message`).value = text;
}, markdown);
await new Promise((resolve) => setTimeout(resolve, 1600));
await Promise.all([page.waitForNavigation({ waitUntil: `networkidle0` }), page.click(`input[name="post"]`)]);
const postId = new URL(page.url()).hash.replace(`#p`, ``) || new URL(page.url()).searchParams.get(`p`);
check(`a Markdown post was made`, /^\d+$/.test(postId), postId);

const stored = await page.$eval(`#p${postId} .content`, (c) => c.innerHTML);
check(`the board shows it as Markdown (bold, list)`, /<strong>bold<\/strong>/.test(stored) && /<h1/.test(stored), stored.slice(0, 120));

// Open it in the editor.
const editUrl = `http://localhost:8080/posting.php?mode=edit&p=${postId}`;
await page.goto(editUrl, { waitUntil: `networkidle0` });
await page.waitForSelector(`bf-editor`);
const opened = await page.evaluate(() => ({
	flag: document.querySelector(`#message`).dataset.bfMarkdown,
	text: document.querySelector(`#message`).value,
}));
check(`the board flags the post as Markdown`, opened.flag === `1`, JSON.stringify(opened.flag));
check(`the text is converted to BBCode when opened`, opened.text === bbcode, JSON.stringify(opened.text));

// Save without changing anything.
await new Promise((resolve) => setTimeout(resolve, 1600));
await Promise.all([page.waitForNavigation({ waitUntil: `networkidle0` }), page.click(`input[name="post"]`)]);
const html = await page.$eval(`#p${postId} .content`, (c) => c.innerHTML);
check(
	`saved unchanged, it still shows bold, italic, link, strikethrough, lists, quote, code`,
	/<strong[^>]*>bold<\/strong>/.test(html) &&
		/<em[^>]*>italic<\/em>/.test(html) &&
		/<a [^>]*href="https:\/\/example\.com\/a"[^>]*>link/.test(html) &&
		/<del>gone<\/del>/.test(html) &&
		/<li>(<p>)?one/.test(html) &&
		/<ol[^>]*>[\s\S]*<li>(<p>)?first/.test(html) &&
		/<blockquote/.test(html) &&
		/<code>[\s\S]*code line/.test(html),
	html.slice(0, 1500),
);

// Open again: it is BBCode now, no flag, and saving it again keeps the text exactly.
await page.goto(editUrl, { waitUntil: `networkidle0` });
await page.waitForSelector(`bf-editor`);
const again = await page.evaluate(() => ({
	flag: document.querySelector(`#message`).dataset.bfMarkdown,
	text: document.querySelector(`#message`).value,
}));
check(`opened again: no Markdown flag`, again.flag === undefined, JSON.stringify(again.flag));
check(`opened again: the BBCode text is the same`, again.text === bbcode, JSON.stringify(again.text));

// The private message page has the editor too, and the board gives it the same flag.
await page.goto(`http://localhost:8080/ucp.php?i=pm&mode=compose`, { waitUntil: `networkidle0` });
await page.waitForSelector(`bf-editor`);
check(`the private message page has the editor and no Markdown flag`, await page.$eval(`#message`, (t) => t.dataset.bfMarkdown === undefined));

console.log(out.join(`\n`));
await page.close();
await browser.disconnect();
