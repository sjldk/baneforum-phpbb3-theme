<?php
/**
 * Tests for the YouTube thumbnails. Run it where PHP is:
 *   docker compose exec web php ext/baneforum/ytthumb/tests/thumbs_test.php
 */

require __DIR__ . '/../thumbs.php';

use baneforum\ytthumb\thumbs;

/** The same, with the download replaced, so that nothing leaves the machine. */
class fake_thumbs extends thumbs
{
	public array $downloads = [];
	public ?string $reply = null;

	protected function download(string $id): ?string
	{
		$this->downloads[] = $id;

		return $this->reply;
	}
}

$failed = 0;
$check = function (string $name, $got, $want) use (&$failed): void {
	$ok = $got === $want;
	echo ($ok ? 'PASS ' : 'FAIL ') . $name . ($ok ? '' : "\n  got:  " . var_export($got, true) . "\n  want: " . var_export($want, true)) . "\n";
	$failed += $ok ? 0 : 1;
};

$jpeg = "\xFF\xD8\xFF\xE0" . str_repeat('x', 2000);
$always = fn (string $id): bool => true;
$never = fn (string $id): bool => false;

$new = function () {
	$dir = sys_get_temp_dir() . '/ytthumb_test_' . bin2hex(random_bytes(4)) . '/';

	return [new fake_thumbs($dir), $dir];
};

$check('a real id is valid', thumbs::valid('iP5Ydv9iHzA'), true);
$check('an id with - and _ is valid', thumbs::valid('a-b_c-d_e-f'), true);
$check('a short id is not valid', thumbs::valid('abc'), false);
$check('a long id is not valid', thumbs::valid('iP5Ydv9iHzAx'), false);
$check('a path is not valid', thumbs::valid('../../etc/pa'), false);
$check('a new line at the end is not valid', thumbs::valid("iP5Ydv9iHz\n"), false);
$check('an empty id is not valid', thumbs::valid(''), false);

$check('a JPEG is a thumbnail', thumbs::is_thumbnail($jpeg), true);
$check('null is not', thumbs::is_thumbnail(null), false);
$check('a tiny file is not', thumbs::is_thumbnail("\xFF\xD8\xFF"), false);
$check('a PNG is not', thumbs::is_thumbnail("\x89PNG" . str_repeat('x', 2000)), false);
$check('a huge file is not', thumbs::is_thumbnail("\xFF\xD8\xFF" . str_repeat('x', thumbs::MAX_BYTES)), false);

[$thumbs, $dir] = $new();
$thumbs->reply = $jpeg;
$path = $thumbs->find('iP5Ydv9iHzA', $always);
$check('a mentioned video is fetched and kept', [$path, is_file((string) $path), $thumbs->downloads], [$dir . 'iP5Ydv9iHzA.jpg', true, ['iP5Ydv9iHzA']]);
$check('the kept file is the picture', file_get_contents($path), $jpeg);
$thumbs->find('iP5Ydv9iHzA', $always);
$check('the second time nothing is fetched', count($thumbs->downloads), 1);
$check('no temporary file is left', glob($dir . '*.tmp'), []);

[$thumbs, $dir] = $new();
$thumbs->reply = $jpeg;
$check('a video that no post mentions gives no picture', $thumbs->find('iP5Ydv9iHzA', $never), null);
$check('and is not fetched', $thumbs->downloads, []);

[$thumbs, $dir] = $new();
$thumbs->reply = $jpeg;
$check('a bad id is refused', $thumbs->find('../../etc/pa', $always), null);
$check('and is not fetched', $thumbs->downloads, []);

[$thumbs, $dir] = $new();
$thumbs->reply = null;
$check('a failed fetch gives no picture', $thumbs->find('iP5Ydv9iHzA', $always), null);
$check('a marker is left', is_file($dir . 'iP5Ydv9iHzA.miss'), true);
$thumbs->reply = $jpeg;
$check('the board does not try again at once', $thumbs->find('iP5Ydv9iHzA', $always), null);
$check('and does not fetch', count($thumbs->downloads), 1);
touch($dir . 'iP5Ydv9iHzA.miss', time() - thumbs::RETRY_AFTER - 5);
$check('an hour later it tries again and succeeds', $thumbs->find('iP5Ydv9iHzA', $always) !== null, true);

[$thumbs, $dir] = $new();
$thumbs->reply = "<html>not a picture</html>" . str_repeat('x', 2000);
$check('an answer that is not a JPEG is refused', $thumbs->find('iP5Ydv9iHzA', $always), null);
$check('and no picture file is made', is_file($dir . 'iP5Ydv9iHzA.jpg'), false);

[$thumbs, $dir] = $new();
$thumbs->reply = $jpeg;
$got = 0;

for ($i = 0; $i < thumbs::PER_MINUTE + 5; $i++)
{
	$id = str_pad((string) $i, 11, 'Z', STR_PAD_LEFT);
	$got += $thumbs->find($id, $always) !== null ? 1 : 0;
}

$check('the board fetches no more than the limit in a minute', [$got, count($thumbs->downloads)], [thumbs::PER_MINUTE, thumbs::PER_MINUTE]);

exit($failed === 0 ? 0 : 1);
