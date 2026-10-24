<?php
/**
 * Baneforum likes
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\likes;

use phpbb\db\driver\driver_interface;

/**
 * Stores one vote per member per post: +1 for a like, -1 for a dislike. The table does not say who voted
 * and when. See voter_key.
 */
class votes
{
	public const UP = 1;
	public const DOWN = -1;

	/** A post with more dislikes than this is collapsed. */
	public const HIDE_ABOVE = 5;

	/**
	 * Keeps the database and the key maker.
	 *
	 * @param driver_interface $db         The database.
	 * @param string           $table      The full name of the vote table.
	 * @param voter_key        $voter_key  Makes the voter value that is stored instead of the user id.
	 */
	public function __construct(
		protected driver_interface $db,
		protected string $table,
		protected voter_key $voter_key
	)
	{
	}

	/**
	 * The vote a member ends with after clicking a button. The same button again removes the vote.
	 *
	 * @param int $current  The vote the member has now: UP, DOWN or 0.
	 * @param int $clicked  The button that was clicked. Any other value changes nothing.
	 *
	 * @return int  UP, DOWN or 0.
	 */
	public static function next_value(int $current, int $clicked): int
	{
		if ($clicked !== self::UP && $clicked !== self::DOWN)
		{
			return $current;
		}

		return $current === $clicked ? 0 : $clicked;
	}

	/**
	 * Counts and the member's own vote for many posts, in two queries.
	 *
	 * @param int[] $post_ids  The posts to count.
	 * @param int   $user_id   The member whose own vote is wanted. A guest (1 or less) has none.
	 *
	 * @return array<int, array{up: int, down: int, mine: int}>  The counts and the own vote, by post id.
	 *                                                            Every post asked for is present.
	 */
	public function for_posts(array $post_ids, int $user_id): array
	{
		$result = [];

		foreach ($post_ids as $id)
		{
			$result[(int) $id] = ['up' => 0, 'down' => 0, 'mine' => 0];
		}

		if (!$result)
		{
			return $result;
		}

		$in = $this->db->sql_in_set('post_id', array_keys($result));
		$sql = "SELECT post_id, vote_value, COUNT(*) AS total
			FROM {$this->table}
			WHERE $in
			GROUP BY post_id, vote_value";
		$rows = $this->db->sql_query($sql);

		while ($row = $this->db->sql_fetchrow($rows))
		{
			$key = (int) $row['vote_value'] === self::UP ? 'up' : 'down';
			$result[(int) $row['post_id']][$key] = (int) $row['total'];
		}

		$this->db->sql_freeresult($rows);

		if ($user_id > 1)
		{
			// The table holds a hash per member and post, not the member. Work out the member's hashes and look for those.
			$voters = [];

			foreach (array_keys($result) as $id)
			{
				$voters[$this->voter_key->voter($user_id, $id)] = $id;
			}

			$sql = "SELECT post_id, vote_value FROM {$this->table}
				WHERE " . $this->db->sql_in_set('voter', array_keys($voters)) . " AND $in";
			$rows = $this->db->sql_query($sql);

			while ($row = $this->db->sql_fetchrow($rows))
			{
				$result[(int) $row['post_id']]['mine'] = (int) $row['vote_value'];
			}

			$this->db->sql_freeresult($rows);
		}

		return $result;
	}

	/**
	 * Applies a click and returns the new counts for the post.
	 *
	 * @param int $post_id  The post that was voted on.
	 * @param int $user_id  The member who clicked.
	 * @param int $clicked  The button that was clicked: UP or DOWN.
	 *
	 * @return array{up: int, down: int, mine: int}  The counts after the click, and the member's own vote.
	 */
	public function cast(int $post_id, int $user_id, int $clicked): array
	{
		$current = $this->for_posts([$post_id], $user_id)[$post_id]['mine'];
		$next = self::next_value($current, $clicked);

		if ($next !== $current)
		{
			$voter = $this->voter_key->voter($user_id, $post_id);
			$where = 'post_id = ' . $post_id . " AND voter = '" . $this->db->sql_escape($voter) . "'";

			if ($next === 0)
			{
				$this->db->sql_query("DELETE FROM {$this->table} WHERE $where");
			}
			else if ($current === 0)
			{
				$this->db->sql_query('INSERT INTO ' . $this->table . ' ' . $this->db->sql_build_array('INSERT', [
					'post_id'    => $post_id,
					'voter'      => $voter,
					'vote_value' => $next,
				]));
			}
			else
			{
				$this->db->sql_query('UPDATE ' . $this->table . ' SET vote_value = ' . $next . " WHERE $where");
			}
		}

		return $this->for_posts([$post_id], $user_id)[$post_id];
	}
}
