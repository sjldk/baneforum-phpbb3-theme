import { connect } from './connect.mjs';
import { login } from './login.mjs';

const browser = await connect();
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 1200 });
await page.setCacheEnabled(false);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
page.on(`pageerror`, (error) => console.log(`PAGEERROR ${error.message}`));
await login(page);
await page.goto(`http://localhost:8080/posting.php?mode=reply&t=1`, { waitUntil: `networkidle0` });
await page.waitForSelector(`bf-editor`);
await wait(1500);

const drop = (name, type, bytes) => page.evaluate((n, t, b) => {
	const editable = document.querySelector(`bf-editor`).shadowRoot.querySelector(`bf-editable`);
	const transfer = new DataTransfer();
	transfer.items.add(new File([new Uint8Array(b)], n, { type: t }));
	const rect = editable.getBoundingClientRect();
	editable.dispatchEvent(new DragEvent(`drop`, { clientX: rect.left + 50, clientY: rect.top + 20, bubbles: true, cancelable: true, dataTransfer: transfer }));
}, name, type, [...bytes]);
const look = () => page.evaluate(() => {
	const root = document.querySelector(`bf-editor`).shadowRoot;

	return {
		uploading: document.querySelector(`bf-editor`).uploading,
		inText: root.querySelectorAll(`bf-editable .attachment`).length,
		uploads: [...root.querySelectorAll(`bf-editable .upload`)].map((u) => u.textContent.trim().slice(0, 80)),
		live: root.querySelector(`output.visually-hidden`)?.textContent,
		rows: [...document.querySelectorAll(`#file-list > .attach-row:not(.attach-row-tpl)`)].map((r) => ({
			name: r.querySelector(`.file-name`)?.textContent.trim(),
			shown: r.offsetHeight > 0,
			status: r.querySelector(`.file-status`)?.className,
			message: r.querySelector(`.file-status`)?.textContent.trim(),
		})),
		textarea: document.querySelector(`#message`).value,
	};
});

const check = (name, ok, extra = ``) => console.log(`${ok ? `PASS` : `FAIL`} ${name} ${extra}`);

// A file type the board does not allow: phpBB's own error dialog says so, and nothing stays in the list.
await drop(`virus.exe`, `application/octet-stream`, Buffer.from(`MZ not really`));
await wait(2500);
const dialog = await page.evaluate(() => ({ open: document.querySelector(`#phpbb_alert`)?.open === true, text: document.querySelector(`#phpbb_alert .alert_text`)?.textContent }));
check(`a file type that is not allowed gives an error dialog with the file name`, dialog.open && dialog.text.includes(`virus.exe`), JSON.stringify(dialog));
await page.evaluate(() => document.querySelector(`#phpbb_alert .alert_close`).click());
let s = await look();
check(`and nothing is left in the list`, s.rows.length === 0 && s.inText === 0, JSON.stringify(s));

// A file that looks like a picture but is not one: the editor shows the reason.
await drop(`fake.jpg`, `image/jpeg`, Buffer.from(`this is plain text, not a picture`));
await wait(3000);
s = await look();
check(`a fake picture shows the reason in the editor`, s.uploads.length === 1 && s.uploads[0].includes(`Could not upload`), JSON.stringify(s.uploads));
check(`it is said to screen readers`, s.live.includes(`fake.jpg`), s.live);
check(`it does not stay in the attachment list`, s.rows.length === 0, JSON.stringify(s.rows));
check(`it is not counted as uploading`, s.uploading === 0);

// The writer removes the error and can still upload a good picture.
await page.evaluate(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`bf-editable .upload button`).click());
await wait(300);
s = await look();
check(`Remove takes the error away`, s.uploads.length === 0, JSON.stringify(s.uploads));
const input = await page.evaluateHandle(() => document.querySelector(`bf-editor`).shadowRoot.querySelector(`input[type="file"]`));
await input.uploadFile(process.argv[2]);
await wait(3500);
s = await look();
check(`a good picture uploads after the failure`, s.inText === 1 && s.textarea.includes(`[attachment=0]`), JSON.stringify([s.inText, s.textarea]));
await page.close();
await browser.disconnect();
