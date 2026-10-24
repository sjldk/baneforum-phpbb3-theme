<?php
/**
 * Baneforum editor
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\editor;

/**
 * Tells from the stored XML of a post whether it holds Markdown.
 *
 * The board stores a post as XML. Markdown is stored as elements that BBCode never makes (bold as STRONG, not B),
 * or as the same element with Markdown's own marker text (a list item that starts with "- " and not with "[*]", a table that does
 * not start with "[table]").
 * The editor reads such a post as Markdown and saves it as BBCode. Any other post is read as BBCode only,
 * so a "*" or a "#" in it is only a character.
 */
class markdown_detector
{
	private const PATTERN = '~'
		. '<(?:STRONG|EM|DEL|H[1-6]|HR|C|SUB|SUP)[ >]'	// elements only Markdown makes
		. '|<TABLE(?:\s[^>]*)?>(?!<s>\[table\])'			// a table that is not written with [table] (our table BBCode makes the same element)
		. '|<LI(?:\s[^>]*)?><s>(?!\[\*\])'							// a list item not written with [*]
		. '|<URL[^>]*><s>\[</s>'							// a link written as [text] followed by (address)
		. '|<IMG[^>]*><s>!\['								// an image written as ! then [text] and (address)
		. '|<CODE[^>]*><s>(?!\[code)'						// a code fence, not [code]
		. '~';

	/**
	 * Tells whether the stored XML of a post holds Markdown.
	 *
	 * @param string $xml  The stored text of a post
	 *
	 * @return bool  True when the post was written in Markdown
	 */
	public function contains_markdown(string $xml): bool
	{
		return preg_match(self::PATTERN, $xml) === 1;
	}
}
