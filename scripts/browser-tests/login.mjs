// Shared helper: log in to the Docker board as admin.
// Another board: BASE=http://localhost:8081 BF_USER=Baneforum.dk BF_PASS=adminadmin (the production copy).
export async function login(page) {
	const base = process.env.BASE ?? `http://localhost:8080`;

	await page.goto(`${base}/ucp.php?mode=login`, { waitUntil: `networkidle0` });
	if (!(await page.$(`#username`))) {
		return;
	}

	await page.type(`#username`, process.env.BF_USER ?? `admin`);
	await page.type(`#password`, process.env.BF_PASS ?? `adminadmin`);
	await Promise.all([page.waitForNavigation({ waitUntil: `networkidle0` }), page.click(`input[name="login"]`)]);
}
