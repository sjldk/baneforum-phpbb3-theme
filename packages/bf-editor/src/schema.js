// What a document can contain. One place, no knowledge of how it is stored or shown.
import { Schema } from 'prosemirror-model';
import { tableNodes } from 'prosemirror-tables';
import { defaultLinkPolicy } from './link-policy.js';

/** The most columns a table may have (the picker, the add-column command and a paste all stop here). */
export const MAX_TABLE_COLUMNS = 8;
/** The most rows a table may have (the picker, the add-row commands, Tab in the last cell and a paste all stop here). */
export const MAX_TABLE_ROWS = 5;

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

		// A list. The marker is what [list=...] says: 1, a, A, i or I. A bullet list has none.
		bullet_list: {
			group: `block`,
			content: `list_item+`,
			parseDOM: [{ tag: `ul` }],
			toDOM: () => [`ul`, 0],
		},

		ordered_list: {
			group: `block`,
			content: `list_item+`,
			attrs: { marker: { default: `1` } },
			parseDOM: [
				{
					tag: `ol`,
					getAttrs: (dom) => ({
						marker: /^[1aAiI]$/.test(dom.getAttribute(`type`) ?? ``) ? dom.getAttribute(`type`) : `1`,
					}),
				},
			],
			toDOM: (node) => [`ol`, node.attrs.marker === `1` ? {} : { type: node.attrs.marker }, 0],
		},

		// An item is one paragraph, and then the lists that are nested in it. BBCode has no more than that.
		list_item: {
			content: `paragraph (bullet_list | ordered_list)*`,
			defining: true,
			parseDOM: [{ tag: `li` }],
			toDOM: () => [`li`, 0],
		},

		// Tables. The cells hold inline text only, because [td] and [th] on the server make no paragraphs.
		...tableNodes({
			tableGroup: `block`,
			cellContent: `inline*`,
			cellAttributes: {
				align: {
					default: null,
					getFromDOM: (dom) => dom.style.textAlign || null,
					setDOMAttr: (value, attrs) => {
						if (value) {
							attrs.style = `${attrs.style ?? ``}text-align: ${value};`;
						}
					},
				},
			},
		}),

		// Block level markup the editor cannot show (code, and a list or table it cannot represent).
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
