// WCAG AAA audit of everything that works like a button, in the theme and in the shadow DOM of the editor.
//   1.4.6  text contrast 7:1 (4.5:1 for large text), in rest, hover, focus and pressed states
//   2.5.5  target size 44 by 44 CSS pixels
//   2.4.13 focus appearance: an outline at least 2px thick with 3:1 contrast against what is behind it
//   4.1.2  a name
import { connect } from './connect.mjs';
import { login } from './login.mjs';

const browser = await connect();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Runs in the page. Finds the buttons and measures them in the state the page is in.
const measure = () => {
	const parse = (value) => {
		const m = /^rgba?\(([^)]+)\)$/.exec(value);

		if (m) {
			const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);

			return [r / 255, g / 255, b / 255, a];
		}

		const c = /^color\(srgb ([^)]+)\)$/.exec(value);

		if (c) {
			const [r, g, b, a = 1] = c[1].split(/[ /]+/).filter(Boolean).map(Number);

			return [r, g, b, a];
		}

		return [0, 0, 0, 0];
	};
	const lum = ([r, g, b]) => {
		const f = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

		return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
	};
	const ratio = (a, b) => {
		const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);

		return (x + 0.05) / (y + 0.05);
	};
	const over = (top, bottom) => {
		const a = top[3];

		return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
	};
	const parentOf = (el) => el.parentElement ?? (el.getRootNode() instanceof ShadowRoot ? el.getRootNode().host : null);
	// What is behind an element: its own background over the ancestors'. Gradients and pictures are reported as unknown.
	const behind = (el) => {
		const layers = [];
		let unknown = false;

		for (let node = el; node; node = parentOf(node)) {
			const cs = getComputedStyle(node);

			if (cs.backgroundImage !== `none`) {
				unknown = true;
			}

			layers.push(parse(cs.backgroundColor));

			if (parse(cs.backgroundColor)[3] === 1) {
				break;
			}
		}

		let result = [1, 1, 1, 1];

		for (const layer of layers.reverse()) {
			result = over(layer, result);
		}

		return { color: result, unknown };
	};
	const selectors = `button, input[type="button"], input[type="submit"], input[type="reset"], a.button, .button, [role="button"], summary, .dropdown-trigger, .icon-button, .pagination a, .pagination li span`;
	const found = [];
	const walk = (root, shadow) => {
		for (const el of root.querySelectorAll(selectors)) {
			found.push([el, shadow]);
		}

		for (const host of root.querySelectorAll(`*`)) {
			if (host.shadowRoot) {
				walk(host.shadowRoot, true);
			}
		}
	};
	walk(document, false);

	return found
		.filter(([el]) => {
			const r = el.getBoundingClientRect();
			const cs = getComputedStyle(el);

			return r.width > 0 && r.height > 0 && cs.visibility !== `hidden` && cs.display !== `none` && !el.disabled && !el.closest(`[hidden]`);
		})
		.map(([el, shadow], index) => {
			el.setAttribute(`data-audit`, String(index));
			const cs = getComputedStyle(el);
			const r = el.getBoundingClientRect();
			const bg = behind(el);
			const text = over(parse(cs.color), bg.color);
			const size = parseFloat(cs.fontSize);
			const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
			const hasText = (el.textContent ?? ``).trim() !== `` || (el.value ?? ``) !== ``;
			const name = el.getAttribute(`aria-label`) || el.getAttribute(`title`) || (el.textContent ?? ``).trim() || el.value || el.getAttribute(`aria-labelledby`) || ``;
			const svg = el.querySelector(`svg, i.icon, .icon`);
			// Icons are graphics: 3:1 against the background is the AAA limit for them too (1.4.11 is AA, 1.4.6 does not apply to pictures).
			const need = hasText ? (large ? 4.5 : 7) : 3;

			return {
				i: index,
				id: `${shadow ? `(shadow) ` : ``}${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ``}${typeof el.className === `string` && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(`.`)}` : ``}${el.getAttribute(`command`) ? `[${el.getAttribute(`command`)}]` : ``}`,
				text: (el.textContent ?? el.value ?? ``).trim().slice(0, 24) || name.slice(0, 24),
				ratio: Math.round(ratio(text, bg.color) * 100) / 100,
				need,
				bgUnknown: bg.unknown,
				w: Math.round(r.width),
				h: Math.round(r.height),
				name: name !== ``,
				svg: !!svg,
				hasText,
			};
		});
};

const measureFocus = () => {
	const parse = (value) => {
		const m = /^rgba?\(([^)]+)\)$/.exec(value);

		if (m) {
			const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);

			return [r / 255, g / 255, b / 255, a];
		}

		const c = /^color\(srgb ([^)]+)\)$/.exec(value);

		return c ? c[1].split(/[ /]+/).filter(Boolean).map(Number).concat(1).slice(0, 4) : [0, 0, 0, 0];
	};
	const lum = ([r, g, b]) => {
		const f = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

		return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
	};
	const ratio = (a, b) => {
		const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);

		return (x + 0.05) / (y + 0.05);
	};
	const result = {};

	for (const el of document.querySelectorAll(`[data-audit]`)) {
		el.focus({ focusVisible: true });
	}

	return result;
};

async function audit(page, label, prepare) {
	if (prepare) {
		await prepare(page);
	}

	const items = await page.evaluate(measure);
	const problems = [];

	for (const item of items) {
		const why = [];

		if (!item.name) {
			why.push(`no name`);
		}

		if (item.ratio < item.need && !item.bgUnknown) {
			why.push(`contrast ${item.ratio}:1 needs ${item.need}:1`);
		}

		if (item.bgUnknown) {
			why.push(`background is an image or gradient (${item.ratio}:1 on its colour, check by eye)`);
		}

		if (item.w < 44 || item.h < 44) {
			why.push(`target ${item.w}x${item.h}px needs 44x44`);
		}

		if (why.length > 0) {
			problems.push({ ...item, why });
		}
	}

	// Focus: tab to each and read the outline.
	const focus = await page.evaluate(() => {
		const out = [];

		for (const el of document.querySelectorAll(`[data-audit]`)) {
			out.push([el.getAttribute(`data-audit`)]);
		}

		return out.length;
	});

	return { label, count: items.length, problems, focus };
}

const targets = [
	[`index`, `index.php`, null],
	[`forum`, `viewforum.php?f=2`, null],
	[`topic`, `viewtopic.php?t=1`, null],
	[`new topic (editor, options, poll)`, `posting.php?mode=post&f=2`, async (p) => { await wait(1500); await p.evaluate(() => document.querySelector(`#poll-panel`)?.setAttribute(`open`, ``)); }],
	[`editor: picture menu open`, `posting.php?mode=reply&t=1`, async (p) => {
		await wait(1500);
		const input = await p.evaluateHandle(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`input[type="file"]`));
		await input.uploadFile(`${process.env.HOST_DIR}/small.png`);
		await p.waitForFunction(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`bf-editable .attachment img`)?.naturalWidth > 0, { timeout: 15000 }).catch(() => {});
		await p.evaluate(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`bf-editable .attachment`).click());
		await wait(400);
	}],
	[`editor: link dialog open`, `posting.php?mode=reply&t=1`, async (p) => {
		await wait(1500);
		await p.evaluate(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`[command="--link"]`).click());
		await wait(400);
	}],
	[`memberlist`, `memberlist.php`, null],
	[`ucp`, `ucp.php`, null],
	[`search`, `search.php`, null],
	[`faq`, `faq.php`, null],
	[`pm compose`, `ucp.php?i=pm&mode=compose`, async () => { await wait(1500); }],
];

const mode = process.argv[2] ?? `rest`;
const groups = new Map();
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 1000 });
await page.setCacheEnabled(false);
const guest = await (await browser.createBrowserContext()).newPage();
await guest.setCacheEnabled(false);
await guest.setViewport({ width: 1100, height: 1000 });
await guest.goto(`http://localhost:8080/ucp.php?mode=login`, { waitUntil: `networkidle0` });
const results = [await audit(guest, `login (guest)`)];
await login(page);

for (const [label, url, prepare] of targets) {
	await page.goto(`http://localhost:8080/${url}`, { waitUntil: `networkidle0` });
	results.push(await audit(page, label, prepare));
}

for (const r of results) {
	console.log(`\n== ${r.label}: ${r.count} buttons, ${r.problems.length} with a problem`);

	for (const p of r.problems) {
		const key = `${p.id} :: ${p.why.join(`; `)}`;

		if (!groups.has(key)) {
			groups.set(key, { first: r.label, text: p.text, count: 0 });
		}

		groups.get(key).count += 1;
	}
}

console.log(`\n== Problems grouped (same element kind and same reason)`);

for (const [key, info] of [...groups.entries()].sort((a, b) => b[1].count - a[1].count)) {
	console.log(`${String(info.count).padStart(3)}x ${key}   e.g. "${info.text}" on ${info.first}`);
}

await page.close();
await guest.close();
await browser.disconnect();
