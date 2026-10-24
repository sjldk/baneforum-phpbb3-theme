<?php
/**
 * Baneforum likes
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\likes;

/**
 * The keyed hash that the vote table held for a member between 2026-10-22 and the migration m2_log_voters. New votes no longer use it:
 * the table logs the member again. The migration uses this class once, to turn the old values back into members.
 *
 * The value is a keyed hash of the member and the post. The key is a file outside the database (store/baneforum_votes.key).
 */
class voter_key
{
	/**
	 * The key read from the file, kept so the file is read once per request.
	 *
	 * @var string|null
	 */
	protected ?string $secret = null;

	/**
	 * Remembers where the key file is. The file is not touched until a key is needed.
	 *
	 * @param string $path  The key file. It is made the first time it is needed.
	 */
	public function __construct(protected string $path)
	{
	}

	/**
	 * The value stored in the vote table for this member on this post.
	 *
	 * @param int $user_id  The member.
	 * @param int $post_id  The post.
	 *
	 * @return string  A hash of 64 hex characters.
	 */
	public function voter(int $user_id, int $post_id): string
	{
		return hash_hmac('sha256', $user_id . ':' . $post_id, $this->secret());
	}

	/**
	 * Finds the member behind a stored value, by trying the members one after the other.
	 *
	 * @param string $voter    The stored value.
	 * @param int    $post_id  The post the value was stored for.
	 * @param int[]  $user_ids The members to try.
	 *
	 * @return int  The member, or 0 when none of them gives this value (for example a member who has been deleted).
	 */
	public function find_member(string $voter, int $post_id, array $user_ids): int
	{
		foreach ($user_ids as $user_id)
		{
			if (hash_equals($voter, $this->voter((int) $user_id, $post_id)))
			{
				return (int) $user_id;
			}
		}

		return 0;
	}

	/**
	 * Reads the key file. It makes the file with a random key when it is not there.
	 * The file is made readable for the web user only.
	 *
	 * @return string  The key.
	 * @throws \RuntimeException  When the file cannot be made, or holds fewer than 32 characters.
	 */
	protected function secret(): string
	{
		if ($this->secret !== null)
		{
			return $this->secret;
		}

		if (!is_file($this->path))
		{
			$old = umask(0077);
			$written = @file_put_contents($this->path, bin2hex(random_bytes(32)), LOCK_EX);
			umask($old);

			if ($written === false && !is_file($this->path))
			{
				throw new \RuntimeException('The vote key file cannot be made: ' . $this->path);
			}
		}

		$secret = trim((string) file_get_contents($this->path));

		if (strlen($secret) < 32)
		{
			throw new \RuntimeException('The vote key file is empty or too short: ' . $this->path);
		}

		return $this->secret = $secret;
	}
}
