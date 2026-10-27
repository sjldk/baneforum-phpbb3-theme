// The featured posts on the front page: takes screenshots (wide, with the "?" box open, dark theme, phone) and prints the main facts.
// The pictures are written to this folder as featured-*.png.
import { connect } from './connect.mjs';

const base = process.env.BASE ?? `http://localhost:8080`;
const browser = await connect();
const page = await browser.newPage();
await page.setCacheEnabled(false);

const facts = () => page.evaluate(() => {
	const box = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) }; };
	return {
		title: document.querySelector(`.bf-featured .bf-index__title`)?.textContent.trim(),
		leadPicture: box(`.bf-featured__item--lead .bf-featured__picture`),
		leadBody: box(`.bf-featured__item--lead .bf-featured__body`),
		newLabels: document.querySelectorAll(`.bf-featured__new`).length,
		stories: document.querySelectorAll(`.bf-featured__item`).length,
		snippet: document.querySelector(`.bf-featured__snippet`)?.textContent.slice(0, 120),
	};
});

await page.setViewport({ width: 1400, height: 900 });
await page.goto(`${base}/index.php`, { waitUntil: `networkidle0` });
console.log(JSON.stringify(await facts(), null, 1));
await page.screenshot({ path: `/w/featured-wide.png` });

await page.click(`.bf-featured__help summary`);
await page.screenshot({ path: `/w/featured-help.png` });

await page.evaluate(() => document.documentElement.setAttribute(`data-theme`, `dark`));
await page.screenshot({ path: `/w/featured-dark.png` });
await page.evaluate(() => document.documentElement.removeAttribute(`data-theme`));

await page.setViewport({ width: 390, height: 844 });
await page.goto(`${base}/index.php`, { waitUntil: `networkidle0` });
await page.screenshot({ path: `/w/featured-phone.png` });
await page.close();
browser.disconnect();
