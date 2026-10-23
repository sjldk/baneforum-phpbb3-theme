<?php
/**
 * Baneforum featured posts
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\featured;

use phpbb\content_visibility;
use phpbb\db\driver\driver_interface;
use phpbb\db\tools\tools_interface;

/**
 * Finds the posts to feature on the front page: posts with a picture, best liked first, then newest.
 * A post with more dislikes than likes is left out. Without the likes extension, newest first.
 * Posts from the last WINDOW_DAYS come first. Older posts fill the rest, so the list is never empty
 * when the board has posts with pictures.
 */
class finder
{
	/** How many posts to show. */
	public const LIMIT = 5;

	/** Posts newer than this many days go before older ones. */
	public const WINDOW_DAYS = 30;

	/** How many picture rows to read. One post can have many pictures, and only the first one is used. */
	protected const ROWS = 60;

	public function __construct(
		protected driver_interface $db,
		protected tools_interface $db_tools,
		protected content_visibility $visibility,
		protected string $prefix
	) {
	}

	/**
	 * @param int[] $forum_ids forums the member may read and download from
	 * @return array<int, array<string, mixed>> one row per post, with the first picture
	 */
	public function find(array $forum_ids): array
	{
		if (!$forum_ids)
		{
			return [];
		}

		$votes = $this->prefix . 'baneforum_votes';
		$has_votes = $this->db_tools->sql_table_exists($votes);
		$score = $has_votes ? 'COALESCE(v.score, 0)' : '0';
		$join = $has_votes
			? "LEFT JOIN (SELECT post_id, SUM(vote_value) AS score FROM $votes GROUP BY post_id) v ON v.post_id = p.post_id"
			: '';

		$sql = 'SELECT a.attach_id, a.thumbnail, p.post_id, p.topic_id, p.forum_id,
				p.post_time, p.poster_id, p.post_username, t.topic_title, u.username, u.user_colour, ' . $score . ' AS score
			FROM ' . $this->prefix . 'attachments a
			JOIN ' . $this->prefix . 'posts p ON p.post_id = a.post_msg_id
			JOIN ' . $this->prefix . 'topics t ON t.topic_id = p.topic_id
			JOIN ' . $this->prefix . 'users u ON u.user_id = p.poster_id
			' . $join . '
			WHERE a.is_orphan = 0
				AND a.in_message = 0
				AND a.mimetype LIKE \'image/%\'
				AND ' . $score . ' >= 0
				AND ' . $this->visibility->get_forums_visibility_sql('post', $forum_ids, 'p.') . '
			ORDER BY CASE WHEN p.post_time >= ' . (time() - self::WINDOW_DAYS * 86400) . ' THEN 1 ELSE 0 END DESC,
				score DESC, p.post_time DESC, a.attach_id ASC';
		$result = $this->db->sql_query_limit($sql, self::ROWS);

		$posts = [];
		while (($row = $this->db->sql_fetchrow($result)) && count($posts) < self::LIMIT)
		{
			$posts[(int) $row['post_id']] ??= $row;
		}
		$this->db->sql_freeresult($result);

		return $posts;
	}
}
