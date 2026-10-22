// Shared helper: connect to the browser that run.sh started (Chrome by default, Firefox with BROWSER=firefox).
import puppeteer from 'puppeteer-core';

export function connect() {
	if (process.env.BROWSER === `firefox`) {
		return puppeteer.connect({ browserWSEndpoint: `ws://127.0.0.1:9222/session`, protocol: `webDriverBiDi` });
	}

	return puppeteer.connect({ browserURL: `http://127.0.0.1:9222` });
}
