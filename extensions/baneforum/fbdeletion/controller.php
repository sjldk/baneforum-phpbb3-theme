<?php
/**
 * Baneforum Facebook data deletion
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\fbdeletion;

use phpbb\config\config;
use phpbb\controller\helper;
use phpbb\db\driver\driver_interface;
use phpbb\language\language;
use phpbb\log\log_interface;
use phpbb\request\request_interface;
use phpbb\user;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;

/**
 * The two addresses of the Facebook data deletion callback: app.php/fb-deletion (Facebook posts to it)
 * and app.php/fb-deletion/status/<Facebook id>/<code> (the member opens it from Facebook).
 */
class controller
{
	/**
	 * Keeps the services that the two addresses need.
	 *
	 * @param config           $config    Holds the secret of the Facebook app (set in the ACP for the Facebook login).
	 * @param driver_interface $db        Finds the account that is linked to a Facebook id.
	 * @param helper           $helper    Makes the address of the status page and shows it.
	 * @param language         $language  Loads the texts of the status page.
	 * @param log_interface    $log       Writes the deletion to the admin log.
	 * @param request_interface $request  Reads the POST field.
	 * @param user             $user      Gives the address of the sender for the log.
	 * @param string           $prefix    The prefix of the table names.
	 * @param string           $root      The phpBB folder, with a slash at the end.
	 * @param string           $php_ext   The ending of the PHP files.
	 */
	public function __construct(
		protected config $config,
		protected driver_interface $db,
		protected helper $helper,
		protected language $language,
		protected log_interface $log,
		protected request_interface $request,
		protected user $user,
		protected string $prefix,
		protected string $root,
		protected string $php_ext
	)
	{
	}

	/**
	 * Facebook tells that a member removed the app. Deletes the linked account and answers with the status address.
	 *
	 * @return Response  JSON with url and confirmation_code (what Facebook wants), or status 400 when the request is not from Facebook.
	 */
	public function callback(): Response
	{
		$secret = $this->secret();
		$payload = signed_request::parse($this->request->variable('signed_request', '', true, request_interface::POST), $secret);
		$facebook_id = (string) ($payload['user_id'] ?? '');

		if ($payload === null || !ctype_digit($facebook_id) || strlen($facebook_id) > 30)
		{
			return new JsonResponse(['error' => 'bad request'], 400);
		}

		$this->delete_account($facebook_id);
		$code = signed_request::code($facebook_id, $secret);

		// A guest gets a session id in the address. Facebook keeps the address, so it must not hold one.
		$url = preg_replace('/[?&]sid=[0-9a-f]+$/', '', $this->helper->route('baneforum_fbdeletion_status', ['facebook_id' => $facebook_id, 'code' => $code], false, false, UrlGeneratorInterface::ABSOLUTE_URL));

		return new JsonResponse(['url' => $url, 'confirmation_code' => $code]);
	}

	/**
	 * The page the member opens from Facebook. Tells if the data is gone.
	 *
	 * @param string $facebook_id  The Facebook id, from the address.
	 * @param string $code         The confirmation code, from the address.
	 *
	 * @return Response  The page, or status 404 when the code is not right.
	 */
	public function status(string $facebook_id, string $code): Response
	{
		$this->language->add_lang('common', 'baneforum/fbdeletion');

		// Without a secret the code would be a guess for anyone, so the page does not exist then.
		if ($this->secret() === '' || !hash_equals(signed_request::code($facebook_id, $this->secret()), $code))
		{
			return $this->helper->message('FBDELETION_NOT_FOUND', [], 'FBDELETION_TITLE', 404);
		}

		return $this->helper->message($this->user_id($facebook_id) === null ? 'FBDELETION_DONE' : 'FBDELETION_WAITING', [], 'FBDELETION_TITLE');
	}

	/**
	 * Deletes the account that Facebook login made, and keeps its posts as posts of a guest.
	 * A founder is never deleted by a callback. The status page then says the request waits.
	 *
	 * @param string $facebook_id  The Facebook id.
	 *
	 * @return void
	 */
	protected function delete_account(string $facebook_id): void
	{
		$user_id = $this->user_id($facebook_id);
		if ($user_id === null)
		{
			return;
		}

		$result = $this->db->sql_query('SELECT username, user_type FROM ' . $this->prefix . 'users WHERE user_id = ' . $user_id);
		$row = $this->db->sql_fetchrow($result);
		$this->db->sql_freeresult($result);

		if ($row === false || (int) $row['user_type'] === USER_FOUNDER)
		{
			return;
		}

		include_once $this->root . 'includes/functions_user.' . $this->php_ext;

		// 'retain' keeps the posts, 'false' removes the name from them, so they show as written by "Guest".
		user_delete('retain', $user_id, false);
		$this->log->add('admin', ANONYMOUS, $this->user->ip, 'LOG_USER_DELETED', false, [$row['username']]);
	}

	/**
	 * Finds the member that logged in with this Facebook id.
	 *
	 * @param string $facebook_id  The Facebook id.
	 *
	 * @return int|null  The user id, or null when no account is linked.
	 */
	protected function user_id(string $facebook_id): ?int
	{
		$sql = 'SELECT user_id FROM ' . $this->prefix . "oauth_accounts WHERE provider = 'facebook' AND oauth_provider_id = '" . $this->db->sql_escape($facebook_id) . "'";
		$result = $this->db->sql_query_limit($sql, 1);
		$user_id = $this->db->sql_fetchfield('user_id');
		$this->db->sql_freeresult($result);

		return $user_id === false ? null : (int) $user_id;
	}

	/**
	 * The secret of the Facebook app, as the administrator typed it for the Facebook login.
	 *
	 * @return string  The secret, or an empty text when none is set (then every request is refused).
	 */
	protected function secret(): string
	{
		return (string) ($this->config['auth_oauth_facebook_secret'] ?? '');
	}
}
