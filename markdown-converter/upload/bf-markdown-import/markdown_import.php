<?php
/**
 * Baneforum editor
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\editor;

use phpbb\db\driver\driver_interface;
use s9e\TextFormatter\Unparser;

/**
 * The one-off job that converts stored Markdown posts and private messages to BBCode, as phpBB itself would save them.
 *
 * It has no input and output of its own: cli/bf-markdown-import-cli.php (command line) and upload/bf-markdown-import.php (a page for the
 * founder) give it the rows and show its report. A row is only touched when (1) its stored text still holds Markdown, (2) it is still the
 * text that was exported (nobody has edited it since), and (3) rendering the new text gives the same words as rendering the stored text,
 * or the caller has accepted the row. The old text is copied to a backup table first, and the edit time and the edit count are not changed.
 */
class markdown_import
{
	/** The rows are read from the database this many at a time, to keep the memory use low on a big board. */
	private const CHUNK = 400;

	/**
	 * The backup table, with the board's table prefix.
	 *
	 * @var string
	 */
	private string $backup;

	/**
	 * The table and the columns of each kind of message.
	 *
	 * @var array<string, array{table: string, id: string, text: string, edited: string}>
	 */
	private array $tables;

	/**
	 * Gets the services of the board and switches the Markdown parser plugins off.
	 *
	 * @param driver_interface $db The database of the board.
	 * @param string $table_prefix The table prefix of the board, from config.php.
	 * @param markdown_detector $detector Tells whether a stored text holds Markdown.
	 * @param object $parser The board's text_formatter.parser service.
	 * @param object $renderer The board's text_formatter.renderer service.
	 */
	public function __construct(
		private driver_interface $db,
		string $table_prefix,
		private markdown_detector $detector,
		private object $parser,
		private object $renderer
	)
	{
		$this->backup = $table_prefix . 'bf_markdown_backup';
		$this->tables = [
			'post' => ['table' => $table_prefix . 'posts', 'id' => 'post_id', 'text' => 'post_text', 'edited' => 'post_edit_time'],
			'pm' => ['table' => $table_prefix . 'privmsgs', 'id' => 'msg_id', 'text' => 'message_text', 'edited' => 'message_edit_time'],
		];

		// The new text is BBCode. The Markdown plugins are off when it is saved, the way the board saves a post from our editor.
		foreach (['Litedown', 'PipeTables', 'TaskLists'] as $plugin)
		{
			$this->parser->get_parser()->disablePlugin($plugin);
		}
	}

	/**
	 * The posts and private messages whose stored text holds Markdown, with their original text, ready for the converter.
	 *
	 * @return \Generator<int, array{kind: string, id: int, xml: bool, markdown: bool, text: string}> One row at a time.
	 */
	public function export_rows(): \Generator
	{
		foreach ($this->tables as $kind => $t)
		{
			$last = 0;
			do
			{
				$result = $this->db->sql_query("SELECT {$t['id']} AS id, {$t['text']} AS stored FROM {$t['table']} WHERE {$t['id']} > " . $last
					. " ORDER BY {$t['id']} LIMIT " . self::CHUNK);
				$rows = $this->db->sql_fetchrowset($result);
				$this->db->sql_freeresult($result);

				foreach ($rows as $row)
				{
					$last = (int) $row['id'];
					$xml = $row['stored'];
					$is_xml = $xml !== '' && $xml[0] === '<' && (str_starts_with($xml, '<r') || str_starts_with($xml, '<t'));

					if ($is_xml && $this->detector->contains_markdown($xml))
					{
						yield ['kind' => $kind, 'id' => $last, 'xml' => true, 'markdown' => true, 'text' => Unparser::unparse($xml)];
					}
				}
			}
			while (count($rows) === self::CHUNK);
		}
	}

	/**
	 * Goes through the converted rows. In report mode nothing is written. In apply mode the rows that look the same, and the rows that
	 * were accepted, are converted.
	 *
	 * @param string $mode "report" or "apply".
	 * @param iterable $rows The lines of the converter, each an array with kind, id, markdown, original and converted.
	 * @param string[] $accept Rows to convert although they look different, as "post:12" or "pm:3".
	 * @param bool $accept_all True to convert every row, also the ones that look different.
	 *
	 * @return array{mode: string, counts: array<string, int>, look_different_posts: array<int, array<string, mixed>>, look_different_private_messages: int[]} The report.
	 */
	public function process(string $mode, iterable $rows, array $accept = [], bool $accept_all = false): array
	{
		if ($mode === 'apply')
		{
			$this->db->sql_query('CREATE TABLE IF NOT EXISTS ' . $this->backup . ' (kind VARCHAR(4) NOT NULL, msg_id INT UNSIGNED NOT NULL, old_text MEDIUMTEXT NOT NULL, '
				. 'old_uid VARCHAR(8) NOT NULL, old_bitfield VARCHAR(255) NOT NULL, saved_at INT UNSIGNED NOT NULL, PRIMARY KEY (kind, msg_id)) CHARACTER SET utf8mb4');
		}

		$counts = ['rows' => 0, 'converted' => 0, 'would_convert' => 0, 'skipped_not_markdown' => 0, 'skipped_edited_since_export' => 0,
			'skipped_missing' => 0, 'looks_different' => 0, 'accepted_different' => 0];
		$different = [];
		$different_pm = [];

		foreach ($rows as $row)
		{
			if (!$row || empty($row['markdown']) || !isset($this->tables[$row['kind']]))
			{
				continue;
			}
			$counts['rows']++;
			$t = $this->tables[$row['kind']];
			$key = $row['kind'] . ':' . (int) $row['id'];

			$result = $this->db->sql_query("SELECT {$t['text']} AS stored, bbcode_uid, bbcode_bitfield, enable_bbcode, enable_smilies, enable_magic_url FROM {$t['table']} WHERE {$t['id']} = " . (int) $row['id']);
			$stored = $this->db->sql_fetchrow($result);
			$this->db->sql_freeresult($result);

			if (!$stored)
			{
				$counts['skipped_missing']++;
				continue;
			}
			if (!$this->detector->contains_markdown($stored['stored']))
			{
				$counts['skipped_not_markdown']++;
				continue;
			}
			if (Unparser::unparse($stored['stored']) !== $row['original'])
			{
				$counts['skipped_edited_since_export']++;
				continue;
			}

			$text = $row['converted'];
			$uid = $bitfield = '';
			$flags = 0;
			generate_text_for_storage($text, $uid, $bitfield, $flags, (bool) $stored['enable_bbcode'], (bool) $stored['enable_magic_url'], (bool) $stored['enable_smilies']);

			$before = self::visible($this->renderer->render($stored['stored']));
			$after = self::visible($this->renderer->render($text));
			$same = $before === $after;

			if (!$same)
			{
				$counts['looks_different']++;
				$at = 0;
				$limit = min(mb_strlen($before), mb_strlen($after));
				while ($at < $limit && mb_substr($before, $at, 1) === mb_substr($after, $at, 1))
				{
					$at++;
				}
				if ($row['kind'] === 'post')
				{
					$different[] = ['id' => (int) $row['id'], 'before' => mb_substr($before, max(0, $at - 30), 90), 'after' => mb_substr($after, max(0, $at - 30), 90)];
				}
				else
				{
					$different_pm[] = (int) $row['id'];
				}
			}

			if ($same || $accept_all || in_array($key, $accept, true))
			{
				$counts['would_convert']++;
				$counts['accepted_different'] += $same ? 0 : 1;

				if ($mode === 'apply')
				{
					$this->db->sql_transaction('begin');
					$this->db->sql_query('INSERT IGNORE INTO ' . $this->backup . ' (kind, msg_id, old_text, old_uid, old_bitfield, saved_at) VALUES (\'' . $this->db->sql_escape($row['kind']) . '\', ' . (int) $row['id']
						. ", '" . $this->db->sql_escape($stored['stored']) . "', '" . $this->db->sql_escape($stored['bbcode_uid']) . "', '" . $this->db->sql_escape($stored['bbcode_bitfield']) . "', " . time() . ')');
					$this->db->sql_query("UPDATE {$t['table']} SET {$t['text']} = '" . $this->db->sql_escape($text) . "', bbcode_uid = '" . $this->db->sql_escape($uid) . "', bbcode_bitfield = '" . $this->db->sql_escape($bitfield)
						. "' WHERE {$t['id']} = " . (int) $row['id']);
					$this->db->sql_transaction('commit');
					$counts['converted']++;
				}
			}
		}

		return ['mode' => $mode, 'counts' => $counts, 'look_different_posts' => $different, 'look_different_private_messages' => $different_pm];
	}

	/**
	 * Puts converted rows back from the backup table, and takes them out of it. A row that a member has edited since it was converted is
	 * left as it is, so the edit is not lost. The conversion does not change the edit time, so any later edit has a newer edit time.
	 *
	 * @param string[] $only Only these rows, as "post:12" or "pm:3". Empty means every converted row.
	 *
	 * @return array{restored: int, skipped_edited: int} How many rows were put back, and how many were left because they were edited.
	 */
	public function rollback(array $only = []): array
	{
		if ($this->backup_count() === 0)
		{
			return ['restored' => 0, 'skipped_edited' => 0];
		}

		$restored = 0;
		$skipped = 0;
		$result = $this->db->sql_query('SELECT * FROM ' . $this->backup);
		$rows = $this->db->sql_fetchrowset($result);
		$this->db->sql_freeresult($result);
		foreach ($rows as $row)
		{
			if ($only && !in_array($row['kind'] . ':' . $row['msg_id'], $only, true))
			{
				continue;
			}
			$t = $this->tables[$row['kind']];
			$result = $this->db->sql_query("SELECT {$t['edited']} AS edited FROM {$t['table']} WHERE {$t['id']} = " . (int) $row['msg_id']);
			$current = $this->db->sql_fetchrow($result);
			$this->db->sql_freeresult($result);
			if ($current && (int) $current['edited'] > (int) $row['saved_at'])
			{
				$skipped++;
				continue;
			}
			$this->db->sql_query('UPDATE ' . $t['table'] . " SET {$t['text']} = '" . $this->db->sql_escape($row['old_text']) . "', bbcode_uid = '" . $this->db->sql_escape($row['old_uid'])
				. "', bbcode_bitfield = '" . $this->db->sql_escape($row['old_bitfield']) . "' WHERE {$t['id']} = " . (int) $row['msg_id']);
			$this->db->sql_query('DELETE FROM ' . $this->backup . " WHERE kind = '" . $this->db->sql_escape($row['kind']) . "' AND msg_id = " . (int) $row['msg_id']);
			$restored++;
		}

		return ['restored' => $restored, 'skipped_edited' => $skipped];
	}

	/**
	 * How many rows are in the backup table, which is the number of rows that were converted.
	 *
	 * @return int The number of rows, or 0 when the table does not exist yet.
	 */
	public function backup_count(): int
	{
		$result = $this->db->sql_query("SHOW TABLES LIKE '" . $this->db->sql_escape($this->backup) . "'");
		$exists = (bool) $this->db->sql_fetchrow($result);
		$this->db->sql_freeresult($result);

		if (!$exists)
		{
			return 0;
		}

		$result = $this->db->sql_query('SELECT COUNT(*) AS total FROM ' . $this->backup);
		$total = (int) $this->db->sql_fetchfield('total');
		$this->db->sql_freeresult($result);

		return $total;
	}

	/**
	 * Reduces rendered HTML to the words a reader sees.
	 * Smilies and emoji count as one mark, and spacing is not content.
	 *
	 * @param string $html The rendered HTML.
	 *
	 * @return string The visible text with no spacing.
	 */
	private static function visible(string $html): string
	{
		$html = preg_replace('/<img[^>]*class="[^"]*smilies[^"]*"[^>]*>/u', ' @S ', $html);
		$html = preg_replace('/<!--.*?-->/s', '', $html);
		$text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
		$text = preg_replace('/\x{200B}/u', '', $text);
		$text = preg_replace('/(?<![\w\/])(:-?[)(DPOo|?xX]|;-?\)|8-?\)|:[a-z]+:|:[!?]:)(?![\w])/u', '@S', $text);
		$text = preg_replace('/[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B50}\x{2B1B}\x{2B1C}\x{FE0F}]/u', '@S', $text);
		$text = preg_replace('/(@S\s*)+/u', '@S ', $text);

		return preg_replace('/\s+/u', '', $text);
	}
}
