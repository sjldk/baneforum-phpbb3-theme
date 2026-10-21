// Dependency inversion, checked by a test: the core must not know the host.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

const forbidden = [/phpbb/i, /jquery/i, /\$\(/, /plupload/i, /from ['"]\.\.\/adapters/];

async function sourceFiles(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = await Promise.all(
		entries.map((entry) => (entry.isDirectory() ? sourceFiles(join(dir, entry.name)) : [join(dir, entry.name)])),
	);

	return files.flat().filter((file) => file.endsWith(`.js`));
}

test(`src/ mentions no host project (phpBB, jQuery, Plupload)`, async () => {
	for (const file of await sourceFiles(`src`)) {
		const text = await readFile(file, `utf8`);
		// Comments may explain why. Only code counts.
		const code = text.replace(/\/\*[\s\S]*?\*\//g, ``).replace(/^\s*\/\/.*$/gm, ``);

		for (const pattern of forbidden) {
			assert.ok(!pattern.test(code), `${file} matches ${pattern}`);
		}
	}
});
