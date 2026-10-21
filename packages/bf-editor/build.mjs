// Bundles the package into dist/ (ES modules) and copies the stylesheet for saved posts.
//   dist/bf-editor.js   the editor
//   dist/bf-render.js   only what a page that shows posts needs (small, no ProseMirror)

import { copyFile, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';

await mkdir(`dist`, { recursive: true });

const shared = {
	bundle: true,
	target: `es2022`,
	minify: true,
	sourcemap: true,
	legalComments: `none`,
	// The editor's HTML and CSS are text files that go into its shadow root.
	loader: { '.html': `text`, '.css': `text` },
};

await build({ ...shared, entryPoints: [`src/index.js`], outfile: `dist/bf-editor.js`, format: `esm` });
// The render script runs on every page, so it is a plain script, not a module.
await build({ ...shared, entryPoints: [`src/render.js`], outfile: `dist/bf-render.js`, format: `iife` });

await copyFile(`src/bf-render.css`, `dist/bf-render.css`);
