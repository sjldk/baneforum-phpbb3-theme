<?php
/**
 * Baneforum likes
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\likes\event;

use baneforum\likes\votes;
use phpbb\auth\auth;
use phpbb\controller\helper;
use phpbb\user;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Gives every post on a topic page its counts, the member's own vote and the address to send a vote to.
 */
class listener implements EventSubscriberInterface
{
	/**
	 * The counts and the own vote of the posts on this page, by post id.
	 *
	 * @var array<int, array{up: int, down: int, mine: int}>
	 */
	protected array $page = [];

	/**
	 * Keeps the services that the page needs.
	 *
	 * @param votes  $votes   The vote store.
	 * @param auth   $auth    Tells what the member may do.
	 * @param user   $user    The member who views the page.
	 * @param helper $helper  Makes the address of the vote route.
	 */
	public function __construct(
		protected votes $votes,
		protected auth $auth,
		protected user $user,
		protected helper $helper
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
			'core.user_setup'                => 'load_language',
			'core.permissions'               => 'add_permission',
			'core.viewtopic_get_post_data'   => 'load_page',
			'core.viewtopic_modify_post_row' => 'add_to_post',
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
		$lang_set_ext[] = ['ext_name' => 'baneforum/likes', 'lang_set' => 'common'];
		$event['lang_set_ext'] = $lang_set_ext;
	}

	/**
	 * Lists the vote permission so the admin can set it in the permission screens.
	 *
	 * @param \phpbb\event\data $event  The core.permissions event.
	 *
	 * @return void
	 */
	public function add_permission($event): void
	{
		$permissions = $event['permissions'];
		$permissions['u_baneforum_vote'] = ['lang' => 'ACL_U_BANEFORUM_VOTE', 'cat' => 'misc'];
		$event['permissions'] = $permissions;
	}

	/**
	 * One query for the whole page, before the posts are drawn.
	 *
	 * @param \phpbb\event\data $event  The core.viewtopic_get_post_data event.
	 *
	 * @return void
	 */
	public function load_page($event): void
	{
		$this->page = $this->votes->for_posts(array_map('intval', $event['post_list']), (int) $this->user->data['user_id']);
	}

	/**
	 * Gives one post its counts, the member's own vote and, when the member may vote, the address and hash.
	 * A member may not vote on an own post, and a guest may not vote at all.
	 *
	 * @param \phpbb\event\data $event  The core.viewtopic_modify_post_row event.
	 *
	 * @return void
	 */
	public function add_to_post($event): void
	{
		$post_row = $event['post_row'];
		$id = (int) $event['row']['post_id'];
		$counts = $this->page[$id] ?? ['up' => 0, 'down' => 0, 'mine' => 0];
		$member = (int) $this->user->data['user_id'];

		$can = $member > 1
			&& $this->auth->acl_get('u_baneforum_vote')
			&& $member !== (int) $event['poster_id'];

		$post_row['BF_VOTE_UP'] = $counts['up'];
		$post_row['BF_VOTE_DOWN'] = $counts['down'];
		$post_row['BF_VOTE_MINE'] = $counts['mine'];
		$post_row['S_BF_VOTE_CAN'] = $can;
		$post_row['S_BF_VOTE_LOW'] = $counts['down'] > votes::HIDE_ABOVE;
		$post_row['BF_VOTE_HIDE_ABOVE'] = votes::HIDE_ABOVE;
		$post_row['S_BF_VOTE_GUEST'] = $member <= 1;
		$post_row['S_BF_VOTE_OWN'] = $member > 1 && $member === (int) $event['poster_id'];

		if ($can)
		{
			$post_row['U_BF_VOTE'] = $this->helper->route('baneforum_likes_vote', ['post_id' => $id]);
			$post_row['BF_VOTE_HASH'] = generate_link_hash('baneforum_vote_' . $id);
		}

		$event['post_row'] = $post_row;
	}
}
