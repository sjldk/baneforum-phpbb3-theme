import puppeteer from 'puppeteer-core';
import { login } from './login.mjs';

const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:9222` });
const page = await browser.newPage();
await login(page);
const post = process.argv[2] ?? `3`;
await page.goto(`http://localhost:8080/posting.php?mode=edit&p=${post}`, { waitUntil: `networkidle0` });
await page.waitForSelector(`bf-editor`);
const before = await page.$eval(`#message`, (t) => t.value);
console.log(`textarea before:`, JSON.stringify(before));
console.log(`editor value:`, JSON.stringify(await page.$eval(`bf-editor`, (e) => e.value)));
// Change only the subject, so the text is not touched.
await page.evaluate(() => { const s = document.querySelector(`#subject`); s.value += ` (x)`; });
await Promise.all([page.waitForNavigation({ waitUntil: `networkidle0` }), page.click(`input[name="post"]`)]);
await page.goto(`http://localhost:8080/posting.php?mode=edit&p=${post}`, { waitUntil: `networkidle0` });
console.log(`textarea after: `, JSON.stringify(await page.$eval(`#message`, (t) => t.value)));
await page.close();
await browser.disconnect();
