// Runs the codec over a file of real messages and writes the converted text next to the original.
// Usage (inside the Node container): node tools/convert-corpus.mjs /local-data/corpus/posts.jsonl /local-data/corpus/converted.jsonl
import { createReadStream, createWriteStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createMarkdownBBCodeCodec } from '../src/codecs/markdown-bbcode.js';
import { schema } from '../src/schema.js';

const [input, output] = process.argv.slice(2);
const codec = createMarkdownBBCodeCodec(schema);
const out = createWriteStream(output);
const stats = { total: 0, crashed: 0, unstable: 0, empty: 0, changed: 0 };
const crashes = [];

for await (const line of createInterface({ input: createReadStream(input) })) {
	const row = JSON.parse(line);
	stats.total += 1;

	try {
		const doc = codec.parse(row.text);
		const converted = codec.serialize(doc);
		const again = codec.serialize(codec.parse(converted));
		const stable = again === converted;

		if (!stable) {
			stats.unstable += 1;
		}

		if (converted.trim() === `` && row.text.trim() !== ``) {
			stats.empty += 1;
		}

		if (converted !== row.text) {
			stats.changed += 1;
		}

		out.write(`${JSON.stringify({ kind: row.kind, id: row.id, original: row.text, converted, stable })}\n`);
	} catch (error) {
		stats.crashed += 1;

		if (crashes.length < 5) {
			crashes.push({ id: row.id, kind: row.kind, message: String(error.message).slice(0, 200) });
		}
	}
}

out.end();
console.log(JSON.stringify({ stats, crashes }, null, 2));
