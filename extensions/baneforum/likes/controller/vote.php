<?php
/**
 * Baneforum likes
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\likes\controller;

use baneforum\likes\votes;
use phpbb\auth\auth;
use phpbb\db\driver\driver_interface;
use phpbb\language\language;
use phpbb\request\request_interface;
use phpbb\user;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Takes one click on a vote button. Answers with JSON for the script, or goes back to the post without it.
 */
class vote
{
	public function __construct(
		protected votes $votes,
		protected auth $auth,
		protected user $user,
		protected language $language,
		protected request_interface $request,
		protected driver_interface $db,
		protected string $root_path,
		protected string $php_ext
	) {
	}

	public function handle(int $post_id): Response
	{
		$value = $this->request->variable('value', '');
		$clicked = $value === 'up' ? votes::UP : ($value === 'down' ? votes::DOWN : 0);
		$member = (int) $this->user->data['user_id'];
		$error = $this->error($post_id, $member, $clicked);

		if ($error !== '')
		{
			return $this->answer(['error' => $this->language->lang($error)], $post_id, 403);
		}

		return $this->answer($this->votes->cast($post_id, $member, $clicked) + ['error' => ''], $post_id, 200);
	}

	/**
	 * The language key of the first reason to refuse, or an empty string.
	 */
	protected function error(int $post_id, int $member, int $clicked): string
	{
		if ($clicked === 0)
		{
			return 'BF_VOTE_ERROR_VALUE';
		}

		if ($member <= 1 || !$this->auth->acl_get('u_baneforum_vote'))
		{
			return 'BF_VOTE_ERROR_PERMISSION';
		}

		if (!check_link_hash($this->request->variable('hash', ''), 'baneforum_vote_' . $post_id))
		{
			return 'BF_VOTE_ERROR_HASH';
		}

		$sql = 'SELECT forum_id, poster_id, post_visibility FROM ' . POSTS_TABLE . ' WHERE post_id = ' . $post_id;
		$result = $this->db->sql_query($sql);
		$post = $this->db->sql_fetchrow($result);
		$this->db->sql_freeresult($result);

		if (!$post || (int) $post['post_visibility'] !== ITEM_APPROVED || !$this->auth->acl_get('f_read', (int) $post['forum_id']))
		{
			return 'BF_VOTE_ERROR_POST';
		}

		return (int) $post['poster_id'] === $member ? 'BF_VOTE_ERROR_OWN' : '';
	}

	protected function answer(array $data, int $post_id, int $status): Response
	{
		if ($this->request->is_ajax())
		{
			return new JsonResponse($data, $status);
		}

		return new RedirectResponse(append_sid("{$this->root_path}viewtopic.{$this->php_ext}", 'p=' . $post_id) . '#p' . $post_id);
	}
}
