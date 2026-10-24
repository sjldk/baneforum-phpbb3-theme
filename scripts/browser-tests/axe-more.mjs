// axe-core (WCAG A, AA, AAA) in the light and the dark theme on the pages that the other tests skip: the control panel, private
// messages, search, the member list, a profile, the reply page with the topic review, and a topic with pictures.
// Prints one line per page and theme, and the problems. Exit code 1 if there are any.
// Another board: BASE=http://localhost:8081 GUEST=1 (guest: no login, only the pages a guest can open; PAGES=a,b picks pages).
import fs from 'node:fs';
import { connect } from './connect.mjs';
import { login } from './login.mjs';

const src = fs.readFileSync(`/w/node_modules/axe-core/axe.min.js`, `utf8`);
const browser = await connect();
const page = await browser.newPage();
const base = process.env.BASE ?? `http://localhost:8080`;

if (!process.env.GUEST) {
	await login(page);
}

const all = [
	[`control panel`, `ucp.php`],
	[`private messages, compose`, `ucp.php?i=pm&mode=compose`],
	[`private messages, inbox`, `ucp.php?i=pm&folder=inbox`],
	[`profile settings`, `ucp.php?i=ucp_profile&mode=profile_info`],
	[`search`, `search.php`],
	[`search results, posts`, `search.php?keywords=reply&sr=posts&sf=all`],
	[`member list`, `memberlist.php`],
	[`profile`, `memberlist.php?mode=viewprofile&u=2`],
	[`reply with review`, `posting.php?mode=reply&t=${process.env.TOPIC ?? 14}`],
	[`topic with pictures`, process.env.TOPIC ? `viewtopic.php?t=${process.env.TOPIC}` : `viewtopic.php?t=22`],
	[`board index`, `index.php`],
];

const wanted = process.env.PAGES?.split(`,`);
const pages = wanted ? all.filter(([name]) => wanted.includes(name)) : process.env.GUEST ? all.filter(([name]) => !/control|private|profile settings/.test(name)) : all;
let problems = 0;

for (const theme of [`light`, `dark`]) {
	for (const [name, url] of pages) {
		await page.goto(`${base}/${url}`, { waitUntil: `networkidle0` });
		await page.evaluate((t) => {
			localStorage.setItem(`bf-theme`, t);
			if (t === `dark`) {
				document.documentElement.setAttribute(`data-theme`, `dark`);
			} else {
				document.documentElement.removeAttribute(`data-theme`);
			}
		}, theme);
		await page.evaluate(`document.querySelector('#review')?.setAttribute('open', '')`);
		await new Promise((r) => setTimeout(r, 1200)); // the cookie notice appears a moment after the page has loaded
		await page.evaluate(src);
		const found = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: `tag`, values: [`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `wcag2aaa`] } })).violations
			.map((v) => `[${v.impact}] ${v.id} x${v.nodes.length} :: ${v.nodes.slice(0, 2).map((n) => n.target.join(` `).slice(0, 60) + ` ` + (n.any[0]?.message ?? n.all[0]?.message ?? n.none[0]?.message ?? ``).slice(0, 90)).join(` | `)}`));
		console.log(`${found.length ? `FAIL` : `PASS`} ${theme} ${name}: ${found.length}`);
		for (const f of found) {
			console.log(`     ${f}`);
		}

		problems += found.length;
	}
}

await page.evaluate(() => localStorage.removeItem(`bf-theme`));
await browser.close();
process.exit(problems ? 1 : 0);
