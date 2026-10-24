<?php
/**
 * Baneforum YouTube thumbnails
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\ytthumb;

/**
 * The print view of a topic has no JavaScript, so it never gets the video card. phpBB's own embed (an iframe) would put the whole YouTube
 * player on the paper page, and its picture comes from Google. This makes a static block instead: our own copy of the thumbnail, and
 * under it the address of the video, which is what a reader of the printed page needs.
 */
class print_cards
{
	/** The embed that phpBB's MediaEmbed extension makes for a YouTube video: a span with a span with an iframe. */
	public const EMBED = '#<span data-s9e-mediaembed="youtube"[^>]*>\s*<span[^>]*>\s*<iframe[^>]*?\ssrc="([^"]+)"[^>]*>\s*</iframe>\s*</span>\s*</span>#s';

	/**
	 * Reads the address of a YouTube embed and finds the video id and the link to watch it, with the start time if there is one.
	 *
	 * @param string $src The address of the iframe, as it stands in the HTML (with &amp;).
	 *
	 * @return array{id: string, url: string}|null The id and the watch address, or null if it is not a YouTube embed that we know.
	 */
	public static function video(string $src): ?array
	{
		$src = html_entity_decode($src, ENT_QUOTES, 'UTF-8');

		if (!preg_match('#^https?://(?:www\.)?youtube(?:-nocookie)?\.com/embed/([A-Za-z0-9_-]{11})(?:[?\#].*)?$#D', $src, $match))
		{
			return null;
		}

		$url = 'https://www.youtube.com/watch?v=' . $match[1];
		parse_str((string) parse_url($src, PHP_URL_QUERY), $query);

		if (isset($query['start']) && ctype_digit((string) $query['start']) && (int) $query['start'] > 0)
		{
			$url .= '&t=' . (int) $query['start'] . 's';
		}

		return ['id' => $match[1], 'url' => $url];
	}

	/**
	 * Replaces every YouTube player in a rendered message with a thumbnail and the address of the video.
	 *
	 * @param string $html The rendered message.
	 * @param callable(string): string $picture Gives the address of our thumbnail for a video id. It must be safe to put in an attribute (HTML escaped).
	 *
	 * @return string The message with static blocks in place of players.
	 */
	public static function replace(string $html, callable $picture): string
	{
		return (string) preg_replace_callback(self::EMBED, static function (array $found) use ($picture): string {
			$video = self::video($found[1]);

			if ($video === null)
			{
				return $found[0];
			}

			$url = htmlspecialchars($video['url'], ENT_QUOTES, 'UTF-8');

			// The picture is for the eye only (empty alt): the address under it says everything. The size is in the markup, so it holds in any style.
			return '<span class="bf-print-video" style="display:block;margin:0.5em 0">'
				. '<img src="' . $picture($video['id']) . '" alt="" width="320" height="180" style="display:block;width:320px;max-width:100%;height:auto;aspect-ratio:16/9;object-fit:cover">'
				. '<a href="' . $url . '">' . $url . '</a>'
				. '</span>';
		}, $html);
	}
}
