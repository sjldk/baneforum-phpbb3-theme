<?php
/**
 * Baneforum likes
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\likes\migrations;

use baneforum\likes\voter_key;

/**
 * Turns a vote table that holds hashed voters back into a log of who voted and when (member and time), as the first version had it.
 * A board that never had the hashed version already has the right table from m1_initial, and this migration does nothing there.
 *
 * The hashed values are turned back by trying the members one after the other with the key file store/baneforum_votes.key. The time of an
 * old vote was never stored, so it is 0. A vote whose member cannot be found (a member who was deleted) is dropped. When there are old votes
 * and the key file is missing, the migration stops with an error and changes nothing, so no vote is lost.
 */
class m2_log_voters extends \phpbb\db\migration\migration
{
	/**
	 * Runs after the table has been made.
	 *
	 * @return string[]  The migrations that must run first.
	 */
	public static function depends_on(): array
	{
		return ['\baneforum\likes\migrations\m1_initial'];
	}

	/**
	 * Skips the migration when the table already logs the member and has no hashed voter column.
	 *
	 * @return bool  True when there is nothing to convert.
	 */
	public function effectively_installed(): bool
	{
		$table = $this->table_prefix . 'baneforum_votes';

		return $this->db_tools->sql_column_exists($table, 'user_id') && !$this->db_tools->sql_column_exists($table, 'voter');
	}

	/**
	 * Runs the conversion.
	 *
	 * @return array<int, array<int, mixed>>  The data steps for phpBB.
	 */
	public function update_data(): array
	{
		return [
			['custom', [[$this, 'log_voters']]],
		];
	}

	/**
	 * Converts the table. Every step checks first, so a run that was stopped can be started again.
	 *
	 * @return void
	 * @throws \RuntimeException  When the board does not use MySQL or MariaDB, or old votes exist and the key file is missing.
	 */
	public function log_voters(): void
	{
		$table = $this->table_prefix . 'baneforum_votes';

		if (!$this->db_tools->sql_column_exists($table, 'voter'))
		{
			return;
		}

		if (strpos($this->db->get_sql_layer(), 'mysql') !== 0)
		{
			throw new \RuntimeException('The Baneforum likes migration m2_log_voters needs MySQL or MariaDB.');
		}

		$result = $this->db->sql_query("SELECT COUNT(*) AS total FROM $table");
		$old_votes = (int) $this->db->sql_fetchfield('total');
		$this->db->sql_freeresult($result);
		$key_file = $this->phpbb_root_path . 'store/baneforum_votes.key';

		if ($old_votes > 0 && !is_file($key_file))
		{
			throw new \RuntimeException('The votes are stored as hashes, and the key file ' . $key_file . ' is missing. Put it back, and run the migration again.');
		}

		if (!$this->db_tools->sql_column_exists($table, 'user_id'))
		{
			$this->db_tools->sql_column_add($table, 'user_id', ['UINT', 0]);
		}

		if (!$this->db_tools->sql_column_exists($table, 'vote_time'))
		{
			$this->db_tools->sql_column_add($table, 'vote_time', ['TIMESTAMP', 0]);
		}

		if ($old_votes > 0)
		{
			$this->find_members($table, new voter_key($key_file));
			// A vote whose member is gone cannot be told apart from the others, and it would break the new key (post and member).
			$this->db->sql_query("DELETE FROM $table WHERE user_id = 0");
		}

		$this->db->sql_query("ALTER TABLE $table DROP PRIMARY KEY");
		$this->db_tools->sql_column_remove($table, 'voter');
		$this->db_tools->sql_create_primary_key($table, ['post_id', 'user_id']);
		$this->db_tools->sql_create_index($table, 'user_id', ['user_id']);
	}

	/**
	 * Writes the member into every row that still has none.
	 *
	 * @param string    $table  The vote table.
	 * @param voter_key $key    Turns a stored value back into a member.
	 *
	 * @return void
	 */
	protected function find_members(string $table, voter_key $key): void
	{
		$result = $this->db->sql_query('SELECT user_id FROM ' . $this->table_prefix . 'users WHERE user_type IN (0, 3)');
		$members = array_map('intval', array_column($this->db->sql_fetchrowset($result), 'user_id'));
		$this->db->sql_freeresult($result);

		$result = $this->db->sql_query("SELECT post_id, voter FROM $table WHERE user_id = 0");
		$rows = $this->db->sql_fetchrowset($result);
		$this->db->sql_freeresult($result);

		foreach ($rows as $row)
		{
			$member = $key->find_member($row['voter'], (int) $row['post_id'], $members);

			if ($member > 0)
			{
				$this->db->sql_query("UPDATE $table SET user_id = $member WHERE post_id = " . (int) $row['post_id'] . " AND voter = '" . $this->db->sql_escape($row['voter']) . "'");
			}
		}
	}
}
