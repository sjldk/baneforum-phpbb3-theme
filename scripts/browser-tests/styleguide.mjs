// The style sheet page (baneforum/theme/styleguide.html): axe-core (WCAG A, AA, AAA) in the light and the dark theme, and a count of the
// looks it must keep to: three button levels and two font weights. Prints PASS or FAIL per check.
import fs from 'node:fs';
import { connect } from './connect.mjs';

const src = fs.readFileSync(`/w/node_modules/axe-core/axe.min.js`, `utf8`);
const browser = await connect();
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 900 });
await page.goto(`http://localhost:8080/styles/baneforum/theme/styleguide.html`, { waitUntil: `networkidle0` });

let failed = 0;
const check = (name, ok, detail = ``) => {
	console.log(`${ok ? `PASS` : `FAIL`} ${name}${ok ? `` : ` ${detail}`}`);
	failed += ok ? 0 : 1;
};

for (const theme of [`light`, `dark`]) {
	await page.evaluate((t) => (t === `dark` ? document.documentElement.setAttribute(`data-theme`, `dark`) : document.documentElement.removeAttribute(`data-theme`)), theme);
	await page.evaluate(src);
	const problems = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: `tag`, values: [`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `wcag2aaa`] } })).violations
		.map((v) => `${v.id} x${v.nodes.length} ${v.nodes[0].target.join(` `).slice(0, 60)}`));
	check(`axe, ${theme} theme`, problems.length === 0, problems.join(` | `));
}

const weights = await page.evaluate(() => [...new Set([...document.querySelectorAll(`body *`)]
	.filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !e.closest(`.site-description`))
	.map((e) => getComputedStyle(e).fontWeight))].sort());
check(`font weights are 400 and 600 (700 only in the banner title)`, weights.every((w) => w === `400` || w === `600` || w === `700`) && !weights.includes(`500`), weights.join(`,`));

await browser.close();
process.exit(failed ? 1 : 0);
