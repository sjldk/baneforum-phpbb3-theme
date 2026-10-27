// The header of a table (member list) must look like the header of a topic list: same height, same space around the title.
//   run.sh headers.mjs
import { connect } from './connect.mjs';
import { login } from './login.mjs';

const browser = await connect();
const page = await browser.newPage();
await login(page);
await page.setViewport({ width: 1100, height: 900 });

const measure = (selectors) => page.evaluate(({ box, title }) => {
	const head = document.querySelector(box);
	const text = head.querySelector(title);
	const range = document.createRange();
	range.selectNodeContents(text);
	const textBox = range.getBoundingClientRect();
	const headBox = head.getBoundingClientRect();
	const style = getComputedStyle(text);

	return {
		height: Math.round(headBox.height * 10) / 10,
		left: Math.round((textBox.left - headBox.left) * 10) / 10,
		top: Math.round((textBox.top - headBox.top) * 10) / 10,
		fontSize: style.fontSize,
		fontWeight: style.fontWeight,
		lineHeight: style.lineHeight,
		background: getComputedStyle(head.closest('li, th') ?? head).backgroundColor,
	};
}, selectors);

await page.goto(`${process.env.BASE ?? `http://localhost:8080`}/viewforum.php?f=2`, { waitUntil: `networkidle0` });
const list = await measure({ box: `.forumbg li.header`, title: `dt .list-inner` });
await page.goto(`${process.env.BASE ?? `http://localhost:8080`}/memberlist.php`, { waitUntil: `networkidle0` });
const table = await measure({ box: `table.table1 thead th.name`, title: `*` }).catch(() => null);
const tableHeader = await page.evaluate(() => {
	const th = document.querySelector(`table.table1 thead th.name`);
	const range = document.createRange();
	range.selectNodeContents(th);
	const textBox = range.getBoundingClientRect();
	const box = th.getBoundingClientRect();
	const style = getComputedStyle(th);

	return {
		height: Math.round(box.height * 10) / 10,
		left: Math.round((textBox.left - box.left) * 10) / 10,
		top: Math.round((textBox.top - box.top) * 10) / 10,
		fontSize: style.fontSize,
		fontWeight: style.fontWeight,
		lineHeight: style.lineHeight,
		background: style.backgroundColor,
	};
});

console.log(`topic list header `, JSON.stringify(list));
console.log(`member table header`, JSON.stringify(tableHeader));
for (const key of [`height`, `left`, `top`, `fontSize`, `fontWeight`, `lineHeight`, `background`]) {
	const same = key === `height` || key === `left` || key === `top` ? Math.abs(list[key] - tableHeader[key]) <= 1 : list[key] === tableHeader[key];
	console.log(`${same ? `PASS` : `FAIL`} same ${key}`, list[key], tableHeader[key]);
}

await page.close();
await browser.disconnect();
