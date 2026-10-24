// Open posts in the editor and press Save with no change, then compare the saved text with the text before. For a post that is already
// BBCode the text must stay the same. For a post that is still Markdown the editor converts it, so the text changes once, to BBCode,
// and a second round trip leaves it alone. Prints one line per post, never the text.
//
//   BASE=http://localhost:8081 BF_USER=Baneforum.dk BF_PASS=adminadmin scripts/browser-tests/run.sh edit-roundtrip.mjs 29681 22732 21104
//
// It saves the posts (the edit counter goes up), so use it on a copy.
import { connect } from './connect.mjs';
import { login } from './login.mjs';

const base = process.env.BASE ?? `http://localhost:8080`;
const ids = process.argv.slice(2);
const browser = await connect();
const page = await browser.newPage();
await login(page);

/**
 * The text of the post as the textarea holds it, and the text the editor will write.
 * @param {string} id
 */
async function open(id) {
	await page.goto(`${base}/posting.php?mode=edit&p=${id}`, { waitUntil: `networkidle0` });
	await page.waitForSelector(`bf-editor`);

	return {
		text: await page.$eval(`#message`, (textarea) => /** @type {HTMLTextAreaElement} */ (textarea).value),
		editor: await page.$eval(`bf-editor`, (editor) => /** @type {any} */ (editor).value),
	};
}

for (const id of ids) {
	const first = await open(id);
	// phpBB refuses a form that is sent in the same second the page was made.
	await new Promise((resolve) => setTimeout(resolve, 1500));
	await Promise.all([page.waitForNavigation({ waitUntil: `networkidle0` }), page.click(`input[name="post"]`)]);
	const second = await open(id);
	await new Promise((resolve) => setTimeout(resolve, 1500));
	await Promise.all([page.waitForNavigation({ waitUntil: `networkidle0` }), page.click(`input[name="post"]`)]);
	const third = await open(id);

	console.log(
		`post ${id}: text unchanged by the first save: ${first.text === second.text}` +
			` | editor text equals the saved text: ${first.editor === second.text}` +
			` | a second save changes nothing: ${second.text === third.text}`,
	);
}

await page.close();
browser.disconnect();
