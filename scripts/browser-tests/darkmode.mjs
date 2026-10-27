// The dark theme switch (extensions/baneforum/darkmode): the button turns data-theme on and off, the choice is kept in
// localStorage and applies again after a reload before the page is drawn, and axe-core finds no contrast problems
// (AA and AAA) in the dark theme on the pages people use most. Prints PASS or FAIL per check.
import fs from 'node:fs';
import { connect } from './connect.mjs';
import { login } from './login.mjs';

const src = fs.readFileSync(`/w/node_modules/axe-core/axe.min.js`, `utf8`);
const browser = await connect();
const page = await browser.newPage();
await login(page);
await page.setViewport({ width: 1100, height: 900 });

let failed = 0;
const check = (name, ok, detail = ``) => {
	console.log(`${ok ? `PASS` : `FAIL`} ${name}${ok ? `` : ` ${detail}`}`);
	failed += ok ? 0 : 1;
};
const theme = () => page.evaluate(() => document.documentElement.getAttribute(`data-theme`));
const stored = () => page.evaluate(() => localStorage.getItem(`bf-theme`));

await page.goto(`${process.env.BASE ?? `http://localhost:8080`}/index.php`, { waitUntil: `networkidle0` });
await page.evaluate(() => localStorage.removeItem(`bf-theme`));
await page.reload({ waitUntil: `networkidle0` });

check(`starts light without a stored choice`, (await theme()) === null);
check(`the switch is shown once the script has run`, await page.$eval(`.bf-theme-switch`, (e) => !e.classList.contains(`hidden`)));
check(`aria-pressed is false while light`, (await page.$eval(`.bf-theme-switch__button`, (e) => e.getAttribute(`aria-pressed`))) === `false`);

await page.click(`.bf-theme-switch__button`);
check(`click turns the dark theme on`, (await theme()) === `dark`, String(await theme()));
check(`click stores "dark"`, (await stored()) === `dark`, String(await stored()));
check(`aria-pressed is true while dark`, (await page.$eval(`.bf-theme-switch__button`, (e) => e.getAttribute(`aria-pressed`))) === `true`);
check(`page colour is dark`, await page.evaluate(() => {
	const [r, g, b] = getComputedStyle(document.querySelector(`.wrap`)).backgroundColor.match(/[\d.]+/g).slice(0, 3).map(Number);
	return (r + g + b) / 3 < 100;
}));

// The choice applies before the page is drawn: data-theme is set when the document has been parsed, before any layout.
await page.goto(`${process.env.BASE ?? `http://localhost:8080`}/index.php`, { waitUntil: `domcontentloaded` });
check(`after a reload the theme is dark at DOMContentLoaded`, (await theme()) === `dark`, String(await theme()));

for (const [name, url] of [[`board index`, `index.php`], [`topic list`, `viewforum.php?f=2`], [`topic`, `viewtopic.php?t=1`], [`new topic`, `posting.php?mode=post&f=2`], [`login`, `ucp.php?mode=login&redirect=index.php`], [`faq`, `app.php/help/faq`]]) {
	await page.goto(`${process.env.BASE ?? `http://localhost:8080`}/${url}`, { waitUntil: `networkidle0` });
	await page.evaluate(src);
	const problems = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: `rule`, values: [`color-contrast`, `color-contrast-enhanced`] } })).violations
		.flatMap((v) => v.nodes.map((n) => `${v.id} ${n.target.join(` `).slice(0, 60)} :: ${(n.any[0]?.message ?? ``).slice(0, 100)}`)));
	check(`dark theme, no contrast problems: ${name}`, problems.length === 0, `\n  ${problems.slice(0, 4).join(`\n  `)}`);
}

await page.goto(`${process.env.BASE ?? `http://localhost:8080`}/index.php`, { waitUntil: `networkidle0` });
await page.click(`.bf-theme-switch__button`);
check(`second click turns it off`, (await theme()) === null, String(await theme()));
check(`second click stores "light"`, (await stored()) === `light`, String(await stored()));

await page.evaluate(() => localStorage.removeItem(`bf-theme`));
await browser.close();
process.exit(failed ? 1 : 0);
