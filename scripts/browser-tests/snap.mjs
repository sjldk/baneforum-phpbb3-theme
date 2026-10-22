// Computed style snapshot of the elements a prosilver CSS file styles, on many pages. Compare two runs to see what a CSS change did.
//   run.sh snap.mjs <out.json> <selector> [<selector> ...]
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

for (const url of pages) {
	await page.setViewport({ width: 1100, height: 900 });
	await page.goto(`http://localhost:8080/${url}`, { waitUntil: `networkidle0` });
	result[url] = await page.evaluate((sels, ps) => {
		const rows = [];

		for (const sel of sels) {
			document.querySelectorAll(sel).forEach((el, i) => {
				const c = getComputedStyle(el);
				rows.push([`${sel}#${i}`, ps.map((p) => `${p}=${c[p]}`).join(`;`)]);
			});
		}

		return rows;
	}, selectors, props);
}

writeFileSync(`/w/${out}`, JSON.stringify(result, null, 1));
console.log(`pages`, Object.keys(result).length, `elements`, Object.values(result).reduce((n, r) => n + r.length, 0));
await browser.close();
