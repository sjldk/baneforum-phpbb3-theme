// ESLint does only what Biome cannot: the house style for braces, blank lines and quotes.
// House style: strings are template literals (backticks), never single or double quotes.
// House style: braces everywhere, `} else {` on one line, and a blank line above
// if, for, while, do, switch, try and return (unless it is the first line in its block).
// Our rules for comments are in tools/eslint-comments.mjs (a small plugin, no dependency). See docs/code-style.md.
// Everything else (formatting, other lint rules) is Biome's job. See biome.json.
import comments from './tools/eslint-comments.mjs';

export default [
	{
		files: [`src/**/*.js`, `test/**/*.js`, `tools/**/*.mjs`, `build.mjs`, `eslint.config.js`],
		languageOptions: { ecmaVersion: 2024, sourceType: `module` },
		plugins: { 'bf-comments': comments },
		rules: {
			// Every file says what it is for.
			'bf-comments/file-comment': `error`,
			// Backticks for every string. Import paths and property keys stay as the language needs them.
			quotes: [`error`, `backtick`],
			// Braces around every if, else, for and while, even for one line.
			curly: [`error`, `all`],
			// A blank line above if, for, while, do, switch, try and return, and below the blocks.
			'padding-line-between-statements': [
				`error`,
				{ blankLine: `always`, prev: `*`, next: [`if`, `for`, `while`, `do`, `switch`, `try`, `return`] },
				{ blankLine: `always`, prev: [`if`, `for`, `while`, `do`, `switch`, `try`], next: `*` },
			],
		},
	},
	{
		// Every function, class, method and field in the source has a comment in words. Tests and build files need only the file comment.
		files: [`src/**/*.js`, `tools/**/*.mjs`],
		plugins: { 'bf-comments': comments },
		rules: { 'bf-comments/doc-comment': `error` },
	},
];
