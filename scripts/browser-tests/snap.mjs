// Computed style snapshot of the elements a CSS change can touch, on many pages. Compare two runs to see what the change did.
//   run.sh snap.mjs <out.json> <selector> [<selector> ...]     (`*` takes every element; each row is keyed by its path in the page)
//   W=400 sets the window width, DARK=1 turns the dark theme on.
import { writeFileSync } from 'node:fs';
import { connect } from './connect.mjs';
import { login } from './login.mjs';

const [out, ...selectors] = process.argv.slice(2);
const browser = await connect();
const page = await browser.newPage();
await login(page);
const pages = [
	`index.php`, `viewforum.php?f=2`, `viewtopic.php?t=21`, `viewtopic.php?t=1`, `posting.php?mode=reply&t=21`, `posting.php?mode=post&f=2`,
	`ucp.php`, `ucp.php?i=ucp_prefs&mode=personal`, `ucp.php?i=pm&mode=compose`, `memberlist.php`, `memberlist.php?mode=viewprofile&u=84`,
	`search.php`, `search.php?keywords=test&sr=posts`, `faq.php`, `mcp.php`, `viewonline.php`,
	`posting.php?mode=edit&p=105`, `ucp.php?i=ucp_profile&mode=reg_details`, `ucp.php?i=ucp_profile&mode=signature`, `memberlist.php?mode=searchuser`,
	`ucp.php?i=ucp_main&mode=subscribed`, `ucp.php?i=ucp_prefs&mode=view`, `ucp.php?i=ucp_attachments&mode=attachments`, `viewforum.php?f=3`, `mcp.php?i=main&mode=front`,
];
const props = [`display`, `padding`, `margin`, `fontSize`, `fontWeight`, `fontFamily`, `lineHeight`, `textAlign`, `whiteSpace`, `verticalAlign`, `cursor`, `border`, `borderRadius`, `float`, `position`, `width`, `height`, `backgroundColor`, `color`, `outline`, `textDecoration`, `top`, `right`];
const result = {};
const pathFn = `(el) => { const parts = []; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const sib = n.parentElement ? [...n.parentElement.children].filter((c) => c.tagName === n.tagName) : [n]; parts.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (sib.length > 1 ? ':' + (sib.indexOf(n) + 1) : '')); } return parts.join('>'); }`;

for (const url of pages) {
	await page.setViewport({ width: Number(process.env.W ?? 1100), height: 900 });
	await page.goto(`http://localhost:8080/${url}`, { waitUntil: `networkidle0` });
	if (process.env.DARK) {
		await page.evaluate(() => document.documentElement.setAttribute(`data-theme`, `dark`));
	}

	result[url] = await page.evaluate((sels, ps, pf) => {
		const pathOf = eval(pf);
		const rows = [];

		for (const sel of sels) {
			document.querySelectorAll(sel).forEach((el, i) => {
				const c = getComputedStyle(el);
				rows.push([`${sel}#${i}:${pathOf(el)}`, ps.map((p) => `${p}=${c[p]}`).join(`;`)]);
			});
		}

		return rows;
	}, selectors, props, pathFn);
}

writeFileSync(`/w/${out}`, JSON.stringify(result, null, 1));
console.log(`pages`, Object.keys(result).length, `elements`, Object.values(result).reduce((n, r) => n + r.length, 0));
await browser.close();
