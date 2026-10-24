<?php
/**
 * Tests for the upload folder of the Markdown converter: the detector copy in it must be the same file as the one in the editor extension,
 * and both library files must load. Run it with scripts/php-check.sh test.
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

$failed = 0;
$check = function (string $name, bool $ok) use (&$failed): void {
	echo ($ok ? 'PASS ' : 'FAIL ') . $name . "\n";
	$failed += $ok ? 0 : 1;
};

$lib = __DIR__ . '/../upload/bf-markdown-import';
$extension = __DIR__ . '/../../extensions/baneforum/editor/markdown_detector.php';

$check('the detector in the upload folder is the same file as in the editor extension', is_file($extension) && md5_file($extension) === md5_file($lib . '/markdown_detector.php'));

require $lib . '/markdown_detector.php';
require $lib . '/markdown_import.php';
$check('the import class loads', class_exists('baneforum\editor\markdown_import', false));

$detector = new baneforum\editor\markdown_detector();
$check('the detector calls bold Markdown', $detector->contains_markdown('<r><STRONG><s>**</s>x<e>**</e></STRONG></r>'));
$check('the detector does not call a [table] BBCode Markdown', !$detector->contains_markdown('<r><TABLE><s>[table]</s><TR><s>[tr]</s></TR></TABLE></r>'));

echo $failed === 0 ? "All passed\n" : "$failed failed\n";
exit($failed === 0 ? 0 : 1);
