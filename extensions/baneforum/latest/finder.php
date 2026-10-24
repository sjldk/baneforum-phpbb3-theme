<?php
/**
 * Baneforum latest posts
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\latest;

use phpbb\content_visibility;
use phpbb\db\driver\driver_interface;

/**
 * Finds the newest activity the member may read: one line for each topic, with its newest post, newest first, and the forum and the author.
 */
class finder
{
	/** How many posts to show. */
	public const LIMIT = 8;

	public function __construct(
		protected driver_interface $db,
		protected content_visibility $visibility,
		protected string $prefix
	) {
	}

	/**
	 * @param int[] $forum_ids forums the member may read
	 * @return array<int, array<string, mixed>> the posts, newest first
	 */
	public function find(array $forum_ids): array
	{
		if (!$forum_ids)
		{
			return [];
		}

		// One line for each topic, with the newest post of the topic.
		$sql = 'SELECT p.post_id, p.topic_id, p.forum_id, p.post_time, p.poster_id, p.post_username,
				t.topic_title, f.forum_name, u.username, u.user_colour
			FROM ' . $this->prefix . 'topics t
			JOIN ' . $this->prefix . 'posts p ON p.post_id = t.topic_last_post_id
			JOIN ' . $this->prefix . 'forums f ON f.forum_id = t.forum_id
			JOIN ' . $this->prefix . 'users u ON u.user_id = p.poster_id
			WHERE ' . $this->visibility->get_forums_visibility_sql('topic', $forum_ids, 't.') . '
				AND t.topic_status <> ' . ITEM_MOVED . '
			ORDER BY t.topic_last_post_time DESC, t.topic_id DESC';
		$result = $this->db->sql_query_limit($sql, self::LIMIT);
		$rows = $this->db->sql_fetchrowset($result);
		$this->db->sql_freeresult($result);

		return $rows ?: [];
	}
}
