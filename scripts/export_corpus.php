<?php
/**
 * Corpus export
 *
 * Exports the original text (what a user would see in the editor) of every post and private message of a board.
 * It reads the board's own database, with the settings in the board's config.php. Nothing is written to the database.
 *
 * On a server, from the folder that holds the board (the folder with config.php and ext/), as the web user or any user that can read
 * config.php:
 *
 *   PHPBB_ROOT=/path/to/phpbb php export_corpus.php > posts.jsonl
 *
 * On the local test setup it reads the untouched production import "phpbb_prod" through the web container:
 *
 *   docker compose -f docker/docker-compose.yml exec --user www-data -T -e BF_EXPORT_DB=phpbb_prod web php < scripts/export_corpus.php \
 *       > local-data/corpus/posts.jsonl
 *
 * PHPBB_ROOT is the folder of the board (default /var/www/html). BF_EXPORT_DB reads another database than the one in config.php, with the same
 * user and password.
 *
 * The field "markdown" tells whether the stored XML holds Markdown (see extensions/baneforum/editor).
 * It decides how the editor reads the text.
 *
 * The output holds real user content. It stays in local-data/ (git-ignored).
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

// phpBB's vendored libraries print deprecation notices on PHP 8.5. Keep the output clean.
error_reporting(E_ALL & ~E_DEPRECATED);
ini_set('display_errors', '0');

$phpbb_root_path = rtrim(getenv('PHPBB_ROOT') ?: '/var/www/html', '/') . '/';

require $phpbb_root_path . 'vendor/autoload.php';
require $phpbb_root_path . 'ext/baneforum/editor/markdown_detector.php';
// The database settings of the board itself: $dbhost, $dbport, $dbname, $dbuser, $dbpasswd and $table_prefix.
require $phpbb_root_path . 'config.php';

use baneforum\editor\markdown_detector;
use s9e\TextFormatter\Unparser;

$db = new mysqli($dbhost ?: 'localhost', $dbuser, $dbpasswd, getenv('BF_EXPORT_DB') ?: $dbname, (int) ($dbport ?: 3306));
$db->set_charset('utf8mb4');

$detector = new markdown_detector();
$sources = [
	['post', 'SELECT post_id AS id, post_text AS text, enable_bbcode, enable_smilies, enable_magic_url FROM ' . $table_prefix . 'posts'],
	['pm', 'SELECT msg_id AS id, message_text AS text, enable_bbcode, enable_smilies, enable_magic_url FROM ' . $table_prefix . 'privmsgs'],
];

foreach ($sources as [$kind, $sql])
{
	$result = $db->query($sql, MYSQLI_USE_RESULT);
	while ($row = $result->fetch_assoc())
	{
		$xml = $row['text'];
		$isXml = $xml !== '' && ($xml[0] === '<') && (str_starts_with($xml, '<r') || str_starts_with($xml, '<t'));
		echo json_encode([
			'kind' => $kind,
			'id' => (int) $row['id'],
			'xml' => $isXml,
			'markdown' => $isXml && $detector->contains_markdown($xml),
			'text' => $isXml ? Unparser::unparse($xml) : $xml,
		], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n";
	}
	$result->free();
}
