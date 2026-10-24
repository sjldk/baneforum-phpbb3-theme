<?php
/**
 * Baneforum likes
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\likes\migrations;

/**
 * Makes the vote table and the permission to vote, and gives it to the standard and full user roles.
 */
class m1_initial extends \phpbb\db\migration\migration
{
	/**
	 * Runs after the phpBB 3.3.0 migration.
	 *
	 * @return string[]  The migrations that must run first.
	 */
	public static function depends_on(): array
	{
		return ['\phpbb\db\migration\data\v330\v330'];
	}

	/**
	 * Skips the migration when the table is already there.
	 *
	 * @return bool  True when the vote table exists.
	 */
	public function effectively_installed(): bool
	{
		return $this->db_tools->sql_table_exists($this->table_prefix . 'baneforum_votes');
	}

	/**
	 * The vote table. One row per voter key and post.
	 *
	 * @return array<string, mixed>  The schema change for phpBB.
	 */
	public function update_schema(): array
	{
		return [
			'add_tables' => [
				$this->table_prefix . 'baneforum_votes' => [
					'COLUMNS' => [
						'post_id'    => ['UINT', 0],
						'voter'      => ['VCHAR:64', ''],
						'vote_value' => ['TINT:4', 0],
					],
					'PRIMARY_KEY' => ['post_id', 'voter'],
				],
			],
		];
	}

	/**
	 * Drops the vote table.
	 *
	 * @return array<string, mixed>  The schema change for phpBB.
	 */
	public function revert_schema(): array
	{
		return [
			'drop_tables' => [$this->table_prefix . 'baneforum_votes'],
		];
	}

	/**
	 * Adds the vote permission and gives it to the standard and full user roles.
	 *
	 * @return array<int, array<int, mixed>>  The data changes for phpBB.
	 */
	public function update_data(): array
	{
		return [
			['permission.add', ['u_baneforum_vote']],
			['permission.permission_set', ['ROLE_USER_STANDARD', 'u_baneforum_vote']],
			['permission.permission_set', ['ROLE_USER_FULL', 'u_baneforum_vote']],
		];
	}
}
