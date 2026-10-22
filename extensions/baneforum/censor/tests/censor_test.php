<?php
/**
 * Tests for the censor. Run it where PHP and phpBB's vendor folder are:
 *   docker compose exec web php ext/baneforum/censor/tests/censor_test.php
 */

require '/var/www/html/vendor/autoload.php';
require __DIR__ . '/../censor.php';

use baneforum\censor\censor;

$failed = 0;
$check = function (string $name, string $got, string $want) use (&$failed): void {
	$ok = $got === $want;
	echo ($ok ? 'PASS ' : 'FAIL ') . $name . ($ok ? '' : "\n  got:  $got\n  want: $want") . "\n";
	$failed += $ok ? 0 : 1;
};

$censor = new censor();
$censor->set_words([['word' => 'Maerklin', 'replacement' => 'Märklin'], ['word' => 'ugh*', 'replacement' => '***']]);

$check('plain text', $censor->censor_html('<p>I like Maerklin.</p>'), '<p>I like Märklin.</p>');
$check('wildcard', $censor->censor_html('<p>ughhh</p>'), '<p>***</p>');
$check('autolink keeps href and text',
	$censor->censor_html('<p>See <a href="https://www.maerklin.de/Maerklin" class="postlink">https://www.maerklin.de/Maerklin</a> now</p>'),
	'<p>See <a href="https://www.maerklin.de/Maerklin" class="postlink">https://www.maerklin.de/Maerklin</a> now</p>');
$check('link with words as text: text censored, href kept',
	$censor->censor_html('<a href="https://x.dk/Maerklin" class="postlink">Maerklin forum</a>'),
	'<a href="https://x.dk/Maerklin" class="postlink">Märklin forum</a>');
$check('bare URL in text kept, words around it censored',
	$censor->censor_html('<p>Maerklin at http://x.dk/Maerklin?a=1&amp;b=2 and Maerklin</p>'),
	'<p>Märklin at http://x.dk/Maerklin?a=1&amp;b=2 and Märklin</p>');
$check('image src kept', $censor->censor_html('<img src="/files/Maerklin.jpg" alt="Maerklin">'), '<img src="/files/Maerklin.jpg" alt="Maerklin">');
$check('unclosed link does not eat the text', $censor->censor_html('<a href="http://a">http://a/Maerklin Maerklin'), '<a href="http://a">http://a/Maerklin Märklin');
$check('no words', (new censor())->censor_html('<p>Maerklin</p>'), '<p>Maerklin</p>');

echo $failed === 0 ? "All passed\n" : "$failed failed\n";
exit($failed === 0 ? 0 : 1);
