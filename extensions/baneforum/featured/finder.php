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
use phpbb\textformatter\s9e\utils;

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

	/** A post newer than this many days gets the "New" label. */
	public const NEW_DAYS = 7;

	/** How many picture rows to read. One post can have many pictures, and only the first one is used. */
	protected const ROWS = 60;

	/** The snippet is cut here, in characters. The style fades it out at the height of the picture, so this only has to be long enough. */
	public const SNIPPET = 420;

	/**
	 * Keeps the services that the query needs.
	 *
	 * @param driver_interface   $db          The database.
	 * @param tools_interface    $db_tools    Used to see if the vote table exists.
	 * @param content_visibility $visibility  Builds the rule for the posts the member may see.
	 * @param utils              $utils       Strips the formatting from the stored post.
	 * @param string             $prefix      The prefix of the table names.
	 */
	public function __construct(
		protected driver_interface $db,
		protected tools_interface $db_tools,
		protected content_visibility $visibility,
		protected utils $utils,
		protected string $prefix
	)
	{
	}

	/**
	 * Reads the posts with pictures in the order described for the class, and keeps the first picture of each.
	 *
	 * @param int[] $forum_ids  The forums the member may read and download from.
	 *
	 * @return array<int, array<string, mixed>>  One row per post, by post id, with the first picture. At most LIMIT.
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
				p.post_text, p.post_time, p.poster_id, p.post_username, t.topic_title, u.username, u.user_colour, ' . $score . ' AS score
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
			$id = (int) $row['post_id'];
			if (!isset($posts[$id]))
			{
				$row['snippet'] = $this->snippet((string) $row['post_text']);
				unset($row['post_text']);
				$posts[$id] = $row;
			}
		}
		$this->db->sql_freeresult($result);

		return $posts;
	}

	/**
	 * Plain text from the stored post: no formatting, no addresses, one line, cut at a word.
	 *
	 * @param string $stored  The post text as phpBB stores it.
	 *
	 * @return string  The snippet, at most SNIPPET characters.
	 */
	public function snippet(string $stored): string
	{
		// phpBB 3.3 stores the post as XML. An attachment is <ATTACHMENT ...><s>[attachment=0]</s>file name<e>[/attachment]</e></ATTACHMENT>:
		// drop the whole element, so its file name does not end up in the text.
		$stored = preg_replace('~<ATTACHMENT\b.*?</ATTACHMENT>~su', '', $stored) ?? $stored;
		$text = $this->utils->clean_formatting($stored);
		$text = preg_replace('~https?://\S+~u', '', $text) ?? $text;
		$text = trim(preg_replace('~\s+~u', ' ', $text) ?? $text);

		if (function_exists('censor_text'))
		{
			$text = censor_text($text);
		}

		if (mb_strlen($text) <= self::SNIPPET)
		{
			return $text;
		}

		$cut = mb_substr($text, 0, self::SNIPPET);
		$space = mb_strrpos($cut, ' ');

		return rtrim($space > self::SNIPPET / 2 ? mb_substr($cut, 0, $space) : $cut, ' ,.;:-');
	}
}
