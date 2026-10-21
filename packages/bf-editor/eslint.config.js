// ESLint does only what Biome cannot: the house style for braces and blank lines.
// House style: braces everywhere, `} else {` on one line, and a blank line above
// if, for, while, do, switch, try and return (unless it is the first line in its block).
// Everything else (formatting, other lint rules) is Biome's job. See biome.json.
export default [
	{
		files: ['src/**/*.js', 'test/**/*.js', 'tools/**/*.mjs', 'build.mjs'],
		languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
		rules: {
			// Braces around every if, else, for and while, even for one line.
			curly: ['error', 'all'],
			// A blank line above if, for, while, do, switch, try and return, and below the blocks.
			'padding-line-between-statements': [
				'error',
				{ blankLine: 'always', prev: '*', next: ['if', 'for', 'while', 'do', 'switch', 'try', 'return'] },
				{ blankLine: 'always', prev: ['if', 'for', 'while', 'do', 'switch', 'try'], next: '*' },
			],
		},
	},
];
