// Shared helper: connect to the browser that run.sh started (Chrome by default, Firefox with BROWSER=firefox).
import puppeteer from 'puppeteer-core';

export function connect() {
	const port = process.env.PORT || 9222;

	if (process.env.BROWSER === `firefox`) {
		return puppeteer.connect({ browserWSEndpoint: `ws://127.0.0.1:${port}/session`, protocol: `webDriverBiDi` });
	}

	return puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
}
