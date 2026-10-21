<?php
// Renders the original and the converted text of each message with phpBB's own formatter
// and compares what a reader would see. Input: JSON lines with "original" and "converted".
//
//   docker cp scripts/render_compare.php docker-web-1:/tmp/render_compare.php
//   docker compose -f docker/docker-compose.yml exec -T web php /tmp/render_compare.php < local-data/corpus/converted.jsonl

error_reporting(E_ALL & ~E_DEPRECATED);
ini_set('display_errors', '0');

ob_start(); // phpBB prints warnings when it runs outside a web request. Keep only our result.

define('IN_PHPBB', true);
$phpbb_root_path = '/var/www/html/';
$phpEx = 'php';
require $phpbb_root_path . 'common.' . $phpEx;

// The renderer reads these from the current user. A script has none.
$user->data = array_merge($user->data ?? [], ['user_id' => 1, 'user_options' => 230271, 'style_id' => 1]);

$parser = $phpbb_container->get('text_formatter.parser');
$renderer = $phpbb_container->get('text_formatter.renderer');
// The Markdown extension switches Litedown off for a user that may not use Markdown. Switch it on.
foreach (['Litedown', 'PipeTables', 'TaskLists'] as $plugin) {
	$parser->get_parser()->enablePlugin($plugin);
}
$parser->enable_bbcode(true);
$parser->enable_smilies(true);
$parser->enable_magic_url(true);

function visible(string $html): string
{
	// Smilies and emoji both become one marker, so a code and its emoji compare equal.
	$html = preg_replace('/<img[^>]*class="[^"]*smilies[^"]*"[^>]*>/u', ' @S ', $html);
	$html = preg_replace('/<!--.*?-->/s', '', $html);
	$text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
	$text = preg_replace('/\x{200B}/u', '', $text);
	// A smilie code that the board does not turn into an image is shown as text. Count it as a smilie.
	$text = preg_replace('/(?<![\w\/])(:-?[)(DPOo|?xX]|;-?\)|8-?\)|:[a-z]+:|:[!?]:)(?![\w])/u', '@S', $text);
	$text = preg_replace('/[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B50}\x{2B1B}\x{2B1C}\x{FE0F}]/u', '@S', $text);
	$text = preg_replace('/(@S\s*)+/u', '@S ', $text);
	// Spacing differences are not content. Compare without any whitespace.
	return preg_replace('/\s+/u', '', $text);
}

function render(string $text, $parser, $renderer): string
{
	return $renderer->render($parser->parse($text));
}

$total = $same = 0;
$samples = [];
while (($line = fgets(STDIN)) !== false) {
	$row = json_decode($line, true);
	if (!$row) {
		continue;
	}
	$total++;
	$before = visible(render($row['original'], $parser, $renderer));
	$after = visible(render($row['converted'], $parser, $renderer));
	if ($before === $after) {
		$same++;
	} elseif (count($samples) < 600) {
		$at = 0;
		$limit = min(mb_strlen($before), mb_strlen($after));
		while ($at < $limit && mb_substr($before, $at, 1) === mb_substr($after, $at, 1)) {
			$at++;
		}
		$samples[] = ['id' => $row['id'], 'kind' => $row['kind'], 'before' => mb_substr($before, max(0, $at - 40), 100), 'after' => mb_substr($after, max(0, $at - 40), 100), 'original' => mb_substr($row['original'], 0, 300), 'converted' => mb_substr($row['converted'], 0, 300)];
	}
}
while (ob_get_level() > 0) {
	ob_end_clean();
}
fwrite(STDOUT, json_encode(['total' => $total, 'same' => $same, 'different' => $total - $same, 'samples' => $samples], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n");
