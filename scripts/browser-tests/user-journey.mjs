// A standard member's normal visit, start to end, on the test board filled by docker/dummy-data.sh.
// Run: BF_USER=alice scripts/browser-tests/run.sh user-journey.mjs   (alice has the password adminadmin)
// Makes one topic with a reply and a private message, and deletes the topic's posts again at the end.
import { connect } from './connect.mjs';
import { login } from './login.mjs';

process.env.BF_USER ??= `alice`;
const base = process.env.BASE ?? `http://localhost:8080`;
const browser = await connect();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const out = [];
const errors = [];
let failed = 0;

const check = (name, ok, extra = ``) => {
	if (!ok) {
		failed += 1;
	}
	out.push(`${ok ? `PASS` : `FAIL`} ${name}${ok ? `` : ` ${extra}`}`);
};

// Collects script errors on a page; each scenario reports what it found with noErrors().
const watch = (page) => {
	page.on(`pageerror`, (error) => errors.push(error.message));
	page.on(`console`, (message) => message.type() === `error` && !/favicon|status of 40[34]/.test(message.text()) && errors.push(message.text()));
};
const noErrors = (scenario) => {
	check(`${scenario}: no script errors`, errors.length === 0, errors.join(` | `));
	errors.length = 0;
};
const go = (page, path) => page.goto(path.startsWith(`http`) ? path : `${base}/${path}`, { waitUntil: `networkidle0` });
const clickAndLoad = (page, selector) => Promise.all([page.waitForNavigation({ waitUntil: `networkidle0` }), page.click(selector)]);
// phpBB refuses a form that is sent in the same second the page was made.
const submit = async (page, selector) => {
	await wait(1600);
	await clickAndLoad(page, selector);
};
const type = async (page, text) => {
	await page.waitForSelector(`bf-editor`, { timeout: 5000 });
	await page.evaluate(() => document.querySelector(`bf-editor`).focus());
	await page.keyboard.type(text);
};
const postIdOf = (url) => url.match(/[?&]p=(\d+)/)?.[1];
const topicIdOf = (url) => url.match(/[?&]t=(\d+)/)?.[1];
const clickLink = async (page, text) => {
	const href = await page.evaluate((wanted) => [...document.querySelectorAll(`a`)].find((a) => a.textContent.trim() === wanted)?.href, text);

	if (href) {
		await go(page, href);
	}

	return !!href;
};

// 1. A guest ------------------------------------------------------------------------------------
{
	const context = await browser.createBrowserContext();
	const guest = await context.newPage();
	watch(guest);
	await go(guest, `index.php`);
	const forums = await guest.$$eval(`a.forumtitle`, (links) => links.map((a) => a.textContent.trim()));
	check(`guest: index lists the forums`, forums.includes(`General talk`) && forums.includes(`News and announcements`), forums.join(`, `));

	await clickLink(guest, `General talk`);
	await clickLink(guest, `Hot topic, unread`);
	check(`guest: a topic can be read`, (await guest.$$(`.post .content`)).length > 0, guest.url());
	const votes = await guest.$$eval(`.bf-vote`, (buttons) => buttons.map((b) => b.getAttribute(`aria-disabled`)));
	check(`guest: like buttons are read-only`, votes.length > 0 && votes.every((v) => v === `true`), votes.join());

	const reply = await guest.$(`a[href*="mode=reply"]`);

	if (reply) {
		await Promise.all([guest.waitForNavigation({ waitUntil: `networkidle0` }), reply.click()]);
	}

	check(`guest: Post a reply leads to the login page`, !!(await guest.$(`#username`)) && /mode=login/.test(guest.url()), guest.url());
	noErrors(`guest`);
	await context.close();
}

const page = await browser.newPage();
watch(page);
await page.setViewport({ width: 1100, height: 900 });

// 2. Log in and out -------------------------------------------------------------------------------
await go(page, `ucp.php?mode=login`);
await page.type(`#username`, process.env.BF_USER);
await page.type(`#password`, `wrong-password`);
await clickAndLoad(page, `input[name="login"]`);
const wrongMessage = await page.$eval(`.error, .errorbox`, (el) => el.innerText.trim()).catch(() => ``);
check(`login: a wrong password shows an error and stays on the login page`, wrongMessage.length > 0 && !!(await page.$(`#username`)), wrongMessage);

await login(page);
await go(page, `index.php`);
const nav = await page.$eval(`#username_logged_in, .header-profile`, (el) => el.innerText).catch(() => ``);
check(`login: the user name is in the navigation bar`, nav.toLowerCase().includes(process.env.BF_USER.toLowerCase()), nav);

const logoutHref = await page.$eval(`a[href*="mode=logout"]`, (a) => a.href);
await go(page, logoutHref);
check(`logout: the login link is back`, !!(await page.$(`a[href*="mode=login"]`)) && !(await page.$(`a[href*="mode=logout"]`)));
await login(page);
noErrors(`login`);

// 3. Browse by clicking ----------------------------------------------------------------------------
await go(page, `index.php`);
await clickLink(page, `General talk`);
check(`browse: the forum opens`, /viewforum\.php\?f=\d+/.test(page.url()) && (await page.$$(`a.topictitle`)).length > 0, page.url());
const forumUrl = page.url();
await clickLink(page, `Hot topic, unread`);
check(`browse: the topic opens`, /viewtopic\.php/.test(page.url()), page.url());
const hotUrl = page.url();

const paging = await page.$$eval(`.action-bar.bar-top .pagination a[href*="start="]`, (links) => links.length);
check(`browse: a long topic has page links`, paging > 0, String(paging));

if (paging > 0) {
	await clickLink(page, `Next`);
	check(`browse: Next goes to the second page`, /start=\d+/.test(page.url()), page.url());
}

const crumb = await page.evaluate(() => [...document.querySelectorAll(`#nav-breadcrumbs a`)].find((a) => a.textContent.trim() === `General talk`)?.href);
check(`browse: the breadcrumb leads back to the forum`, !!crumb && crumb.split(`&sid`)[0] === forumUrl.split(`&sid`)[0], `${crumb} vs ${forumUrl}`);
noErrors(`browse`);

// 4. Search ------------------------------------------------------------------------------------------
await go(page, `search.php`);
await page.type(`input[name="keywords"]`, `lorem`);
await clickAndLoad(page, `input[type="submit"][name="submit"], #search-box input[type="submit"], form[action*="search.php"] input[type="submit"]`);
const found = await page.$$eval(`a.topictitle`, (links) => links.length);
check(`search: a word from the dummy posts finds topics`, found > 0, page.url());

if (found > 0) {
	await clickAndLoad(page, `a.topictitle`);
	check(`search: a result opens its topic`, /viewtopic\.php/.test(page.url()), page.url());
}

noErrors(`search`);

// 5. A new topic ---------------------------------------------------------------------------------------
const title = `UI test ${Date.now()}`;
await go(page, forumUrl);
const postUrl = await page.$eval(`a[href*="mode=post"]`, (a) => a.href);
await go(page, postUrl);
await page.type(`#subject`, title);
await type(page, `Hello **bold** from the test`);
check(`new topic: typing in the editor writes BBCode to the form`, (await page.$eval(`#message`, (t) => t.value)) === `Hello [b]bold[/b] from the test`);

await wait(1600);
await clickAndLoad(page, `input[name="preview"]`);
const previewed = await page.$eval(`#preview .content`, (el) => el.innerHTML).catch(() => ``);
check(`new topic: Preview shows the bold text`, /<strong[^>]*>bold<\/strong>/.test(previewed), previewed);

await page.evaluate(() => document.querySelector(`bf-editor`)?.focus());
await submit(page, `input[name="post"]`);
const topicUrl = page.url();
const topicId = topicIdOf(topicUrl);
check(`new topic: submitting opens the topic with the title`, !!topicId && (await page.$eval(`h2.topic-title, h2 a`, (el) => el.textContent)).includes(title), topicUrl);
check(`new topic: the post shows the bold text`, await page.$eval(`.post .content strong`, (el) => el.textContent === `bold`).catch(() => false));
noErrors(`new topic`);

// 6. Reply and quote -------------------------------------------------------------------------------------
const firstPostId = await page.$eval(`.post`, (el) => el.id.replace(`p`, ``));
await go(page, `posting.php?mode=quote&p=${firstPostId}`);
const quoted = await page.$eval(`#message`, (t) => t.value);
check(`reply: Quote puts the first post in the editor`, quoted.includes(`[quote=`) && quoted.includes(`from the test`), quoted);
await type(page, ` My answer`);
await submit(page, `input[name="post"]`);
const replyPostId = postIdOf(page.url());
const quotes = await page.$$eval(`#p${replyPostId} blockquote`, (list) => list.length);
check(`reply: the reply shows a quote block and the answer`, quotes === 1 && (await page.$eval(`#p${replyPostId} .content`, (el) => el.innerText.includes(`My answer`))), `${quotes} quotes`);
noErrors(`reply`);

// 7. Edit own post ----------------------------------------------------------------------------------------
await go(page, `posting.php?mode=edit&p=${replyPostId}`);
await page.waitForSelector(`bf-editor`, { timeout: 5000 });
await page.evaluate(() => document.querySelector(`bf-editor`).focus());
await page.keyboard.down(`Control`);
await page.keyboard.press(`End`);
await page.keyboard.up(`Control`);
await page.keyboard.type(` EDITED`);
await submit(page, `input[name="post"]`);
const edited = await page.$eval(`#p${replyPostId} .content`, (el) => el.innerText);
check(`edit: the change shows in the post`, edited.includes(`EDITED`), edited);
check(`edit: the post says it was edited`, !!(await page.$(`#p${replyPostId} .notice`)));
noErrors(`edit`);

// 8. Like another member's post --------------------------------------------------------------------------
await go(page, forumUrl);
await clickLink(page, `Unread topic you posted in`);
const likePost = await page.$eval(`.post:has(.bf-votes-form)`, (el) => el.id).catch(() => ``);
check(`like: a post by another member has live like buttons`, !!likePost);

if (likePost) {
	const count = () => page.$eval(`#${likePost} .bf-vote[value="up"] .bf-vote-count`, (el) => Number(el.textContent));
	const pressed = () => page.$eval(`#${likePost} .bf-vote[value="up"]`, (el) => el.getAttribute(`aria-pressed`));
	const before = await count();
	const wasPressed = await pressed();
	await page.click(`#${likePost} .bf-vote[value="up"]`);
	await page.waitForNetworkIdle({ idleTime: 600 }).catch(() => {});
	await wait(500);
	check(`like: clicking Like changes the count and the pressed state`, (await count()) !== before && (await pressed()) !== wasPressed, `${before} -> ${await count()}`);
	await page.click(`#${likePost} .bf-vote[value="up"]`);
	await page.waitForNetworkIdle({ idleTime: 600 }).catch(() => {});
	await wait(500);
	check(`like: clicking again puts it back`, (await count()) === before && (await pressed()) === wasPressed);
}

noErrors(`like`);

// 9. Delete own post ----------------------------------------------------------------------------------------
await go(page, `viewtopic.php?t=${topicId}&p=${replyPostId}`);
const del = `#p${replyPostId} a[href*="mode=delete"], #p${replyPostId} a[href*="mode=soft_delete"]`;
await page.click(del);
await page.waitForSelector(`#phpbb_confirm`, { visible: true, timeout: 5000 }).catch(() => {});
check(`delete: the dialog opens on the same page`, await page.evaluate(() => getComputedStyle(document.querySelector(`#phpbb_confirm`) ?? document.body).display !== `none` && !!document.querySelector(`#phpbb_confirm`)));
await page.keyboard.press(`Escape`);
await wait(600);
check(`delete: cancel keeps the post`, !!(await page.$(`#p${replyPostId}`)));
await page.click(del);
await page.waitForSelector(`#phpbb_confirm`, { visible: true, timeout: 5000 });
await Promise.all([page.waitForNavigation({ waitUntil: `networkidle0`, timeout: 15000 }).catch(() => {}), page.click(`#phpbb_confirm input[name="confirm"]`)]);
await wait(500);
const gone = !(await page.$(`#p${replyPostId} .content`)) || (await page.$(`#p${replyPostId}.deleted`)) !== null || /deleted/i.test(await page.$eval(`#p${replyPostId}`, (el) => el.innerText).catch(() => `deleted`));
check(`delete: confirming removes the reply`, gone);

// Remove the topic too, through its only remaining post.
await go(page, `viewtopic.php?t=${topicId}`);
await page.click(`#p${firstPostId} a[href*="mode=delete"], #p${firstPostId} a[href*="mode=soft_delete"]`);
await page.waitForSelector(`#phpbb_confirm`, { visible: true, timeout: 5000 });
await Promise.all([page.waitForNavigation({ waitUntil: `networkidle0`, timeout: 15000 }).catch(() => {}), page.click(`#phpbb_confirm input[name="confirm"]`)]);
noErrors(`delete`);

// 10. Control panel and a private message --------------------------------------------------------------------
await go(page, `ucp.php`);
check(`control panel: opens with the member's menu`, !!(await page.$(`#tabs, .tabs`)) && /ucp\.php/.test(page.url()), page.url());
await go(page, `ucp.php?i=pm&mode=compose`);
await page.type(`#username_list`, `bob`);
await clickAndLoad(page, `input[name="add_to[]"], input[name="add_to"]`).catch(() => {});
await page.type(`#subject`, `UI test message`);
await type(page, `A private line from the test`);
await submit(page, `input[name="post"]`);
const sent = await page.$eval(`.successbox, #message .message`, (el) => el.innerText).catch(() => ``);
check(`messages: a private message to bob is sent`, /sent/i.test(sent), sent.slice(0, 120));
noErrors(`messages`);

// 11. Dark theme -------------------------------------------------------------------------------------------------
await go(page, `index.php`);
await page.click(`.bf-theme-switch__button`);
check(`dark theme: the switch turns it on`, (await page.evaluate(() => document.documentElement.dataset.theme)) === `dark`);
await page.reload({ waitUntil: `networkidle0` });
check(`dark theme: the choice survives a reload`, (await page.evaluate(() => document.documentElement.dataset.theme)) === `dark`);
await page.click(`.bf-theme-switch__button`);
check(`dark theme: the switch turns it off again`, (await page.evaluate(() => document.documentElement.dataset.theme)) !== `dark`);
noErrors(`dark theme`);

// 12. Phone width -----------------------------------------------------------------------------------------------
await page.setViewport({ width: 390, height: 800, isMobile: true, hasTouch: true });
for (const [name, path] of [[`index`, `index.php`], [`topic`, hotUrl], [`reply page`, `posting.php?mode=reply&t=${hotUrl.match(/t=(\d+)/)[1]}`]]) {
	await go(page, path);
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
	check(`phone: ${name} has no sideways scroll`, overflow <= 0, `${overflow}px too wide`);
}

noErrors(`phone`);

console.log(out.join(`\n`));
console.log(`\n${failed === 0 ? `ALL PASSED` : `${failed} FAILED`} (${out.length} checks)`);
await page.close();
process.exitCode = failed === 0 ? 0 : 1;
