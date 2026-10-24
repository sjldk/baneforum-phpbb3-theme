// Casts a like through the page as a member and prints what the page shows: the counts, and the text of the vote bar. The vote bar must show
// counts only, never who voted. Look at the database afterwards (the table logs the member and the time).
//
//   TOPIC=13 POST=25 scripts/browser-tests/run.sh likes-log.mjs [like|dislike]
//
// Votes on the board you point it at, so use it on a test board. The post must not be the member's own.
import { connect } from './connect.mjs';
import { login } from './login.mjs';

const base = process.env.BASE ?? `http://localhost:8080`;
const topic = process.env.TOPIC ?? `13`;
const post = process.env.POST ?? `25`;
const which = process.argv[2] === `dislike` ? 1 : 0;
const browser = await connect();
const page = await browser.newPage();
page.on(`pageerror`, (error) => console.log(`PAGEERROR ${error.message}`));

await login(page);
await page.goto(`${base}/viewtopic.php?t=${topic}`, { waitUntil: `networkidle0` });
const read = () =>
	page.evaluate((id, index) => {
		const group = document.querySelector(`#p${id} .bf-votes`);
		const buttons = [...group.querySelectorAll(`button.bf-vote`)];

		return { counts: buttons.map((button) => button.querySelector(`.bf-vote-count`).textContent.trim()), pressed: buttons.map((button) => button.getAttribute(`aria-pressed`)), text: group.textContent.replace(/\s+/g, ` `).trim(), clicked: index };
	}, post, which);

const before = await read();
await page.evaluate((id, index) => document.querySelectorAll(`#p${id} .bf-votes button.bf-vote`)[index].click(), post, which);
await new Promise((resolve) => setTimeout(resolve, 1500));
const after = await read();

console.log(JSON.stringify({ post, before, after }));
await page.close();
browser.disconnect();
