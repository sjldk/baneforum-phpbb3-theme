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
	/**
	 * Keeps the services that the vote needs.
	 *
	 * @param votes               $votes      The vote store.
	 * @param auth                $auth       Tells what the member may do.
	 * @param user                $user       The member who clicked.
	 * @param language            $language   Turns an error key into text.
	 * @param request_interface   $request    The request with the clicked value and the link hash.
	 * @param driver_interface    $db         Used to read the post before a vote is taken.
	 * @param string              $root_path  The phpBB root path, for the redirect.
	 * @param string              $php_ext    The php file extension, for the redirect.
	 */
	public function __construct(
		protected votes $votes,
		protected auth $auth,
		protected user $user,
		protected language $language,
		protected request_interface $request,
		protected driver_interface $db,
		protected string $root_path,
		protected string $php_ext
	)
	{
	}

	/**
	 * Checks the click, stores the vote and answers.
	 *
	 * @param int      $post_id  The post that was voted on.
	 *
	 * @return Response  JSON with the new counts, or the error text with status 403.
	 */
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
	 *
	 * @param int    $post_id  The post that was voted on.
	 * @param int    $member   The id of the member who clicked.
	 * @param int    $clicked  The button: votes::UP, votes::DOWN or 0 when the value was not valid.
	 *
	 * @return string  A language key, or an empty string when the vote is allowed.
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

	/**
	 * Sends the data as JSON to the script, or sends a browser without script back to the post.
	 *
	 * @param array<string, mixed> $data     The counts and the error text.
	 * @param int                  $post_id  The post to go back to.
	 * @param int                  $status   The HTTP status of the JSON answer.
	 *
	 * @return Response  A JSON answer for an ajax request, a redirect otherwise.
	 */
	protected function answer(array $data, int $post_id, int $status): Response
	{
		if ($this->request->is_ajax())
		{
			return new JsonResponse($data, $status);
		}

		return new RedirectResponse(append_sid("{$this->root_path}viewtopic.{$this->php_ext}", 'p=' . $post_id) . '#p' . $post_id);
	}
}
