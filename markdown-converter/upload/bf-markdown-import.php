<?php
/**
 * Markdown import (web page)
 *
 * A page for a server that has no command line: the founder of the board opens it in a browser, downloads the Markdown rows, uploads
 * them again after the conversion on a computer with Node, looks at a dry run, ticks the rows that look different but are fine, and converts.
 * The work is done by bf-markdown-import/markdown_import.php, the same code as cli/bf-markdown-import-cli.php.
 *
 * Install: upload the contents of the folder markdown-converter/upload/ to the folder of the board (the one with config.php), keeping the
 * folders: this page, and the folder bf-markdown-import/ with the two files it needs. Nothing needs to be enabled in the ACP. Open
 * https://YOUR-BOARD/bf-markdown-import.php while signed in as the founder. When you are done, delete both from the server.
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

error_reporting(E_ALL & ~E_DEPRECATED);
ini_set('display_errors', '0');

define('IN_PHPBB', true);
$phpbb_root_path = __DIR__ . '/';
$phpEx = 'php';
require $phpbb_root_path . 'common.' . $phpEx;

require $phpbb_root_path . 'bf-markdown-import/markdown_detector.php';
require $phpbb_root_path . 'bf-markdown-import/markdown_import.php';

use baneforum\editor\markdown_detector;
use baneforum\editor\markdown_import;

// A board in debug mode prints PHP warnings into the page, which would break the downloaded file. Only warnings and notices from PHP itself are
// muted here. Real errors, and phpBB's own messages, still go through phpBB.
set_error_handler(static fn (): bool => true, E_WARNING | E_NOTICE | E_DEPRECATED);

$user->session_begin();
$auth->acl($user->data);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

/**
 * Escapes text for HTML.
 *
 * @param mixed $text The text.
 *
 * @return string The escaped text.
 */
function h($text): string
{
	return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
}

/**
 * Writes the top of the page and the rest of it up to the content.
 *
 * @param string $title The title of the page.
 *
 * @return void
 */
function page_start(string $title): void
{
	echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
		. '<meta name="robots" content="noindex"><title>' . h($title) . '</title><style>'
		. ':root{--bg:#f4f5f7;--card:#fff;--text:#1b2733;--muted:#4a5a6a;--line:#cfd6dd;--accent:#1d4f91;--on-accent:#fff;--ok:#1b6b3a;--warn:#8a4b00;--bad:#a12622;--tint:#eef2f7}'
		. '@media (prefers-color-scheme:dark){:root{--bg:#141a21;--card:#1d252e;--text:#e6ebf0;--muted:#a9b6c3;--line:#3a4653;--accent:#8db6ee;--on-accent:#0c1a2b;--ok:#6fd195;--warn:#f0b35c;--bad:#ff8f89;--tint:#232d38}}'
		. '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:1rem/1.5 system-ui,sans-serif}'
		. 'main{max-width:62rem;margin:0 auto;padding:1rem}h1{font-size:1.6rem;margin:.5rem 0}h2{font-size:1.2rem;margin:0 0 .5rem}'
		. '.card{background:var(--card);border:.15rem solid var(--line);border-radius:.5rem;padding:1rem;margin:1rem 0}'
		. '.step{display:inline-grid;place-items:center;inline-size:1.8rem;block-size:1.8rem;border-radius:50%;background:var(--accent);color:var(--on-accent);margin-inline-end:.5rem;font-weight:700}'
		. '.notice{border-inline-start:.4rem solid var(--warn);background:var(--tint);padding:.5rem .75rem;border-radius:.25rem}.ok{color:var(--ok)}.bad{color:var(--bad)}.muted{color:var(--muted)}'
		. 'button,input[type=file]{font:inherit}button{min-block-size:2.75rem;padding:0 1.25rem;border:.15rem solid var(--accent);border-radius:.5rem;background:var(--accent);color:var(--on-accent);cursor:pointer}'
		. 'button.plain{background:transparent;color:var(--accent)}button.danger{border-color:var(--bad);background:var(--bad);color:var(--card)}button:disabled{opacity:.5;cursor:default}'
		. 'button:focus-visible,input:focus-visible,a:focus-visible{outline:.2rem solid var(--accent);outline-offset:.15rem}'
		. 'table{border-collapse:collapse;inline-size:100%}th,td{border:1px solid var(--line);padding:.35rem .5rem;text-align:start;vertical-align:top;overflow-wrap:anywhere}th{background:var(--tint)}'
		. 'td.narrow,th.narrow{inline-size:1%;white-space:nowrap}table.diff td:nth-child(n+3){inline-size:45%}'
		. 'code,pre{font:.9rem ui-monospace,monospace;background:var(--tint);border-radius:.25rem}pre{padding:.5rem;overflow-x:auto}code{padding:0 .25rem}a{color:var(--accent)}'
		. '.row{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;margin:.5rem 0}.scroll{overflow-x:auto}'
		. '</style></head><body><main>';
}

/**
 * Writes the end of the page.
 *
 * @return void
 */
function page_end(): void
{
	echo '</main></body></html>';
}

/**
 * The start of a form that posts to this page, with the token.
 *
 * @param string $action The name of the action.
 * @param string $token The token of this session.
 * @param bool $upload True when the form sends a file.
 *
 * @return string The HTML.
 */
function form_start(string $action, string $token, bool $upload = false): string
{
	return '<form method="post" action="' . h(basename(__FILE__)) . '"' . ($upload ? ' enctype="multipart/form-data"' : '') . '>'
		. '<input type="hidden" name="action" value="' . h($action) . '"><input type="hidden" name="token" value="' . h($token) . '">';
}

/**
 * The rows of the uploaded converter file, one at a time.
 *
 * @param string $path The file.
 *
 * @return Generator<int, array<string, mixed>> The decoded JSON lines that are valid.
 */
function file_rows(string $path): Generator
{
	$handle = fopen($path, 'rb');
	while ($handle && ($line = fgets($handle)) !== false)
	{
		$row = json_decode($line, true);
		if (is_array($row))
		{
			yield $row;
		}
	}
	if ($handle)
	{
		fclose($handle);
	}
}

/**
 * Counts the Markdown rows in the uploaded file.
 *
 * @param string $path The file.
 *
 * @return int The number of rows.
 */
function count_rows(string $path): int
{
	$total = 0;
	foreach (file_rows($path) as $row)
	{
		$total += (!empty($row['markdown']) && isset($row['converted'], $row['original'], $row['kind'], $row['id'])) ? 1 : 0;
	}

	return $total;
}

/**
 * Makes the objects that do the work. The parser and the renderer read the current user, so the user is the default one for a moment.
 *
 * @param \phpbb\user $user The current user.
 * @param \phpbb\db\driver\driver_interface $db The database.
 * @param string $table_prefix The table prefix.
 * @param \Symfony\Component\DependencyInjection\ContainerInterface $container The service container.
 *
 * @return markdown_import The job.
 */
function make_import($user, $db, string $table_prefix, $container): markdown_import
{
	// The parser and the renderer read these from the user, and the Markdown extension reads user_allow_markdown. The founder's own
	// preferences must not change what a post looks like in the comparison, so this is the default user, as in the command line script.
	$user->data = array_merge($user->data, ['user_id' => 1, 'user_options' => 230271, 'style_id' => 1, 'user_allow_markdown' => 1]);
	// $user->setup() fills this on a normal page. The renderer reads the style id from it.
	$user->style = ['style_id' => 1] + (is_array($user->style ?? null) ? $user->style : []);

	return new markdown_import($db, $table_prefix, new markdown_detector(), $container->get('text_formatter.parser'), $container->get('text_formatter.renderer'));
}

// ------------------------------------------------------------------------------------------------ who may use the page

if (($user->data['user_type'] ?? 0) != USER_FOUNDER)
{
	page_start('Markdown import');
	echo '<h1>Markdown import</h1><div class="card"><p>Only the founder of the board can use this page.</p>'
		. '<p><a href="ucp.php?mode=login&amp;redirect=' . h(rawurlencode(basename(__FILE__))) . '">Sign in</a></p></div>';
	page_end();
	exit;
}

$secret = (string) $config['rand_seed'];
$token = hash_hmac('sha256', $user->session_id . '|' . $user->data['user_id'], $secret);
$store = $phpbb_root_path . 'cache/bf_markdown_import_' . substr(hash_hmac('sha256', 'file|' . $user->data['user_id'], $secret), 0, 24) . '.jsonl';
$board = (string) $config['sitename'];
$founder = (string) $user->data['username'];
$settings = [];
foreach (['allow_markdown' => 'Allow Markdown (global)', 'allow_post_markdown' => 'Allow Markdown in posts', 'allow_pm_markdown' => 'Allow Markdown in private messages', 'allow_sig_markdown' => 'Allow Markdown in signatures'] as $key => $label)
{
	$settings[$label] = !empty($config[$key]);
}
$editor_on = $phpbb_container->get('ext.manager')->is_enabled('baneforum/editor');

$action = '';
$notice = '';
$report = null;
$accepted_ids = [];
$restored = null;

if ($request->is_set_post('action'))
{
	$action = (string) $request->variable('action', '');
	if (!hash_equals($token, (string) $request->variable('token', '')))
	{
		$notice = 'The page was open too long, or the request did not come from this page. Nothing was changed. Try again.';
		$action = '';
	}
}

// ------------------------------------------------------------------------------------------------ actions

if ($action === 'export')
{
	set_time_limit(0);
	$import = make_import($user, $db, $table_prefix, $phpbb_container);
	while (ob_get_level() > 0)
	{
		ob_end_clean();
	}
	header('Content-Type: application/x-ndjson; charset=utf-8');
	header('Content-Disposition: attachment; filename="markdown-rows.jsonl"');
	foreach ($import->export_rows() as $row)
	{
		echo json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n";
	}
	exit;
}

if ($action === 'upload')
{
	// phpBB closes $_FILES, so the file comes through its request class.
	$file = $request->file('file');
	if (empty($file['tmp_name']) || (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name']))
	{
		$notice = 'The file was not uploaded (PHP upload error ' . (int) ($file['error'] ?? -1) . ', the file arrived: ' . (empty($file['tmp_name']) ? 'no' : (is_uploaded_file($file['tmp_name']) ? 'yes' : 'not as an upload')) . '). '
			. 'Check the size limit of the server (upload_max_filesize, post_max_size), and try again.';
	}
	else if (!move_uploaded_file($file['tmp_name'], $store))
	{
		$notice = 'The file could not be saved in the cache folder of the board. Check that the web server can write to it.';
	}
	else if (count_rows($store) === 0)
	{
		@unlink($store);
		$notice = 'The file holds no converted Markdown rows. Is it the output of the converter (converted.jsonl)?';
	}
	else
	{
		$notice = 'The file was uploaded.';
	}
}

if ($action === 'delete_file')
{
	@unlink($store);
	$notice = 'The uploaded file was deleted.';
}

if (($action === 'report' || $action === 'apply') && !is_file($store))
{
	$notice = 'Upload the converted file first.';
	$action = '';
}

if ($action === 'report' || $action === 'apply')
{
	set_time_limit(0);
	ignore_user_abort(true);
	$accepted_ids = array_values(array_filter((array) $request->variable('accept', [''])));
	$accept_all = (bool) $request->variable('accept_all', 0);
	if ($action === 'apply' && !$request->variable('backup_ok', 0))
	{
		$notice = 'Tick the box that says you have taken a database backup.';
		$action = 'report';
	}
	$import = make_import($user, $db, $table_prefix, $phpbb_container);
	$report = $import->process($action === 'apply' ? 'apply' : 'report', file_rows($store), $accepted_ids, $accept_all);
	if ($action === 'apply')
	{
		$phpbb_container->get('cache')->purge();
		$notice = 'The rows were converted and the cache of the board was purged.';
	}
}

if ($action === 'rollback')
{
	$only = array_values(array_filter(array_map('trim', explode(',', (string) $request->variable('only', '')))));
	$import = make_import($user, $db, $table_prefix, $phpbb_container);
	$restored = $import->rollback($only);
	$phpbb_container->get('cache')->purge();
	$notice = 'Rows put back: ' . $restored['restored'] . '. '
		. ($restored['skipped_edited'] > 0 ? 'Rows left as they are because a member edited them after the conversion: ' . $restored['skipped_edited'] . '. ' : '')
		. 'The cache of the board was purged.';
}

// ------------------------------------------------------------------------------------------------ the page

$import = make_import($user, $db, $table_prefix, $phpbb_container);
$converted = $import->backup_count();
$uploaded = is_file($store) ? count_rows($store) : 0;

page_start('Markdown import - ' . $board);
echo '<h1>Convert Markdown posts to BBCode</h1><p class="muted">' . h($board) . ' &middot; signed in as ' . h($founder) . '</p>';
echo '<div class="notice"><strong>This page changes posts in the board\'s database.</strong> Take a database backup before step 5. '
	. 'When you are done, delete <code>' . h(basename(__FILE__)) . '</code> and the folder <code>bf-markdown-import/</code> from the server.</div>';

if ($notice !== '')
{
	echo '<div class="card" role="status"><strong>' . h($notice) . '</strong></div>';
}

// Step 1
echo '<section class="card"><h2><span class="step">1</span>Check the board</h2><table><tbody>';
foreach ($settings as $label => $on)
{
	echo '<tr><th scope="row">' . h($label) . '</th><td>' . ($on ? 'Yes' : 'No') . '</td></tr>';
}
echo '<tr><th scope="row">Editor extension (needed for tables)</th><td>' . ($editor_on ? '<span class="ok">Enabled</span>' : '<span class="bad">Not enabled</span>') . '</td></tr>';
echo '<tr><th scope="row">Rows converted so far</th><td>' . (int) $converted . '</td></tr></tbody></table>';
echo '<p class="muted">Keep "Allow Markdown (global)" on, so old posts still show correctly. Set "in posts" and "in private messages" to No in the ACP (General, Board configuration) '
	. 'so no new Markdown posts appear while you work. Posts with tables stay as Markdown until the editor extension is enabled.</p></section>';

// Step 2
echo '<section class="card"><h2><span class="step">2</span>Download the Markdown rows</h2>';
echo '<p>This finds every post and private message that holds Markdown and gives you a file with their original text. It writes nothing. It can take a few seconds.</p>';
echo form_start('export', $token) . '<button type="submit">Download markdown-rows.jsonl</button></form>';

// Step 3
echo '<h2 style="margin-top:1.5rem"><span class="step">3</span>Convert the file on your computer</h2>';
echo '<p>The converter needs Node, so it runs on your computer, in the project folder. The file holds real posts and private messages, so keep it private.</p>';
echo '<pre>docker run --rm --user 1000:1000 -e HOME=/tmp -v "$PWD:/repo" -v "$HOME/corpus:/corpus" -w /repo/packages/bf-editor \\
    node:22-slim node tools/convert-corpus.mjs /corpus/markdown-rows.jsonl /corpus/converted.jsonl</pre>';
echo '<p class="muted">Put <code>markdown-rows.jsonl</code> in <code>~/corpus</code> first. The result is <code>converted.jsonl</code>.</p></section>';

// Step 4
echo '<section class="card"><h2><span class="step">4</span>Upload the converted file</h2>';
if ($uploaded > 0)
{
	echo '<p class="ok"><strong>A file is uploaded: ' . (int) $uploaded . ' Markdown rows.</strong></p>';
	echo form_start('delete_file', $token) . '<button type="submit" class="plain">Delete the uploaded file</button></form>';
}
echo form_start('upload', $token, true) . '<div class="row"><label>converted.jsonl <input type="file" name="file" accept=".jsonl,.json,.txt" required></label>'
	. '<button type="submit">Upload</button></div></form></section>';

// Step 5
echo '<section class="card"><h2><span class="step">5</span>Dry run, then convert</h2>';
if ($uploaded === 0)
{
	echo '<p class="muted">Upload the converted file first.</p>';
}
else if ($report === null || $action === 'rollback')
{
	echo '<p>The dry run writes nothing. It shows which rows look the same to a reader after the conversion, and which look different.</p>';
	echo form_start('report', $token) . '<button type="submit">Run the dry run</button></form>';
}
else
{
	$c = $report['counts'];
	$different = $report['look_different_posts'];
	$different_pm = $report['look_different_private_messages'];
	if ($report['mode'] === 'apply')
	{
		echo '<p class="ok"><strong>Done: ' . (int) $c['converted'] . ' rows were converted.</strong> ' . (int) $c['accepted_different'] . ' of them looked different and were accepted. '
			. 'Open some converted posts on the board and check them. Run the dry run again: it should convert 0 rows.</p>';
	}
	echo '<div class="scroll"><table><tbody>'
		. '<tr><th scope="row">Markdown rows in the file</th><td>' . (int) $c['rows'] . '</td></tr>'
		. '<tr><th scope="row">' . ($report['mode'] === 'apply' ? 'Converted' : 'Convert without a decision (look the same)') . '</th><td>' . (int) ($report['mode'] === 'apply' ? $c['converted'] : $c['would_convert']) . '</td></tr>'
		. '<tr><th scope="row">Look different (read them below)</th><td>' . (int) $c['looks_different'] . '</td></tr>'
		. '<tr><th scope="row">Skipped: no longer Markdown</th><td>' . (int) $c['skipped_not_markdown'] . '</td></tr>'
		. '<tr><th scope="row">Skipped: edited since the export</th><td>' . (int) $c['skipped_edited_since_export'] . '</td></tr>'
		. '<tr><th scope="row">Skipped: not found</th><td>' . (int) $c['skipped_missing'] . '</td></tr></tbody></table></div>';

	echo form_start('apply', $token);
	if ($different || $different_pm)
	{
		echo '<h3>Rows that look different</h3><p>Open each post and decide. A tick means: convert it anyway.</p>';
		echo '<div class="row"><button type="button" class="plain" id="all">Tick all</button><button type="button" class="plain" id="none">Tick none</button></div>';
		echo '<p class="muted">Before is what readers see now, After is what they would see after the conversion. Only the place where the two start to differ is shown, '
			. 'with the spaces left out, because that is how they are compared.</p>';
		echo '<div class="scroll"><table class="diff"><thead><tr><th scope="col" class="narrow">Convert</th><th scope="col" class="narrow">Post</th><th scope="col">Before</th><th scope="col">After</th></tr></thead><tbody>';
		foreach ($different as $row)
		{
			$key = 'post:' . (int) $row['id'];
			echo '<tr><td class="narrow"><input type="checkbox" name="accept[]" value="' . h($key) . '"' . (in_array($key, $accepted_ids, true) ? ' checked' : '') . ' aria-label="Convert post ' . (int) $row['id'] . '"></td>'
				. '<td class="narrow"><a href="viewtopic.php?p=' . (int) $row['id'] . '#p' . (int) $row['id'] . '" target="_blank" rel="noopener">' . (int) $row['id'] . '</a></td>'
				. '<td>' . h($row['before']) . '</td><td>' . h($row['after']) . '</td></tr>';
		}
		foreach ($different_pm as $id)
		{
			$key = 'pm:' . (int) $id;
			echo '<tr><td class="narrow"><input type="checkbox" name="accept[]" value="' . h($key) . '"' . (in_array($key, $accepted_ids, true) ? ' checked' : '') . ' aria-label="Convert private message ' . (int) $id . '"></td>'
				. '<td class="narrow">PM ' . (int) $id . '</td><td colspan="2" class="muted">Private message: its text is not shown. Read it in the inbox of its owner, or leave it.</td></tr>';
		}
		echo '</tbody></table></div>';
		echo '<script>document.getElementById("all").onclick=function(){document.querySelectorAll("input[name=\'accept[]\']").forEach(function(b){b.checked=true})};'
			. 'document.getElementById("none").onclick=function(){document.querySelectorAll("input[name=\'accept[]\']").forEach(function(b){b.checked=false})};</script>';
		echo '<p><label><input type="checkbox" name="accept_all" value="1"> Convert every row, also those that look different and are not ticked</label></p>';
	}
	echo '<p><label><input type="checkbox" name="backup_ok" value="1" required> I have taken a database backup</label></p>';
	echo '<div class="row"><button type="submit" class="danger">Convert the rows now</button></div></form>';
	echo form_start('report', $token) . '<button type="submit" class="plain">Run the dry run again</button></form>';
}
echo '</section>';

// Step 6
echo '<section class="card"><h2><span class="step">6</span>Undo</h2><p>The old text of every converted row is saved in a backup table (' . (int) $converted . ' rows now). Put rows back here. '
	. 'A row that a member edited after the conversion is left alone, so the edit is not lost.</p>';
echo form_start('rollback', $token) . '<div class="row"><label>Only these rows (optional) <input type="text" name="only" placeholder="post:12,pm:3" size="30"></label>'
	. '<button type="submit" class="plain" onclick="return confirm(\'Put the rows back as they were?\')">Put back</button></div>'
	. '<p class="muted">Leave the field empty to put back every converted row.</p></form></section>';

page_end();
