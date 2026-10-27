// WCAG AAA: contrast of the text of every button in the states hover, focus and active, and the focus line.
import { connect } from './connect.mjs';
import { login } from './login.mjs';

const browser = await connect();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const helpers = () => {
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
	const over = (top, bottom) => [0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1);
	const parentOf = (el) => el.parentElement ?? (el.getRootNode() instanceof ShadowRoot ? el.getRootNode().host : null);
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

		return { color: layers.reverse().reduce((acc, layer) => over(layer, acc), [1, 1, 1, 1]), unknown };
	};
	// What is behind the button itself (its surroundings), for the focus line.
	const around = (el) => behind(parentOf(el) ?? el);

	return function read(el) {
		const cs = getComputedStyle(el);
		const bg = behind(el);
		const text = over(parse(cs.color), bg.color);
		const size = parseFloat(cs.fontSize);
		const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
		const hasText = (el.textContent ?? ``).trim() !== `` || (el.value ?? ``) !== ``;
		const outline = cs.outlineStyle !== `none` ? parseFloat(cs.outlineWidth) : 0;
		const surround = around(el).color;
		const outlineColor = over(parse(cs.outlineColor), surround);
		const shadow = cs.boxShadow !== `none`;

		// An icon inside the button is a picture: 3:1 against what is behind it (the button).
		const icon = el.querySelector(`i.icon, svg, .icon`);
		let iconRatio = 99;

		if (icon && !(hasText && (el.textContent ?? ``).trim() !== ``) ) {
			const ics = getComputedStyle(icon);
			const paint = ics.fill && ics.fill !== `none` && icon.tagName.toLowerCase() === `svg` ? ics.fill : ics.color;
			iconRatio = Math.round(ratio(over(parse(paint), bg.color), bg.color) * 100) / 100;
		} else if (icon) {
			const ics = getComputedStyle(icon);
			iconRatio = Math.round(ratio(over(parse(ics.color), bg.color), bg.color) * 100) / 100;
		}

		return {
			iconRatio,
			ratio: Math.round(ratio(text, bg.color) * 100) / 100,
			need: hasText ? (large ? 4.5 : 7) : 3,
			bgUnknown: bg.unknown,
			outlineWidth: outline,
			outlineRatio: Math.round(ratio(outlineColor, surround) * 100) / 100,
			shadow,
		};
	};
};

const targets = [
	[`index`, `index.php`, null],
	[`topic`, `viewtopic.php?t=1`, null],
	[`new topic`, `posting.php?mode=post&f=2`, async (p) => { await wait(1500); await p.evaluate(() => document.querySelector(`#poll-panel`)?.setAttribute(`open`, ``)); }],
	[`reply with a picture`, `posting.php?mode=reply&t=1`, async (p) => { await wait(1500); }],
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
];
const states = [[`rest`, []], [`hover`, [`hover`]], [`focus`, [`focus`, `focus-visible`]], [`active`, [`active`, `hover`]], [`focus+hover`, [`focus`, `focus-visible`, `hover`]]];
const groups = new Map();

async function run(page, label, url, prepare) {
	await page.goto(`${process.env.BASE ?? `http://localhost:8080`}/${url}`, { waitUntil: `networkidle0` });

	if (prepare) {
		await prepare(page);
	}

	const client = await page.createCDPSession();
	await client.send(`DOM.enable`);
	await client.send(`CSS.enable`);
	await client.send(`DOM.getDocument`, { depth: -1, pierce: true });
	const handles = await page.evaluateHandle(() => {
		const out = [];
		const selectors = `button, input[type="button"], input[type="submit"], a.button, .button, summary, .dropdown-trigger, .pagination li a, .navbar a, [role="button"]`;
		const walk = (root) => {
			for (const el of root.querySelectorAll(selectors)) {
				const r = el.getBoundingClientRect();

				if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== `hidden` && !el.disabled && !el.closest(`[hidden]`) && !el.classList.contains(`sr-only`)) {
					out.push(el);
				}
			}

			for (const host of root.querySelectorAll(`*`)) {
				if (host.shadowRoot) {
					walk(host.shadowRoot);
				}
			}
		};
		walk(document);

		return out;
	});
	const count = await page.evaluate((arr) => { window.__els = arr; return arr.length; }, handles);
	const read = await page.evaluateHandle(`(${helpers.toString()})()`);

	for (let i = 0; i < count; i += 1) {
		const element = await page.evaluateHandle((arr, n) => arr[n], handles, i);
		const evaluated = await client.send(`Runtime.evaluate`, { expression: `window.__els[${i}]` });
		const { nodeId } = await client.send(`DOM.requestNode`, { objectId: evaluated.result.objectId });
		const info = await page.evaluate((el) => `${el.tagName.toLowerCase()}${typeof el.className === `string` && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(`.`)}` : ``}${el.getAttribute(`command`) ? `[${el.getAttribute(`command`)}]` : ``}`, element);
		const text = await page.evaluate((el) => ((el.textContent ?? ``).trim() || el.value || el.getAttribute(`aria-label`) || ``).slice(0, 20), element);

		for (const [state, forced] of states) {
			await client.send(`CSS.forcePseudoState`, { nodeId, forcedPseudoClasses: forced });
			const result = await page.evaluate((el, r) => r(el), element, read);
			const why = [];

			if (result.ratio < result.need && !result.bgUnknown) {
				why.push(`contrast ${result.ratio}:1 needs ${result.need}:1`);
			}

			if (result.iconRatio < 3 && !result.bgUnknown) {
				why.push(`icon ${result.iconRatio}:1 needs 3:1`);
			}

			if (state.startsWith(`focus`)) {
				const line = result.outlineWidth >= 2 && result.outlineRatio >= 3;

				if (!line && !(result.shadow && result.outlineWidth >= 2)) {
					why.push(`focus line ${result.outlineWidth}px at ${result.outlineRatio}:1 needs 2px and 3:1`);
				}
			}

			if (why.length > 0) {
				const key = `${info} [${state}] :: ${why.join(`; `)}`;
				const entry = groups.get(key) ?? { count: 0, text, page: label };
				entry.count += 1;
				groups.set(key, entry);
			}
		}

		await client.send(`CSS.forcePseudoState`, { nodeId, forcedPseudoClasses: [] });
	}

	await client.detach();

	return count;
}

const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 1000 });
await page.setCacheEnabled(false);
const guest = await (await browser.createBrowserContext()).newPage();
await guest.setCacheEnabled(false);
await guest.setViewport({ width: 1100, height: 1000 });
console.log(`login (guest):`, await run(guest, `login (guest)`, `ucp.php?mode=login`, null), `buttons`);
await login(page);

for (const [label, url, prepare] of targets) {
	console.log(`${label}:`, await run(page, label, url, prepare), `buttons`);
}

console.log(`\n== Problems (element kind [state] :: reason)`);

for (const [key, info] of [...groups.entries()].sort((a, b) => b[1].count - a[1].count)) {
	console.log(`${String(info.count).padStart(3)}x ${key}   e.g. "${info.text}" on ${info.page}`);
}

if (groups.size === 0) {
	console.log(`none`);
}

await page.close();
await guest.close();
await browser.disconnect();
