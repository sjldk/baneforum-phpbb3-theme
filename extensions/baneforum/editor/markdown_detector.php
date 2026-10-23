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
 * phpBB stores a post as XML. Markdown is stored as elements that BBCode never makes (bold as STRONG, not B),
 * or as the same element with Markdown's own marker text (a list item that starts with "- " and not with "[*]").
 * The editor reads such a post as Markdown and saves it as BBCode. Any other post is read as BBCode only,
 * so a "*" or a "#" in it is only a character.
 */
class markdown_detector
{
	private const PATTERN = '~'
		. '<(?:STRONG|EM|DEL|H[1-6]|HR|TABLE|C|SUB|SUP)[ >]'	// elements only Markdown makes
		. '|<LI(?:\s[^>]*)?><s>(?!\[\*\])'							// a list item not written with [*]
		. '|<URL[^>]*><s>\[</s>'							// [text](address)
		. '|<IMG[^>]*><s>!\['								// ![text](address)
		. '|<CODE[^>]*><s>(?!\[code)'						// a code fence, not [code]
		. '~';

	public function contains_markdown(string $xml): bool
	{
		return preg_match(self::PATTERN, $xml) === 1;
	}
}
