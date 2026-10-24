// Our rules for comments, as a small ESLint plugin (see docs/code-style.md). No dependency: ESLint only needs a
// file that exports `rules`.
//   bf-comments/file-comment  a file starts with a comment on what the file is for
//   bf-comments/doc-comment   every function, class, method and field at the top of a file or class has a /** */
//                             comment that says in words what it is for (tags alone, like @type, are not enough)

/**
 * The words in a /** *\/ comment, without the stars and without the tag lines (@param and so on).
 * @param {string} text  the comment, without the opening and closing marks
 * @returns {string}
 */
function description(text) {
	return text
		.split(`\n`)
		.map((line) => line.replace(/^\s*\*?\s?/, ``))
		.filter((line) => !line.startsWith(`@`))
		.join(` `)
		.trim();
}

/**
 * Whether the comment right above the node is a doc comment with a description.
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('estree').Node & {parent?: import('estree').Node}} node
 * @returns {boolean}
 */
function hasDocComment(sourceCode, node) {
	// The comment sits above `export` and above `const`, not above the function itself.
	let target = /** @type {import('estree').Node & {parent?: import('estree').Node}} */ (node);

	while (
		target.parent &&
		[`ExportNamedDeclaration`, `ExportDefaultDeclaration`, `VariableDeclaration`].includes(target.parent.type)
	) {
		target = target.parent;
	}

	const comment = sourceCode.getCommentsBefore(target).at(-1);

	return Boolean(
		comment && comment.type === `Block` && comment.value.startsWith(`*`) && description(comment.value.slice(1)) !== ``,
	);
}

/** @type {import('eslint').Rule.RuleModule} */
const fileComment = {
	meta: {
		type: `suggestion`,
		schema: [],
		messages: { missing: `A file starts with a comment on what the file is for.` },
	},
	create(context) {
		return {
			Program(node) {
				const first = context.sourceCode.getAllComments()[0];
				const code = node.body[0];

				if (code && (!first || first.range[0] > code.range[0] || first.loc?.start.line > 3)) {
					context.report({ node: code, messageId: `missing` });
				}
			},
		};
	},
};

/** @type {import('eslint').Rule.RuleModule} */
const docComment = {
	meta: {
		type: `suggestion`,
		schema: [],
		messages: { missing: `{{kind}} {{name}} needs a /** */ comment that says what it is for.` },
	},
	create(context) {
		const { sourceCode } = context;

		/**
		 * @param {import('estree').Node & {parent?: import('estree').Node}} node
		 * @param {string} kind
		 * @param {string} name
		 */
		const need = (node, kind, name) => {
			if (!hasDocComment(sourceCode, node)) {
				context.report({ node, messageId: `missing`, data: { kind, name } });
			}
		};

		/** @param {import('estree').Node & {parent?: import('estree').Node}} node */
		const atTopOfFile = (node) =>
			node.parent?.type === `Program` ||
			(node.parent?.type?.startsWith(`Export`) && node.parent.parent?.type === `Program`);

		return {
			FunctionDeclaration(node) {
				if (atTopOfFile(node)) {
					need(node, `Function`, node.id?.name ?? `(default)`);
				}
			},
			ClassDeclaration(node) {
				if (atTopOfFile(node)) {
					need(node, `Class`, node.id?.name ?? `(default)`);
				}
			},
			VariableDeclaration(node) {
				if (!atTopOfFile(node)) {
					return;
				}

				for (const declaration of node.declarations) {
					const init = declaration.init;

					if (init && [`ArrowFunctionExpression`, `FunctionExpression`, `ClassExpression`].includes(init.type)) {
						need(node, `Function`, declaration.id.type === `Identifier` ? declaration.id.name : `(pattern)`);
					}
				}
			},
			MethodDefinition(node) {
				if (node.kind !== `constructor`) {
					const name = node.key.type === `Identifier` ? node.key.name : `(computed)`;
					need(node, `Method`, name);
				}
			},
			PropertyDefinition(node) {
				const name =
					node.key.type === `Identifier` || node.key.type === `PrivateIdentifier` ? node.key.name : `(computed)`;
				need(node, `Field`, name);
			},
		};
	},
};

export default { rules: { 'file-comment': fileComment, 'doc-comment': docComment } };
