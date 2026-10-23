import { connect } from './connect.mjs';
import { login } from './login.mjs';

const browser = await connect();
const context = await browser.createBrowserContext();
const guest = await context.newPage();
const requests = new Set();
guest.on(`request`, (r) => /font|\.css|googleapis|gstatic|jsdelivr|cdnjs|fontawesome/i.test(r.url()) && !r.url().includes(`localhost:8080/styles`) && requests.add(r.url().slice(0, 140)));

for (const url of [`ucp.php?mode=login`, `index.php`, `ucp.php?mode=register`]) {
	await guest.goto(`http://localhost:8080/${url}`, { waitUntil: `networkidle0` }).catch(() => {});
	const info = await guest.evaluate(() => {
		const out = { weights: {}, styles: {}, sizes: {}, odd: [] };

		for (const el of document.body.querySelectorAll(`*`)) {
			const cs = getComputedStyle(el);

			if (cs.display === `none` || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
				continue;
			}

			out.weights[cs.fontWeight] = (out.weights[cs.fontWeight] ?? 0) + 1;
			out.styles[cs.fontStyle] = (out.styles[cs.fontStyle] ?? 0) + 1;
			const px = Math.round(parseFloat(cs.fontSize));
			out.sizes[px] = (out.sizes[px] ?? 0) + 1;
			const family = cs.fontFamily.split(`,`)[0].replace(/"/g, ``);

			if (!/^(Inter|Barlow Semi Condensed|FontAwesome)$/.test(family)) {
				out.odd.push(`${el.tagName.toLowerCase()}.${el.className}: ${cs.fontFamily}`);
			}
		}

		return out;
	});
	console.log(`\n== guest ${url}\n`, JSON.stringify(info));
}

console.log(`\nexternal font/css requests:`, [...requests].join(`\n  `));
await context.close();
await browser.disconnect();
