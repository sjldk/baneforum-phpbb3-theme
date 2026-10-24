<?php
/**
 * Baneforum latest posts
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\latest\event;

use baneforum\latest\finder;
use phpbb\auth\auth;
use phpbb\config\config;
use phpbb\template\template;
use phpbb\user;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Hands the front page the latest posts, as the template block `bf_latest`.
 */
class listener implements EventSubscriberInterface
{
	public function __construct(
		protected finder $finder,
		protected auth $auth,
		protected template $template,
		protected user $user,
		protected config $config,
		protected string $root_path,
		protected string $php_ext
	) {
	}

	public static function getSubscribedEvents(): array
	{
		return [
			'core.user_setup'              => 'load_language',
			'core.index_modify_page_title' => 'add_latest',
		];
	}

	public function load_language($event): void
	{
		$lang_set_ext = $event['lang_set_ext'];
		$lang_set_ext[] = ['ext_name' => 'baneforum/latest', 'lang_set' => 'common'];
		$event['lang_set_ext'] = $lang_set_ext;
	}

	public function add_latest($event): void
	{
		$forums = array_map('intval', array_keys($this->auth->acl_getf('f_read', true)));

		$posts = $this->finder->find($forums);
		$read = $this->read_times($posts);

		foreach ($posts as $post)
		{
			$topic = ['f' => (int) $post['forum_id'], 't' => (int) $post['topic_id'], 'p' => (int) $post['post_id']];

			$this->template->assign_block_vars('bf_latest', [
				'TITLE'  => $post['topic_title'],
				'FORUM'  => $post['forum_name'],
				'AUTHOR' => get_username_string('username', (int) $post['poster_id'], $post['username'], $post['user_colour'], $post['post_username']),
				'TIME'   => $this->user->format_date((int) $post['post_time']),
				'S_UNREAD' => $this->is_unread($post, $read),
				'U_POST' => append_sid($this->root_path . 'viewtopic.' . $this->php_ext, $topic) . '#p' . (int) $post['post_id'],
			]);
		}
	}

	/**
	 * When the member last read each topic, from phpBB's own tracking (the same that marks a topic unread in the lists).
	 * @return array<int, int> topic id => time
	 */
	protected function read_times(array $posts): array
	{
		if (!$this->tracks())
		{
			return [];
		}

		$by_forum = [];
		foreach ($posts as $post)
		{
			$by_forum[(int) $post['forum_id']][] = (int) $post['topic_id'];
		}

		$times = [];
		foreach ($by_forum as $forum_id => $topic_ids)
		{
			$times += get_complete_topic_tracking($forum_id, $topic_ids);
		}

		return $times;
	}

	/**
	 * A topic is unread when its newest post is newer than the time the member last read it. A visitor that the board does not track
	 * (a guest, and the board does not keep the read marks of guests) has nothing unread.
	 */
	protected function is_unread(array $post, array $read): bool
	{
		if (!$this->tracks())
		{
			return false;
		}

		return (int) ($read[(int) $post['topic_id']] ?? 0) < (int) $post['topic_last_post_time'];
	}

	protected function tracks(): bool
	{
		return !empty($this->user->data['is_registered']) || !empty($this->config['load_anon_lastread']);
	}
}
