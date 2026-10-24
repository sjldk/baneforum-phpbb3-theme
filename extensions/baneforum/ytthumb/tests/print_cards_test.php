<?php
/**
 * Tests for the video block of the print view. Run it with scripts/php-check.sh test.
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

use baneforum\ytthumb\print_cards;

require __DIR__ . '/../print_cards.php';

$failed = 0;
$check = function (string $name, $got, $want) use (&$failed): void {
	$ok = $got === $want;
	echo ($ok ? 'PASS ' : 'FAIL ') . $name . ($ok ? '' : "\n  got:  " . var_export($got, true) . "\n  want: " . var_export($want, true)) . "\n";
	$failed += $ok ? 0 : 1;
};

$picture = fn (string $id): string => './app.php/ytthumb/' . $id . '?a=1&amp;b=2';

// What phpBB makes (copied from a real topic).
$embed = '<span data-s9e-mediaembed="youtube" style="display:inline-block;width:100%;max-width:640px"><span style="display:block;overflow:hidden;position:relative;padding-bottom:56.25%"><iframe allowfullscreen="" loading="lazy" scrolling="no" style="background:url(https://i.ytimg.com/vi/iP5Ydv9iHzA/hqdefault.jpg) 50% 50% / cover;border:0;height:100%;left:0;position:absolute;width:100%" src="https://www.youtube.com/embed/iP5Ydv9iHzA"></iframe></span></span>';

$out = print_cards::replace('<p>Before</p><p>' . $embed . '</p><p>After</p>', $picture);
$check('the iframe is gone', str_contains($out, '<iframe'), false);
$check('the picture of Google is gone', str_contains($out, 'ytimg.com'), false);
$check('our thumbnail is used', str_contains($out, 'src="./app.php/ytthumb/iP5Ydv9iHzA?a=1&amp;b=2"'), true);
$check('the address of the video is there, as text and link', str_contains($out, '<a href="https://www.youtube.com/watch?v=iP5Ydv9iHzA">https://www.youtube.com/watch?v=iP5Ydv9iHzA</a>'), true);
$check('the text around it is kept', str_starts_with($out, '<p>Before</p><p>') && str_ends_with($out, '</p><p>After</p>'), true);

$start = str_replace('/embed/iP5Ydv9iHzA"', '/embed/iP5Ydv9iHzA?list=PLx&amp;start=95"', $embed);
$check('a start time becomes &t=95s', str_contains(print_cards::replace($start, $picture), 'watch?v=iP5Ydv9iHzA&amp;t=95s'), true);

$check('the nocookie address is known', print_cards::video('https://www.youtube-nocookie.com/embed/iP5Ydv9iHzA')['id'] ?? null, 'iP5Ydv9iHzA');
$check('a bad id is not a video', print_cards::video('https://www.youtube.com/embed/short'), null);
$check('another site is not a video', print_cards::video('https://example.com/embed/iP5Ydv9iHzA'), null);
$check('a script address is not a video', print_cards::video('javascript:alert(1)//youtube.com/embed/iP5Ydv9iHzA'), null);

$other = str_replace('data-s9e-mediaembed="youtube"', 'data-s9e-mediaembed="vimeo"', $embed);
$check('another site embed is left as it is', print_cards::replace($other, $picture), $other);

$two = print_cards::replace($embed . ' text ' . $embed, $picture);
$check('two videos both change', substr_count($two, 'bf-print-video'), 2);

$check('a text with no video is not changed', print_cards::replace('<p>Hej &amp; hello</p>', $picture), '<p>Hej &amp; hello</p>');

$evil = str_replace('iP5Ydv9iHzA"', 'iP5Ydv9iHzA?start=1&quot;&gt;&lt;script&gt;"', $embed);
$check('nothing from the address can break out of the markup', str_contains(print_cards::replace($evil, $picture), '<script'), false);

exit($failed === 0 ? 0 : 1);
