// axe-core (WCAG A, AA, AAA) on the pages the theme work touches: topic and forum lists, a topic, the new topic page with the poll open,
// the reply page with the topic review open, search results, the delete dialog, and a phone-width topic list. Prints the problems.
import fs from 'node:fs';
import { connect } from './connect.mjs';
import { login } from './login.mjs';
const src = fs.readFileSync(`/w/node_modules/axe-core/axe.min.js`, `utf8`);
const browser = await connect();
const page = await browser.newPage();
await login(page);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function run(name, width = 1100) {
	await page.setViewport({ width, height: 900 });
	await page.evaluate(src);
	const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: `tag`, values: [`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `wcag2aaa`] } })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, s: v.nodes.slice(0, 2).map((x) => x.target.join(` `).slice(0, 70) + ` :: ` + (x.any[0]?.message ?? x.all[0]?.message ?? ``).slice(0, 120)) })));
	console.log(`== ${name} (${width}px): ${r.length}`);
	for (const v of r) console.log(`  [${v.impact}] ${v.id} x${v.n}\n     ${v.s.join(`\n     `)}`);
}
for (const [n, u] of [[`topic list`, `viewforum.php?f=4`], [`forum list`, `viewforum.php?f=3`], [`topic`, `viewtopic.php?t=21`], [`new topic + poll`, `posting.php?mode=post&f=2`], [`reply with review`, `posting.php?mode=reply&t=21`], [`search results`, `search.php?search_id=active_topics`]]) {
	await page.goto(`http://localhost:8080/${u}`, { waitUntil: `networkidle0` });
	if (n.includes(`poll`)) await page.evaluate(() => document.querySelector(`#poll-panel`)?.setAttribute(`open`, ``));
	if (n.includes(`review`)) await page.evaluate(() => document.querySelector(`#review`)?.setAttribute(`open`, ``));
	await run(n);
}
await page.goto(`http://localhost:8080/viewtopic.php?t=21`, { waitUntil: `networkidle0` });
await page.click(`.post-buttons a[href*="mode=delete"], .post-buttons a[href*="mode=soft_delete"]`);
await wait(800);
await run(`delete dialog open`);
await page.keyboard.press(`Escape`);
await page.goto(`http://localhost:8080/viewforum.php?f=4`, { waitUntil: `networkidle0` });
await run(`topic list`, 402);
await browser.close();
