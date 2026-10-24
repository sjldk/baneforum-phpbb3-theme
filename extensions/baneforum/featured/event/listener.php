<?php
/**
 * Baneforum featured posts
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\featured\event;

use baneforum\featured\finder;
use phpbb\auth\auth;
use phpbb\template\template;
use phpbb\user;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Hands the front page the posts to show, as the template block `bf_featured`.
 */
class listener implements EventSubscriberInterface
{
	/**
	 * Keeps the services that the front page needs.
	 *
	 * @param finder   $finder     Finds the posts to feature.
	 * @param auth     $auth       Tells which forums the member may read and download from.
	 * @param template $template   The page template that gets the block.
	 * @param user     $user       The member, for the time format.
	 * @param string   $root_path  The phpBB root path, for the links.
	 * @param string   $php_ext    The php file extension, for the links.
	 */
	public function __construct(
		protected finder $finder,
		protected auth $auth,
		protected template $template,
		protected user $user,
		protected string $root_path,
		protected string $php_ext
	)
	{
	}

	/**
	 * The events this listener wants.
	 *
	 * @return array<string, string>  Event name and method name.
	 */
	public static function getSubscribedEvents(): array
	{
		return [
			'core.user_setup'              => 'load_language',
			'core.index_modify_page_title' => 'add_featured',
		];
	}

	/**
	 * Adds the language file of this extension to every page.
	 *
	 * @param \phpbb\event\data $event  The core.user_setup event.
	 *
	 * @return void
	 */
	public function load_language($event): void
	{
		$lang_set_ext = $event['lang_set_ext'];
		$lang_set_ext[] = ['ext_name' => 'baneforum/featured', 'lang_set' => 'common'];
		$event['lang_set_ext'] = $lang_set_ext;
	}

	/**
	 * Fills the template block with the posts to feature. Only forums the member may read and download from count,
	 * because the picture is a download.
	 *
	 * @param \phpbb\event\data $event  The core.index_modify_page_title event.
	 *
	 * @return void
	 */
	public function add_featured($event): void
	{
		$read = array_keys($this->auth->acl_getf('f_read', true));
		$download = array_keys($this->auth->acl_getf('f_download', true));
		$forums = array_map('intval', array_intersect($read, $download));

		foreach ($this->finder->find($forums) as $post)
		{
			$picture = ['id' => (int) $post['attach_id']];
			if ($post['thumbnail'])
			{
				$picture['t'] = 1;
			}
			$topic = ['f' => (int) $post['forum_id'], 't' => (int) $post['topic_id'], 'p' => (int) $post['post_id']];

			$this->template->assign_block_vars('bf_featured', [
				'TITLE'     => $post['topic_title'],
				'SNIPPET'   => $post['snippet'],
				'AUTHOR'    => get_username_string('username', (int) $post['poster_id'], $post['username'], $post['user_colour'], $post['post_username']),
				'TIME'      => $this->user->format_date((int) $post['post_time']),
				'U_PICTURE' => append_sid($this->root_path . 'download/file.' . $this->php_ext, $picture),
				'U_PICTURE_FULL' => append_sid($this->root_path . 'download/file.' . $this->php_ext, ['id' => (int) $post['attach_id']]),
				'U_POST'    => append_sid($this->root_path . 'viewtopic.' . $this->php_ext, $topic) . '#p' . (int) $post['post_id'],
			]);
		}
	}
}
