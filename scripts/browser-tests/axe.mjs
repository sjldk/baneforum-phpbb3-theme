import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { login } from './login.mjs';

const axeSource = fs.readFileSync(`/w/node_modules/axe-core/axe.min.js`, `utf8`);
const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:9222` });
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 1000 });
await page.setCacheEnabled(false);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(name) {
	await page.evaluate(axeSource);
	const result = await page.evaluate(async () => {
		const r = await window.axe.run(document, { runOnly: { type: `tag`, values: [`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `wcag2aaa`, `best-practice`] } });

		return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 2).map((n) => n.target.join(` `).slice(0, 90) + ` :: ` + (n.any[0]?.message ?? n.all[0]?.message ?? n.none[0]?.message ?? ``).slice(0, 110)) }));
	});
	console.log(`\n== ${name}: ${result.length} kinds of problem`);

	for (const v of result) {
		console.log(`  [${v.impact}] ${v.id} x${v.nodes}: ${v.help}\n      ${v.sample.join(`\n      `)}`);
	}
}

// Guest pages first.
const context = await browser.createBrowserContext();
const guest = await context.newPage();
await guest.setCacheEnabled(false);
const guestPage = page;
for (const url of [`ucp.php?mode=login`]) {
	await guest.goto(`http://localhost:8080/${url}`, { waitUntil: `networkidle0` });
	await guest.evaluate(axeSource);
	const r = await guest.evaluate(async () => (await window.axe.run(document, { runOnly: { type: `tag`, values: [`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `wcag2aaa`, `best-practice`] } })).violations.map((v) => `${v.impact} ${v.id} x${v.nodes.length} ${v.nodes[0].target.join(` `).slice(0, 70)}`));
	console.log(`\n== guest ${url}: ${r.length}\n  ${r.join(`\n  `)}`);
}
await context.close();

await login(page);

for (const [name, url] of [[`index`, `index.php`], [`topic with posts, picture, player`, `viewtopic.php?t=1`]]) {
	await page.goto(`http://localhost:8080/${url}`, { waitUntil: `networkidle0` });
	await wait(500);
	await run(name);
}

await page.goto(`http://localhost:8080/posting.php?mode=post&f=2`, { waitUntil: `networkidle0` });
await page.waitForSelector(`bf-editor`);
await wait(1500);
await run(`new topic with editor`);

// Editor with a picture and the picture menu open.
const input = await page.evaluateHandle(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`input[type="file"]`));
await input.uploadFile(`${process.env.HOST_DIR}/small.png`);
await page.waitForFunction(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`bf-editable .attachment img`)?.naturalWidth > 0, { timeout: 15000 }).catch(() => {});
await page.evaluate(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`bf-editable .attachment`).click());
await wait(400);
await run(`editor with a picture and its menu open`);

// Link dialog open.
await page.keyboard.press(`Escape`);
await page.evaluate(() => { const e = document.querySelector(`bf-editor`); e.focus(); e.shadowRoot.querySelector(`[command="--link"]`).click(); });
await wait(300);
await run(`editor with the link dialog open`);
await page.close();
await browser.disconnect();
