// What a document can contain. One place, no knowledge of how it is stored or shown.
import { Schema } from 'prosemirror-model';
import { defaultLinkPolicy } from './link-policy.js';

export const schema = new Schema({
	nodes: {
		doc: { content: `block+` },

		paragraph: {
			group: `block`,
			content: `inline*`,
			parseDOM: [{ tag: `p` }],
			toDOM: () => [`p`, 0],
		},

		// A quote. The attributes are kept as the source text after "quote" so that saving
		// gives back exactly what was loaded, for example ` post_id=7 time=1 user_id=2`.
		blockquote: {
			group: `block`,
			content: `block+`,
			defining: true,
			attrs: { author: { default: `` }, source: { default: `` } },
			parseDOM: [{ tag: `blockquote` }],
			toDOM: (node) => [`blockquote`, node.attrs.author ? { 'data-author': node.attrs.author } : {}, 0],
		},

		// A player for a video link. `source` is the exact text to save.
		embed: {
			group: `block`,
			atom: true,
			attrs: { provider: { default: `` }, url: { default: `` }, source: { default: `` } },
			parseDOM: [
				{ tag: `bf-youtube`, getAttrs: (dom) => ({ provider: `youtube`, url: dom.getAttribute(`url`) || `` }) },
			],
			toDOM: (node) => [`bf-youtube`, { url: node.attrs.url }],
		},

		// Block level markup the editor cannot show (headings, lists, code, tables).
		// The source is kept as it is, so nothing is lost on save.
		raw_block: {
			group: `block`,
			atom: true,
			attrs: { source: { default: `` }, before: { default: `` } },
			parseDOM: [{ tag: `pre[data-bf-raw]`, getAttrs: (dom) => ({ source: dom.textContent }) }],
			toDOM: (node) => [`pre`, { 'data-bf-raw': `` }, node.attrs.source],
		},

		text: { group: `inline` },

		hard_break: {
			group: `inline`,
			inline: true,
			selectable: false,
			parseDOM: [{ tag: `br` }],
			toDOM: () => [`br`],
		},

		// An uploaded file placed in the text, written as [attachment=N]name[/attachment].
		attachment: {
			group: `inline`,
			inline: true,
			atom: true,
			attrs: { index: { default: 0 }, name: { default: `` }, src: { default: `` }, image: { default: true } },
			parseDOM: [
				{
					tag: `bf-attachment`,
					getAttrs: (dom) => ({ index: Number(dom.getAttribute(`index`)), name: dom.getAttribute(`name`) || `` }),
				},
			],
			toDOM: (node) => [`bf-attachment`, { index: String(node.attrs.index), name: node.attrs.name }],
		},

		// A file that is being sent to the server. It is shown while it goes and writes nothing.
		// Status is "uploading" or "error". The preview address is a local one (blob:).
		upload: {
			group: `inline`,
			inline: true,
			atom: true,
			attrs: {
				id: { default: `` },
				name: { default: `` },
				src: { default: `` },
				status: { default: `uploading` },
				message: { default: `` },
			},
			toDOM: () => [`span`, { 'data-bf-upload': `` }],
		},

		// An image from another site, written as [img]address[/img].
		image: {
			group: `inline`,
			inline: true,
			atom: true,
			attrs: { src: { default: `` } },
			parseDOM: [{ tag: `img[src]`, getAttrs: (dom) => ({ src: dom.getAttribute(`src`) }) }],
			toDOM: (node) => [`img`, { src: node.attrs.src, alt: `` }],
		},

		// Inline markup the editor cannot show (underline, colour, size, inline code).
		raw_inline: {
			group: `inline`,
			inline: true,
			atom: true,
			attrs: { source: { default: `` } },
			parseDOM: [{ tag: `code[data-bf-raw]`, getAttrs: (dom) => ({ source: dom.textContent }) }],
			toDOM: (node) => [`code`, { 'data-bf-raw': `` }, node.attrs.source],
		},
	},

	marks: {
		strong: {
			parseDOM: [{ tag: `strong` }, { tag: `b` }],
			toDOM: () => [`strong`, 0],
		},
		em: {
			parseDOM: [{ tag: `em` }, { tag: `i` }],
			toDOM: () => [`em`, 0],
		},
		strike: {
			parseDOM: [{ tag: `del` }, { tag: `s` }],
			toDOM: () => [`del`, 0],
		},
		link: {
			attrs: { href: {} },
			inclusive: false,
			parseDOM: [{ tag: `a[href]`, getAttrs: (dom) => ({ href: dom.getAttribute(`href`) }) }],
			toDOM: (mark) => [`a`, { href: mark.attrs.href, ...defaultLinkPolicy.attributes(mark.attrs.href) }, 0],
		},
	},
});
