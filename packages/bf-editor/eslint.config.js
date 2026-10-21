// ESLint does only what Biome cannot: the house style for braces, blank lines and quotes.
// House style: strings are template literals (backticks), never single or double quotes.
// House style: braces everywhere, `} else {` on one line, and a blank line above
// if, for, while, do, switch, try and return (unless it is the first line in its block).
// Everything else (formatting, other lint rules) is Biome's job. See biome.json.
export default [
	{
		files: [`src/**/*.js`, `test/**/*.js`, `tools/**/*.mjs`, `build.mjs`, `eslint.config.js`],
		languageOptions: { ecmaVersion: 2024, sourceType: `module` },
		rules: {
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
];
