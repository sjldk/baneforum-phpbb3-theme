<?php
/**
 * Baneforum likes
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\likes;

/**
 * Makes the value that stands for a member in the vote table, so the table never holds a user id.
 *
 * The value is a keyed hash of the member and the post. The key is a file outside the database, so a copy
 * of the database alone (a backup, a leaked dump, a database administrator) cannot say who voted, and the
 * values of one member on two posts cannot be matched.
 */
class voter_key
{
	protected ?string $secret = null;

	/** @param string $path The key file. It is made the first time it is needed. */
	public function __construct(protected string $path)
	{
	}

	public function voter(int $user_id, int $post_id): string
	{
		return hash_hmac('sha256', $user_id . ':' . $post_id, $this->secret());
	}

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
