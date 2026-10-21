<?php
// Exports the original text (what a user would see in the editor) of every post and
// private message from the production backup that was imported into the database
// "phpbb_prod". Run inside the web container:
//
//   docker compose -f docker/docker-compose.yml exec --user www-data -T web php < scripts/export_corpus.php \
//       > local-data/corpus/posts.jsonl
//
// The output holds real user content. It stays in local-data/ (git-ignored).

// phpBB's vendored libraries print deprecation notices on PHP 8.5. Keep the output clean.
error_reporting(E_ALL & ~E_DEPRECATED);
ini_set('display_errors', '0');

require '/var/www/html/vendor/autoload.php';

use s9e\TextFormatter\Unparser;

$db = new mysqli('db', 'phpbb', 'phpbb', 'phpbb_prod');
$db->set_charset('utf8mb4');

$sources = [
	['post', 'SELECT post_id AS id, post_text AS text, enable_bbcode, enable_smilies, enable_magic_url FROM phpbb_posts'],
	['pm', 'SELECT msg_id AS id, message_text AS text, enable_bbcode, enable_smilies, enable_magic_url FROM phpbb_privmsgs'],
];

foreach ($sources as [$kind, $sql]) {
	$result = $db->query($sql, MYSQLI_USE_RESULT);
	while ($row = $result->fetch_assoc()) {
		$xml = $row['text'];
		$isXml = $xml !== '' && ($xml[0] === '<') && (str_starts_with($xml, '<r') || str_starts_with($xml, '<t'));
		echo json_encode([
			'kind' => $kind,
			'id' => (int) $row['id'],
			'xml' => $isXml,
			'text' => $isXml ? Unparser::unparse($xml) : $xml,
		], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n";
	}
	$result->free();
}
