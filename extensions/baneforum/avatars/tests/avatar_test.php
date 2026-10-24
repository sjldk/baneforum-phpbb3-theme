<?php
/**
 * Tests for the letter avatars
 *
 * Run it where PHP and phpBB's vendor folder are:
 *   docker compose exec web php ext/baneforum/avatars/tests/avatar_test.php
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

use baneforum\avatars\event\listener;

require '/var/www/html/vendor/autoload.php';
require __DIR__ . '/../event/listener.php';

$failed = 0;
$check = function (string $name, $got, $want) use (&$failed): void {
	$ok = $got === $want;
	echo ($ok ? 'PASS ' : 'FAIL ') . $name . ($ok ? '' : "\n  got:  " . var_export($got, true) . "\n  want: " . var_export($want, true)) . "\n";
	$failed += $ok ? 0 : 1;
};

$check('first letter, in capitals', listener::letter('alice'), 'A');
$check('Danish letter', listener::letter('østen'), 'Ø');
$check('spaces before the name are ignored', listener::letter('  bob'), 'B');
$check('a digit', listener::letter('7of9'), '7');
$check('a name that starts with a sign', listener::letter('~tilde'), '?');
$check('an empty name', listener::letter(''), '?');
$check('an escaped name', listener::letter('&amp;x'), '?');

$check('A is colour 0', listener::colour('A'), 0);
$check('B is colour 1', listener::colour('B'), 1);
$check('the colours go round after 12 letters: M is 0 again', listener::colour('M'), 0);
$check('Æ comes after Z', listener::colour('Æ'), 26 % listener::COLOURS);
$check('the same letter always has the same colour', listener::colour('K') === listener::colour('K'), true);

foreach (array_merge(range('A', 'Z'), ['Æ', 'Ø', 'Å', '0', '9', '?', 'Я', '字']) as $letter)
{
	$colour = listener::colour($letter);
	$check("colour of $letter is in range", $colour >= 0 && $colour < listener::COLOURS, true);
}

$check('the HTML', listener::html('carol'), '<span class="bf-avatar bf-avatar--2" role="img" aria-label="carol">C</span>');
$check('a name is escaped', listener::html('<b>'), '<span class="bf-avatar bf-avatar--' . listener::colour('?') . '" role="img" aria-label="&lt;b&gt;">?</span>');

exit($failed ? 1 : 0);
