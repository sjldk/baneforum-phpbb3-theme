<?php
/**
 * Baneforum forum menu
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\forummenu\event;

use phpbb\auth\auth;
use phpbb\db\driver\driver_interface;
use phpbb\template\template;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Hands every page the forums the visitor may see, as the template block `bf_forummenu`, in the order of the forum list.
 */
class listener implements EventSubscriberInterface
{
	/**
	 * Sets the services this listener needs.
	 *
	 * @param driver_interface $db  The database.
	 * @param auth $auth  The permissions of the visitor.
	 * @param template $template  The template, which gets the forum list.
	 * @param string $prefix  The prefix of the table names.
	 * @param string $root_path  The path to the phpBB root folder.
	 * @param string $php_ext  The file extension of PHP files.
	 */
	public function __construct(
		protected driver_interface $db,
		protected auth $auth,
		protected template $template,
		protected string $prefix,
		protected string $root_path,
		protected string $php_ext
	)
	{
	}

	/**
	 * Tells phpBB which events this class listens to.
	 *
	 * @return array<string, string>  The event names, each with the method that handles it.
	 */
	public static function getSubscribedEvents(): array
	{
		return [
			'core.user_setup'  => 'load_language',
			'core.page_header' => 'add_forums',
		];
	}

	/**
	 * Adds the language file of this extension to the ones phpBB loads.
	 *
	 * @param \phpbb\event\data $event  The core.user_setup event
	 *
	 * @return void
	 */
	public function load_language($event): void
	{
		$lang_set_ext = $event['lang_set_ext'];
		$lang_set_ext[] = ['ext_name' => 'baneforum/forummenu', 'lang_set' => 'common'];
		$event['lang_set_ext'] = $lang_set_ext;
	}

	/**
	 * Gives the template one block row for each forum the visitor may list, with the depth of the forum.
	 * Nothing is added when the visitor may list no forum.
	 *
	 * @return void
	 */
	public function add_forums(): void
	{
		$visible = array_map('intval', array_keys($this->auth->acl_getf('f_list', true)));

		if (!$visible)
		{
			return;
		}

		// Categories (0) and forums (1), not the links to other sites, in the order of the forum list.
		$sql = 'SELECT forum_id, parent_id, forum_name, forum_type
			FROM ' . $this->prefix . 'forums
			WHERE forum_type IN (0, 1)
				AND ' . $this->db->sql_in_set('forum_id', $visible) . '
			ORDER BY left_id';
		$result = $this->db->sql_query($sql);
		$forums = [];

		while ($row = $this->db->sql_fetchrow($result))
		{
			$forums[(int) $row['forum_id']] = $row;
		}

		$this->db->sql_freeresult($result);

		foreach ($forums as $id => $forum)
		{
			// How deep the forum sits: the parents that are shown above it.
			$depth = 0;

			for ($parent = (int) $forum['parent_id']; isset($forums[$parent]); $parent = (int) $forums[$parent]['parent_id'])
			{
				$depth++;
			}

			$this->template->assign_block_vars('bf_forummenu', [
				'NAME'    => $forum['forum_name'],
				'DEPTH'   => $depth,
				'S_CAT'   => (int) $forum['forum_type'] === 0,
				'U_FORUM' => append_sid($this->root_path . 'viewforum.' . $this->php_ext, ['f' => $id]),
			]);
		}
	}
}
