<?php
/**
 * Baneforum latest posts
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\latest\event;

use baneforum\latest\finder;
use phpbb\auth\auth;
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

		foreach ($this->finder->find($forums) as $post)
		{
			$topic = ['f' => (int) $post['forum_id'], 't' => (int) $post['topic_id'], 'p' => (int) $post['post_id']];

			$this->template->assign_block_vars('bf_latest', [
				'TITLE'  => $post['topic_title'],
				'FORUM'  => $post['forum_name'],
				'AUTHOR' => get_username_string('username', (int) $post['poster_id'], $post['username'], $post['user_colour'], $post['post_username']),
				'TIME'   => $this->user->format_date((int) $post['post_time']),
				'U_POST' => append_sid($this->root_path . 'viewtopic.' . $this->php_ext, $topic) . '#p' . (int) $post['post_id'],
			]);
		}
	}
}
