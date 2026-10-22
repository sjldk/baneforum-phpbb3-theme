<?php
/**
 * Baneforum likes
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\likes\migrations;

class m1_initial extends \phpbb\db\migration\migration
{
	public static function depends_on(): array
	{
		return ['\phpbb\db\migration\data\v330\v330'];
	}

	public function effectively_installed(): bool
	{
		return $this->db_tools->sql_table_exists($this->table_prefix . 'baneforum_votes');
	}

	public function update_schema(): array
	{
		return [
			'add_tables' => [
				$this->table_prefix . 'baneforum_votes' => [
					'COLUMNS' => [
						'post_id'    => ['UINT', 0],
						'user_id'    => ['UINT', 0],
						'vote_value' => ['TINT:4', 0],
						'vote_time'  => ['TIMESTAMP', 0],
					],
					'PRIMARY_KEY' => ['post_id', 'user_id'],
					'KEYS' => [
						'user_id' => ['INDEX', 'user_id'],
					],
				],
			],
		];
	}

	public function revert_schema(): array
	{
		return [
			'drop_tables' => [$this->table_prefix . 'baneforum_votes'],
		];
	}

	public function update_data(): array
	{
		return [
			['permission.add', ['u_baneforum_vote']],
			['permission.permission_set', ['ROLE_USER_STANDARD', 'u_baneforum_vote']],
			['permission.permission_set', ['ROLE_USER_FULL', 'u_baneforum_vote']],
		];
	}
}
