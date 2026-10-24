<?php
/**
 * Markdown import
 *
 * One-off: converts stored Markdown posts and private messages to BBCode, as phpBB itself would save them.
 *
 * Input (STDIN): JSON lines from packages/bf-editor/tools/convert-corpus.mjs ("kind", "id", "markdown", "original", "converted").
 * Run it where the board whose database is to be changed runs. On the production copy (docker-prod-1, database phpbb_try):
 *
 *   docker cp scripts/markdown_import.php docker-prod-1:/tmp/markdown_import.php
 *   docker exec -i --user 1000 docker-prod-1 php /tmp/markdown_import.php [mode] < converted.jsonl > report.json
 *
 * On a server, as the user that runs the board (it needs to read config.php, and write the cache):
 *
 *   PHPBB_ROOT=/path/to/phpbb php /path/to/markdown_import.php [mode] < converted.jsonl > report.json
 *
 * Modes:
 *   (none)             a dry run: nothing is written. The report says what would happen.
 *   --apply            converts the rows that look the same to a reader. Copies the old text to a backup table first.
 *   --accept=post:12,pm:3   with --apply: also converts these rows although they look different. Use it for a row that you have read.
 *   --rollback         puts every converted row back from the backup table.
 *   --rollback --only=post:12,pm:3   puts back only these rows.
 *
 * A row is only touched when (1) its stored text still holds Markdown, (2) it is still the text that was exported (nobody has edited it
 * since), and (3) rendering the new text gives the same words as rendering the stored text. The edit time and the edit count are not changed,
 * so no post shows "edited". Private message texts never go into the report, only their ids.
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

error_reporting(E_ALL & ~E_DEPRECATED);
ini_set('display_errors', '0');
ob_start(); // phpBB prints warnings when it runs outside a web request. Only our report goes to STDOUT.

define('IN_PHPBB', true);
// The folder of the board. On a server: PHPBB_ROOT=/path/to/phpbb php markdown_import.php ... (default is the Docker test boards).
$phpbb_root_path = rtrim(getenv('PHPBB_ROOT') ?: '/var/www/html', '/') . '/';
$phpEx = 'php';
require $phpbb_root_path . 'common.' . $phpEx;
require $phpbb_root_path . 'ext/baneforum/editor/markdown_detector.php';

use baneforum\editor\markdown_detector;
use s9e\TextFormatter\Unparser;

// The renderer and the parser read these from the current user. A script has none.
$user->data = array_merge($user->data ?? [], ['user_id' => 1, 'user_options' => 230271, 'style_id' => 1]);

$mode = 'report';
$accept = [];
$only = [];
foreach (array_slice($argv, 1) as $argument)
{
	if ($argument === '--apply')
	{
		$mode = 'apply';
	}
	else if ($argument === '--rollback')
	{
		$mode = 'rollback';
	}
	else if (str_starts_with($argument, '--accept='))
	{
		$accept = array_filter(explode(',', substr($argument, 9)));
	}
	else if (str_starts_with($argument, '--only='))
	{
		$only = array_filter(explode(',', substr($argument, 7)));
	}
	else
	{
		fwrite(STDERR, "Unknown argument: $argument\n");
		exit(1);
	}
}

$backup = $table_prefix . 'bf_markdown_backup';
$tables = [
	'post' => ['table' => $table_prefix . 'posts', 'id' => 'post_id', 'text' => 'post_text'],
	'pm' => ['table' => $table_prefix . 'privmsgs', 'id' => 'msg_id', 'text' => 'message_text'],
];

/**
 * Ends the script: drops what phpBB printed and writes the report to STDOUT as JSON.
 *
 * @param array<string, mixed> $report  The report to print
 *
 * @return never
 */
function finish(array $report): never
{
	while (ob_get_level() > 0)
	{
		ob_end_clean();
	}
	fwrite(STDOUT, json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n");
	exit(0);
}

if ($mode === 'rollback')
{
	$restored = 0;
	$result = $db->sql_query('SELECT * FROM ' . $backup);
	$rows = $db->sql_fetchrowset($result);
	$db->sql_freeresult($result);
	foreach ($rows as $row)
	{
		if ($only && !in_array($row['kind'] . ':' . $row['msg_id'], $only, true))
		{
			continue;
		}
		$t = $tables[$row['kind']];
		$db->sql_query('UPDATE ' . $t['table'] . " SET {$t['text']} = '" . $db->sql_escape($row['old_text']) . "', bbcode_uid = '" . $db->sql_escape($row['old_uid'])
			. "', bbcode_bitfield = '" . $db->sql_escape($row['old_bitfield']) . "' WHERE {$t['id']} = " . (int) $row['msg_id']);
		$restored++;
	}
	finish(['mode' => 'rollback', 'restored' => $restored]);
}

/**
 * Reduces rendered HTML to the words a reader sees.
 * Smilies and emoji count as one mark, and spacing is not content.
 *
 * @param string $html  The rendered HTML
 *
 * @return string  The visible text with no spacing
 */
function visible(string $html): string
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

$parser = $phpbb_container->get('text_formatter.parser');
$renderer = $phpbb_container->get('text_formatter.renderer');
// The new text is BBCode. The Markdown plugins are off when it is saved, the way the board saves a post from our editor.
foreach (['Litedown', 'PipeTables', 'TaskLists'] as $plugin)
{
	$parser->get_parser()->disablePlugin($plugin);
}

if ($mode === 'apply')
{
	$db->sql_query('CREATE TABLE IF NOT EXISTS ' . $backup . ' (kind VARCHAR(4) NOT NULL, msg_id INT UNSIGNED NOT NULL, old_text MEDIUMTEXT NOT NULL, '
		. 'old_uid VARCHAR(8) NOT NULL, old_bitfield VARCHAR(255) NOT NULL, saved_at INT UNSIGNED NOT NULL, PRIMARY KEY (kind, msg_id)) CHARACTER SET utf8mb4');
}

$detector = new markdown_detector();
$counts = ['rows' => 0, 'converted' => 0, 'would_convert' => 0, 'skipped_not_markdown' => 0, 'skipped_edited_since_export' => 0, 'skipped_missing' => 0, 'looks_different' => 0, 'accepted_different' => 0];
$different = [];
$different_pm = [];

while (($line = fgets(STDIN)) !== false)
{
	$row = json_decode($line, true);
	if (!$row || empty($row['markdown']) || !isset($tables[$row['kind']]))
	{
		continue;
	}
	$counts['rows']++;
	$t = $tables[$row['kind']];
	$key = $row['kind'] . ':' . (int) $row['id'];

	$result = $db->sql_query("SELECT {$t['text']} AS stored, bbcode_uid, bbcode_bitfield, enable_bbcode, enable_smilies, enable_magic_url FROM {$t['table']} WHERE {$t['id']} = " . (int) $row['id']);
	$stored = $db->sql_fetchrow($result);
	$db->sql_freeresult($result);

	if (!$stored)
	{
		$counts['skipped_missing']++;
		continue;
	}
	if (!$detector->contains_markdown($stored['stored']))
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

	$before = visible($renderer->render($stored['stored']));
	$after = visible($renderer->render($text));
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

	if ($same || in_array($key, $accept, true))
	{
		$counts['would_convert']++;
		$counts['accepted_different'] += $same ? 0 : 1;

		if ($mode === 'apply')
		{
			$db->sql_transaction('begin');
			$db->sql_query('INSERT IGNORE INTO ' . $backup . ' (kind, msg_id, old_text, old_uid, old_bitfield, saved_at) VALUES (\'' . $db->sql_escape($row['kind']) . '\', ' . (int) $row['id']
				. ", '" . $db->sql_escape($stored['stored']) . "', '" . $db->sql_escape($stored['bbcode_uid']) . "', '" . $db->sql_escape($stored['bbcode_bitfield']) . "', " . time() . ')');
			$db->sql_query("UPDATE {$t['table']} SET {$t['text']} = '" . $db->sql_escape($text) . "', bbcode_uid = '" . $db->sql_escape($uid) . "', bbcode_bitfield = '" . $db->sql_escape($bitfield)
				. "' WHERE {$t['id']} = " . (int) $row['id']);
			$db->sql_transaction('commit');
			$counts['converted']++;
		}
	}
}

finish(['mode' => $mode, 'counts' => $counts, 'look_different_posts' => $different, 'look_different_private_messages' => $different_pm]);
