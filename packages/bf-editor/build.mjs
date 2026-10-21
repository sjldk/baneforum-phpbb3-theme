// Bundles the package into dist/ (ES modules) and copies the stylesheet.
//   dist/bf-editor.js   the editor
//   dist/bf-render.js   only what a page that shows posts needs (small, no ProseMirror)

import { copyFile, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';

await mkdir('dist', { recursive: true });

const shared = {
	bundle: true,
	target: 'es2022',
	minify: true,
	sourcemap: true,
	legalComments: 'none',
};

await build({ ...shared, entryPoints: ['src/index.js'], outfile: 'dist/bf-editor.js', format: 'esm' });
// The render script runs on every page, so it is a plain script, not a module.
await build({ ...shared, entryPoints: ['src/render.js'], outfile: 'dist/bf-render.js', format: 'iife' });

await copyFile('src/bf-editor.css', 'dist/bf-editor.css');
