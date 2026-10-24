<?php
/**
 * Markdown import (command line)
 *
 * One-off: converts stored Markdown posts and private messages to BBCode, as phpBB itself would save them. The work is done by
 * upload/bf-markdown-import/markdown_import.php. For a server without a command line, use upload/bf-markdown-import.php instead.
 *
 * Input (STDIN): JSON lines from packages/bf-editor/tools/convert-corpus.mjs ("kind", "id", "markdown", "original", "converted").
 * Run it where the board whose database is to be changed runs. On the production copy (docker-prod-1, database phpbb_try):
 *
 *   docker cp markdown-converter/cli/bf-markdown-import-cli.php docker-prod-1:/tmp/bf-markdown-import-cli.php
 *   docker exec -i --user 1000 docker-prod-1 php /tmp/bf-markdown-import-cli.php [mode] < converted.jsonl > report.json
 *
 * On a server, as the user that runs the board (it needs to read config.php, and write the cache):
 *
 *   PHPBB_ROOT=/path/to/phpbb php /path/to/bf-markdown-import-cli.php [mode] < converted.jsonl > report.json
 *
 * It loads markdown_detector.php and markdown_import.php from the folder bf-markdown-import/ in the board's folder, or else from
 * markdown-converter/upload/bf-markdown-import/ next to this script, or from the folder in the environment variable BF_MARKDOWN_LIB.
 *
 * Modes:
 *   (none)             a dry run: nothing is written. The report says what would happen.
 *   --apply            converts the rows that look the same to a reader. Copies the old text to a backup table first.
 *   --accept=post:12,pm:3   with --apply: also converts these rows although they look different. Use it for a row that you have read.
 *   --accept-all       with --apply: converts every row, also the ones that look different.
 *   --rollback         puts every converted row back from the backup table, except rows that were edited after the conversion.
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
// The folder of the board. On a server: PHPBB_ROOT=/path/to/phpbb php bf-markdown-import-cli.php ... (default is the Docker test boards).
$phpbb_root_path = rtrim(getenv('PHPBB_ROOT') ?: '/var/www/html', '/') . '/';
$phpEx = 'php';
require $phpbb_root_path . 'common.' . $phpEx;

$lib = getenv('BF_MARKDOWN_LIB') ?: (is_dir($phpbb_root_path . 'bf-markdown-import') ? $phpbb_root_path . 'bf-markdown-import' : __DIR__ . '/../upload/bf-markdown-import');
require $lib . '/markdown_detector.php';
require $lib . '/markdown_import.php';

use baneforum\editor\markdown_detector;
use baneforum\editor\markdown_import;

// The renderer and the parser read these from the current user. A script has none.
$user->data = array_merge($user->data ?? [], ['user_id' => 1, 'user_options' => 230271, 'style_id' => 1]);

$mode = 'report';
$accept = [];
$accept_all = false;
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
	else if ($argument === '--accept-all')
	{
		$accept_all = true;
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

/**
 * Ends the script: drops what phpBB printed and writes the report to STDOUT as JSON.
 *
 * @param array<string, mixed> $report The report to print
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

/**
 * The lines of STDIN as rows, one at a time.
 *
 * @return Generator<int, array<string, mixed>> The decoded JSON lines that are valid.
 */
function stdin_rows(): Generator
{
	while (($line = fgets(STDIN)) !== false)
	{
		$row = json_decode($line, true);
		if (is_array($row))
		{
			yield $row;
		}
	}
}

$import = new markdown_import($db, $table_prefix, new markdown_detector(), $phpbb_container->get('text_formatter.parser'), $phpbb_container->get('text_formatter.renderer'));

if ($mode === 'rollback')
{
	finish(['mode' => 'rollback'] + $import->rollback($only));
}

finish($import->process($mode, stdin_rows(), $accept, $accept_all));
