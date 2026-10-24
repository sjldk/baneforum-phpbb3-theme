<?php
/**
 * Baneforum YouTube thumbnails
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\ytthumb;

use phpbb\db\driver\driver_interface;
use Symfony\Component\HttpFoundation\Response;

/**
 * The address of a thumbnail: app.php/ytthumb/<video id>. Answers with the picture, or with 404 (then the card has no picture).
 */
class controller
{
	public function __construct(
		protected thumbs $thumbs,
		protected driver_interface $db,
		protected string $prefix
	) {
	}

	public function handle(string $id): Response
	{
		$path = $this->thumbs->find($id, fn (string $video): bool => $this->mentioned($video));

		if ($path === null || ($bytes = @file_get_contents($path)) === false)
		{
			return new Response('', 404, ['Cache-Control' => 'no-store']);
		}

		return new Response($bytes, 200, [
			'Content-Type'           => 'image/jpeg',
			'Content-Length'         => (string) strlen($bytes),
			'Cache-Control'          => 'public, max-age=604800',
			'X-Content-Type-Options' => 'nosniff',
		]);
	}

	/** A post of the board holds the video, as a saved embed or as a plain link. */
	protected function mentioned(string $id): bool
	{
		$like = $this->db->sql_like_expression($this->db->get_any_char() . $id . $this->db->get_any_char());
		$result = $this->db->sql_query_limit('SELECT post_id FROM ' . $this->prefix . 'posts WHERE post_text ' . $like, 1);
		$found = $this->db->sql_fetchrow($result) !== false;
		$this->db->sql_freeresult($result);

		return $found;
	}
}
