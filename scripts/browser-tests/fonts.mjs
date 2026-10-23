// Font audit: which font-family does each element have, and which platform fonts are really drawn.
import { connect } from './connect.mjs';
import { login } from './login.mjs';

const browser = await connect();
const pages = (process.argv[3] ? [process.argv[3]] : [
	`index.php`, `viewforum.php?f=2`, `viewtopic.php?t=1`, `memberlist.php`, `memberlist.php?mode=viewprofile&u=2`, `search.php`, `faq.php`,
	`ucp.php`, `ucp.php?i=pm&mode=compose`, `posting.php?mode=reply&t=1`, `posting.php?mode=post&f=2`, `ucp.php?i=ucp_profile&mode=signature`,
]);

async function audit(page, url) {
	await page.goto(`http://localhost:8080/${url}`, { waitUntil: `networkidle0` }).catch(() => {});
	await new Promise((r) => setTimeout(r, 400));
	const data = await page.evaluate(() => {
		const families = {};
		const walk = (root, inShadow) => {
			for (const el of root.querySelectorAll(`*`)) {
				if (/^(SCRIPT|STYLE|LINK|META|HEAD|TITLE|NOSCRIPT|TEMPLATE|BR|HR)$/.test(el.tagName)) {
					continue;
				}

				const cs = getComputedStyle(el);

				if (cs.display === `none` || cs.visibility === `hidden`) {
					continue;
				}

				const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
				const family = cs.fontFamily;
				const key = family + (hasText ? `` : ` [no own text]`);
				const entry = (families[key] ??= { count: 0, samples: [] });
				entry.count += 1;

				if (entry.samples.length < 4) {
					entry.samples.push(`${inShadow ? `(shadow) ` : ``}${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ``}${el.className && typeof el.className === `string` ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(`.`)}` : ``}`);
				}

				if (el.shadowRoot) {
					walk(el.shadowRoot, true);
				}
			}
		};
		walk(document, false);

		return families;
	});
	// What is really drawn.
	const client = await page.createCDPSession();
	await client.send(`DOM.enable`);
	await client.send(`CSS.enable`);
	const { root } = await client.send(`DOM.getDocument`, { depth: -1, pierce: true });
	const { nodeIds } = await client.send(`DOM.querySelectorAll`, { nodeId: root.nodeId, selector: `body *` });
	const used = {};

	for (const nodeId of nodeIds.slice(0, 1500)) {
		try {
			const { fonts } = await client.send(`CSS.getPlatformFontsForNode`, { nodeId });

			for (const f of fonts) {
				const key = `${f.familyName}${f.isCustomFont ? ` (web font)` : ` (system)`}`;
				used[key] = (used[key] ?? 0) + f.glyphCount;
			}
		} catch {
			// node without text
		}
	}

	await client.detach();

	return { data, used };
}

const mode = process.argv[2] ?? `admin`;
const context = mode === `guest` ? await browser.createBrowserContext() : browser.defaultBrowserContext();
const page = await context.newPage();
await page.setCacheEnabled(false);

if (mode !== `guest`) {
	await login(page);
}

for (const url of mode === `guest` ? [`ucp.php?mode=login`, `index.php`, `ucp.php?mode=register`] : pages) {
	const { data, used } = await audit(page, url);
	console.log(`\n== ${url}`);
	console.log(`drawn: ${Object.entries(used).map(([k, v]) => `${k}=${v}`).join(`, `)}`);

	for (const [family, info] of Object.entries(data)) {
		const first = family.split(`,`)[0].replace(/"/g, ``);

		if (!/^Inter/.test(first) || /,\s*(Verdana|Arial|Helvetica|Trebuchet|Open Sans)/i.test(family) === true) {
			console.log(`  ${info.count}x ${family}  e.g. ${info.samples.join(`, `)}`);
		}
	}
}

await page.close();
await browser.disconnect();
