// The Markdown import page (markdown-converter/upload/bf-markdown-import.php, uploaded to the board's folder as it is), start to end on the
// production copy: sign in as the founder, export, upload the converted file, dry run, convert, run the dry run again, put one row back, put all
// rows back. At the end the board holds the same Markdown rows as at the start.
//
//   BASE=http://localhost:8081 BF_USER=Baneforum.dk BF_PASS=adminadmin CONVERTED=converted.jsonl scripts/browser-tests/run.sh markdown-import-web.mjs
//
// CONVERTED is the converter output for this board (rows with "markdown":true), as a file name inside scripts/browser-tests/. It holds real
// posts and private messages: do not commit it, and delete it when the test is done.
import { connect } from './connect.mjs';
import { login } from './login.mjs';

const base = process.env.BASE ?? `http://localhost:8081`;
const converted = process.env.CONVERTED;
const out = [];
const check = (name, ok, extra = ``) => out.push(`${ok ? `PASS` : `FAIL`} ${name} ${ok ? `` : extra}`);

if (!converted) {
	console.log(`Set CONVERTED to the converter output file, inside scripts/browser-tests/.`);
	process.exit(1);
}

// The results are printed when the script ends, also when a step fails with an error.
process.on(`exit`, () => console.log(out.join(`\n`)));

const browser = await connect();
const page = await browser.newPage();
page.on(`pageerror`, (error) => out.push(`PAGEERROR ${error.message}`));
await login(page);

const url = `${base}/bf-markdown-import.php`;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Clicks the button with this text and waits for the page that comes back. */
async function press(text) {
	await Promise.all([
		page.waitForNavigation({ waitUntil: `networkidle0`, timeout: 600000 }),
		page.evaluate((label) => [...document.querySelectorAll(`button`)].find((button) => button.textContent.trim().startsWith(label)).click(), text),
	]);
}

/** The numbers in the table of the dry run, by the words in the first column. */
const numbers = () =>
	page.evaluate(() => {
		const found = {};
		for (const row of document.querySelectorAll(`table tr`)) {
			const cells = row.querySelectorAll(`th, td`);
			if (cells.length === 2 && /^\d+$/.test(cells[1].textContent.trim())) {
				found[cells[0].textContent.trim()] = Number(cells[1].textContent.trim());
			}
		}

		return found;
	});

await page.goto(url, { waitUntil: `networkidle0` });
check(`the page opens for the founder`, await page.evaluate(() => document.querySelector(`h1`)?.textContent.includes(`Convert Markdown posts`)));

// Step 2: the export, with the token from the page.
const exported = await page.evaluate(async (address) => {
	const token = document.querySelector(`input[name="token"]`).value;
	const response = await fetch(address, { method: `POST`, body: new URLSearchParams({ action: `export`, token }) });
	const text = await response.text();
	let rows;
	try {
		rows = text.split(`\n`).filter(Boolean).map((line) => JSON.parse(line));
	} catch {
		// The page answered with something else, for example a phpBB error. Show the start of it.
		return { status: response.status, type: ``, rows: 0, allMarkdown: false, error: text.slice(0, 600) };
	}

	return {
		status: response.status,
		type: response.headers.get(`content-disposition`),
		rows: rows.length,
		allMarkdown: rows.every((row) => row.markdown === true),
		firstPost: rows.find((row) => row.kind === `post`)?.id,
	};
}, url);
check(`the export is a download of Markdown rows only`, exported.status === 200 && /markdown-rows\.jsonl/.test(exported.type ?? ``) && exported.rows > 0 && exported.allMarkdown, JSON.stringify(exported));

// A request with a wrong token changes nothing.
const refused = await page.evaluate(async (address) => (await (await fetch(address, { method: `POST`, body: new URLSearchParams({ action: `rollback`, token: `wrong` }) })).text()).includes(`Nothing was changed`), url);
check(`a request with a wrong token is refused`, refused);

// Step 4: upload.
const input = await page.$(`input[type="file"]`);
await input.uploadFile(`${process.env.HOST_DIR}/${converted}`);
await press(`Upload`);
const uploaded = await page.evaluate(() => document.body.textContent.match(/A file is uploaded: (\d+) Markdown rows/)?.[1]);
check(`the converted file is uploaded`, Boolean(uploaded), await page.evaluate(() => document.querySelector(`[role="status"]`)?.textContent ?? document.body.textContent.replace(/\s+/g, ` `).slice(0, 500)));

// Step 5: dry run.
await press(`Run the dry run`);
const dry = await numbers();
const total = dry[`Markdown rows in the file`];
const same = dry[`Convert without a decision (look the same)`];
const different = dry[`Look different (read them below)`];
check(`the dry run counts add up`, total > 0 && same + different === total, JSON.stringify(dry));
const listed = await page.evaluate(() => document.querySelectorAll(`input[name="accept[]"]`).length);
check(`every row that looks different has a checkbox`, listed === different, `${listed} of ${different}`);
check(`a dry run writes nothing`, (await page.evaluate(() => document.body.textContent.match(/Rows converted so far\s*(\d+)/)?.[1])) === `0`);

// Pictures of the page with the dry run, in the light and the dark theme (they go to this folder).
await page.setViewport({ width: 1100, height: 900 });
await page.screenshot({ path: `/w/markdown-import-web-light.png`, fullPage: true });
await page.emulateMediaFeatures([{ name: `prefers-color-scheme`, value: `dark` }]);
await page.screenshot({ path: `/w/markdown-import-web-dark.png`, fullPage: true });
await page.emulateMediaFeatures([{ name: `prefers-color-scheme`, value: `light` }]);

// A convert without the backup box is not allowed (the browser stops it, so test the page's own check too).
await page.evaluate(() => document.querySelector(`input[name="backup_ok"]`).removeAttribute(`required`));
await press(`Convert the rows now`);
check(`convert needs the backup box`, await page.evaluate(() => document.body.textContent.includes(`Tick the box that says you have taken a database backup`)));

// Tick all, say that there is a backup, convert.
await page.evaluate(() => document.getElementById(`all`)?.click());
await page.evaluate(() => {
	document.querySelector(`input[name="backup_ok"]`).checked = true;
});
await press(`Convert the rows now`);
const done = await numbers();
check(`all rows were converted`, done[`Converted`] === total, JSON.stringify(done));

// Run the dry run again: nothing is left to convert.
await press(`Run the dry run again`);
const again = await numbers();
check(`a second dry run converts nothing`, again[`Convert without a decision (look the same)`] === 0 && again[`Look different (read them below)`] === 0, JSON.stringify(again));
check(`the backup table has one row for every converted row`, (await page.evaluate(() => document.body.textContent.match(/Rows converted so far\s*(\d+)/)?.[1])) === String(total));

// Step 6: put one row back, then all of them.
page.on(`dialog`, (dialog) => dialog.accept());
await page.evaluate((id) => {
	document.querySelector(`input[name="only"]`).value = `post:${id}`;
}, exported.firstPost);
await press(`Put back`);
check(`one row is put back`, await page.evaluate(() => document.body.textContent.includes(`Rows put back: 1.`)));
await press(`Put back`);
// The row that was put back first is no longer in the backup table, so this puts back one row fewer.
check(`all the other rows are put back`, await page.evaluate((count) => document.body.textContent.includes(`Rows put back: ${count}.`), total - 1));
check(`the backup table is empty again`, (await page.evaluate(() => document.body.textContent.match(/Rows converted so far\s*(\d+)/)?.[1])) === `0`);
await press(`Run the dry run`);
const restored = await numbers();
check(`after the rollback the dry run shows the same as before`, restored[`Convert without a decision (look the same)`] === same && restored[`Look different (read them below)`] === different, JSON.stringify(restored));

await press(`Delete the uploaded file`);
check(`the uploaded file can be deleted`, await page.evaluate(() => !document.body.textContent.includes(`A file is uploaded`)));

await page.close();
browser.disconnect();
