import { connect } from './connect.mjs';
import { login } from './login.mjs';

const browser = await connect();
const page = await browser.newPage();
const out = [];
const check = (name, ok, extra = ``) => out.push(`${ok ? `PASS` : `FAIL`} ${name} ${extra}`);
page.on(`pageerror`, (error) => out.push(`PAGEERROR ${error.message}`));
page.on(`console`, (message) => message.type() === `error` && out.push(`CONSOLE ${message.text()}`));

await login(page);
await page.goto(`http://localhost:8080/viewtopic.php?t=1`, { waitUntil: `networkidle0` });
const replyUrl = await page.$eval(`a[href*="mode=reply"]`, (a) => a.href);
await page.goto(replyUrl, { waitUntil: `networkidle0` });

await page.waitForSelector(`bf-editor`, { timeout: 5000 }).catch(() => {});
const state = await page.evaluate(() => ({
	editor: !!document.querySelector(`bf-editor`),
	hidden: document.querySelector(`#message`)?.hidden,
	plupload: !!window.phpbb?.plupload?.uploader,
	lang: document.documentElement.lang,
}));
check(`editor is on the reply page`, state.editor, JSON.stringify(state));
check(`textarea is hidden behind it`, state.hidden === true);

// Type with the real keyboard.
await page.click(`bf-editor bf-editable`).catch(() => {});
await page.evaluate(() => document.querySelector(`bf-editor`).focus());
await page.keyboard.type(`Hello **bold** world`);
const text = await page.$eval(`#message`, (t) => t.value);
check(`typing is written to the textarea as BBCode`, text === `Hello [b]bold[/b] world`, JSON.stringify(text));

// The topic review is a details element and opens on click.
check(`topic review is a closed details element`, await page.evaluate(() => document.querySelector(`details#review`)?.open === false));
await page.click(`details#review > summary`);
check(`clicking the summary opens it`, await page.evaluate(() => document.querySelector(`details#review`).open && document.querySelector(`#topicreview`).offsetHeight > 0));

// The old option boxes are gone.
check(`no option boxes for markdown, BBCode, smilies, URLs or signature`, await page.evaluate(() => !document.querySelector(`#disable_markdown, #disable_bbcode, #disable_smilies, #disable_magic_url, #attach_sig`)));

// Upload a picture through the real file picker of the editor.
await page.screenshot({ path: `/w/posting.png` });
const png = Buffer.from(`iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==`, `base64`);
await (await import(`node:fs`)).promises.writeFile(`/w/pixel.png`, png);
const input = await page.evaluateHandle(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`input[type="file"]`));
await input.uploadFile(`${process.env.HOST_DIR}/pixel.png`);
await new Promise((resolve) => setTimeout(resolve, 3000));
const after = await page.evaluate(() => ({
	value: document.querySelector(`bf-editor`).value,
	attachments: document.querySelector(`bf-editor`).shadowRoot.querySelectorAll(`.attachment`).length,
	uploads: document.querySelector(`bf-editor`).shadowRoot.querySelectorAll(`.upload`).length,
	status: document.querySelector(`bf-editor`).shadowRoot.querySelector(`output.visually-hidden`).textContent,
	hidden: [...document.querySelectorAll(`input[name^="attachment_data"]`)].map((i) => `${i.name}=${i.value}`).slice(0, 4),
	panel: document.querySelector(`#attach-panel`)?.hidden,
}));
check(`picture became an attachment in the editor`, after.attachments === 1 && after.uploads === 0, JSON.stringify(after));
check(`textarea has the attachment tag`, /\[attachment=0\]pixel\.png\[\/attachment\]/.test(await page.$eval(`#message`, (t) => t.value)));
check(`phpBB's own hidden attachment fields exist`, after.hidden.length > 0, after.hidden.join(` `));

console.log(out.join(`\n`));
out.length = 0;
// Post it.
await page.screenshot({ path: `/w/posting2.png` });
await page.evaluate(() => { window.__submits = 0; document.getElementById(`postform`).addEventListener(`submit`, (e) => { window.__submits += 1; window.__prevented = e.defaultPrevented; }); });
await Promise.all([page.waitForNavigation({ waitUntil: `networkidle0`, timeout: 8000 }).catch(() => console.log(`NO NAVIGATION`, JSON.stringify(out))), page.click(`input[name="post"]`)]);
console.log(`submits`, await page.evaluate(() => [window.__submits, window.__prevented, document.querySelector(`.phpbb_alert, #phpbb_alert`)?.innerText]));
const posted = await page.evaluate(() => {
	const last = [...document.querySelectorAll(`.postbody .content`)].pop();

	return { html: last?.innerHTML.slice(0, 400), images: last?.querySelectorAll(`img`).length, url: location.href };
});
check(`post saved with a picture and bold text`, /<strong[^>]*>bold<\/strong>/.test(posted.html) && posted.images >= 1, JSON.stringify(posted).slice(0, 500));

// Quoting puts the cursor on a line after the quote, so the writer can type outside it.
await page.goto(replyUrl.replace(`mode=reply`, `mode=quote`) + `&p=1`, { waitUntil: `networkidle0` });
await page.keyboard.type(`My answer`);
const quotedText = await page.$eval(`#message`, (t) => t.value);
check(`quoting: typing lands after the closing quote tag`, /\[\/quote\]\s*My answer$/.test(quotedText), JSON.stringify(quotedText.slice(-40)));

// The quote buttons of the topic review put the quote in the editor, with the cursor after it.
await page.goto(replyUrl, { waitUntil: `networkidle0` });
await page.click(`details#review > summary`);
await page.click(`#topicreview a[title^="Quote"]`);
// The editor takes the quote and moves the cursor after it. Typing before that goes nowhere.
await new Promise((resolve) => setTimeout(resolve, 500));
await page.keyboard.type(`Mine`);
const fromReview = await page.$eval(`#message`, (t) => t.value);
check(`topic review quote button fills the editor and the cursor is after it`, /^\[quote[^\]]*\][\s\S]*\[\/quote\]\s*Mine$/.test(fromReview), JSON.stringify(fromReview.slice(-50)));

console.log(out.join(`\n`));
await page.close();
await browser.disconnect();
