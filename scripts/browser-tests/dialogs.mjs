// Deleting and restoring a post asks in a native <dialog> on the same page. Makes a throwaway reply, deletes it
// through the dialog, then restores it through the dialog.
import { connect } from './connect.mjs';
import { login } from './login.mjs';

const browser = await connect();
const page = await browser.newPage();
const out = [];
const check = (name, ok, extra = ``) => out.push(`${ok ? `PASS` : `FAIL`} ${name} ${extra}`);

await login(page);
await page.setViewport({ width: 1100, height: 900 });
await page.goto(`${process.env.BASE ?? `http://localhost:8080`}/viewtopic.php?t=21`, { waitUntil: `networkidle0` });
const replyUrl = await page.$eval(`a[href*="mode=reply"]`, (a) => a.href);
await page.goto(replyUrl, { waitUntil: `networkidle0` });
await page.evaluate(() => (document.querySelector(`#message`).value = `throwaway for the dialog test`));
await page.type(`#subject`, ` dialog`);
await new Promise((r) => setTimeout(r, 1600));
await Promise.all([page.waitForNavigation({ waitUntil: `networkidle0` }), page.click(`input[name="post"]`)]);

const topicUrl = page.url().split(`#`)[0];
const postId = new URL(page.url()).searchParams.get(`p`) ?? (await page.url().match(/p=(\d+)/))?.[1];
const del = `#p${postId} a[href*="mode=delete"], #p${postId} a[href*="mode=soft_delete"]`;
const startUrl = page.url();

await page.waitForSelector(del);
await page.click(del);
await page.waitForSelector(`#phpbb_confirm`, { visible: true, timeout: 5000 }).catch(() => {});
const dialog = await page.evaluate(() => ({ shown: getComputedStyle(document.querySelector(`#phpbb_confirm`)).display !== `none`, native: document.querySelector(`#phpbb_confirm`) instanceof HTMLDialogElement && document.querySelector(`#phpbb_confirm`).matches(`:modal`), text: document.querySelector(`#phpbb_confirm`).innerText.slice(0, 120), url: location.href }));
check(`delete opens a native modal <dialog> on the same page`, dialog.shown && dialog.native && !/mode=(soft_)?delete/.test(dialog.url), JSON.stringify(dialog));

await page.keyboard.press(`Escape`);
await new Promise((r) => setTimeout(r, 600));
check(`Escape closes it and nothing is deleted`, await page.evaluate((id) => !!document.querySelector(`#p${id}`) && !document.querySelector(`#p${id}.deleted`), postId));

await page.click(del);
await page.waitForSelector(`#phpbb_confirm`, { visible: true, timeout: 5000 });
await page.click(`#phpbb_confirm input[name="confirm"]`);
await page.waitForNavigation({ waitUntil: `networkidle0`, timeout: 15000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 500));
const afterDelete = await page.evaluate((id) => ({ url: location.href, deleted: !!document.querySelector(`#p${id}.deleted`), gone: !document.querySelector(`#p${id}`) }), postId);
check(`confirming deletes the post and comes back to the topic`, (afterDelete.deleted || afterDelete.gone) && !/mode=(soft_)?delete/.test(afterDelete.url), JSON.stringify(afterDelete));

if (afterDelete.deleted) {
	// A deleted post is folded. "Display this post" opens it, and the restore button is inside.
	await page.evaluate((id) => document.querySelector(`#p${id} .display_post`)?.click(), postId);
	await new Promise((r) => setTimeout(r, 400));
	await page.click(`#p${postId} input[name="action[restore]"]`);
	await page.waitForSelector(`#phpbb_confirm`, { visible: true, timeout: 5000 }).catch(() => {});
	const restoreDialog = await page.evaluate(() => ({ shown: getComputedStyle(document.querySelector(`#phpbb_confirm`)).display !== `none`, url: location.href }));
	check(`restore opens a dialog on the same page`, restoreDialog.shown && !/mcp\.php/.test(restoreDialog.url), JSON.stringify(restoreDialog));
	await page.click(`#phpbb_confirm input[name="confirm"]`);
	await page.waitForNavigation({ waitUntil: `networkidle0`, timeout: 15000 }).catch(() => {});
	await new Promise((r) => setTimeout(r, 500));
	await new Promise((r) => setTimeout(r, 5000));
	await page.waitForNetworkIdle?.({ idleTime: 500, timeout: 8000 }).catch(() => {});
	console.log(`state`, JSON.stringify(await page.evaluate((id) => ({ cls: document.querySelector(`#p${id}`)?.className, nav: performance.getEntriesByType(`navigation`)[0]?.type, alert: document.querySelector(`#phpbb_alert`)?.innerText.slice(0, 60) }), postId)));
	check(`confirming restores the post`, await page.evaluate((id) => !!document.querySelector(`#p${id}`) && !document.querySelector(`#p${id}.deleted`), postId), page.url());
	await page.screenshot({ path: `dialogs.png` });
}

console.log(out.join(`\n`));
await browser.close();
