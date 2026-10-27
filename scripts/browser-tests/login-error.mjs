// A failed login: one text for a wrong username and a wrong password, and the error box passes axe-core (WCAG A, AA, AAA) in both themes.
// Each run adds two failed logins. After 3, phpBB asks for a captcha (empty the table phpbb_login_attempts).
import fs from 'node:fs';
import { connect } from './connect.mjs';

const base = process.env.BASE ?? `http://localhost:8080`;
const axeSource = fs.readFileSync(`/w/node_modules/axe-core/axe.min.js`, `utf8`);
const browser = await connect();
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 1000 });
await page.setCacheEnabled(false);
let failed = 0;
const check = (ok, name) => {
	console.log(`${ok ? `PASS` : `FAIL`}  ${name}`);
	failed += ok ? 0 : 1;
};

const texts = [];
for (const user of [`nobody-here`, `admin`]) {
	await page.goto(`${base}/ucp.php?mode=login`, { waitUntil: `networkidle0` });
	await page.type(`#username`, user);
	await page.type(`#password`, `wrong-password`);
	await Promise.all([page.waitForNavigation({ waitUntil: `networkidle0` }), page.click(`input[name="login"]`)]);
	texts.push(await page.$eval(`.error`, (e) => e.textContent.trim()));
}
check(texts[0] === texts[1], `same text for a wrong username and a wrong password`);
check(/username or the password|Brugernavnet eller adgangskoden/.test(texts[0]), `text names both: ${texts[0]}`);
check((await page.$eval(`.error`, (e) => e.getAttribute(`role`))) === `alert`, `error box has role=alert`);

for (const theme of [`light`, `dark`]) {
	await page.evaluate((t) => (t === `dark` ? document.documentElement.setAttribute(`data-theme`, `dark`) : document.documentElement.removeAttribute(`data-theme`)), theme);
	await page.evaluate(axeSource);
	const bad = await page.evaluate(async () => {
		const r = await window.axe.run(`.error`, { runOnly: { type: `tag`, values: [`wcag2a`, `wcag2aa`, `wcag2aaa`] } });
		return r.violations.map((v) => v.id);
	});
	const colours = await page.$eval(`.error`, (e) => `${getComputedStyle(e).color} on ${getComputedStyle(e).backgroundColor}`);
	const link = await page.$eval(`.error a`, (a) => getComputedStyle(a).color + ` ` + getComputedStyle(a).textDecorationLine).catch(() => `no link`);
	check(bad.length === 0, `${theme}: axe finds nothing in the error box (${colours}; link ${link}) ${bad.join(`,`)}`);
	await page.screenshot({ path: `/w/login-error-${theme}.png` });
}

await browser.disconnect();
process.exit(failed ? 1 : 0);
