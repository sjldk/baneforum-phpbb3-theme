// Shared helper: log in to the Docker board as admin.
export async function login(page) {
	await page.goto(`http://localhost:8080/ucp.php?mode=login`, { waitUntil: `networkidle0` });
	if (!(await page.$(`#username`))) {
		return;
	}

	await page.type(`#username`, `admin`);
	await page.type(`#password`, `adminadmin`);
	await Promise.all([page.waitForNavigation({ waitUntil: `networkidle0` }), page.click(`input[name="login"]`)]);
}
