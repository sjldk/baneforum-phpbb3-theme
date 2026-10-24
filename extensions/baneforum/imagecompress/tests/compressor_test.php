<?php
/**
 * Tests for the image compressor
 *
 * Run it where PHP and GD are:
 *   docker compose exec web php ext/baneforum/imagecompress/tests/compressor_test.php
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

use baneforum\imagecompress\compressor;

require __DIR__ . '/../compressor.php';

$failed = 0;
$check = function (string $name, bool $ok, string $extra = '') use (&$failed): void {
	echo ($ok ? 'PASS ' : 'FAIL ') . $name . ($extra !== '' ? " ($extra)" : '') . "\n";
	$failed += $ok ? 0 : 1;
};
$dir = sys_get_temp_dir() . '/imagecompress-' . getmypid();
mkdir($dir);

/**
 * Writes a test picture: noise with a red block in its top left corner, saved as a JPEG with an EXIF orientation.
 *
 * @param string $path  The file to write
 * @param int $width  The width in pixels
 * @param int $height  The height in pixels
 * @param int $orientation  The EXIF orientation to store, 1 stores none
 * @param bool $noise  True to fill the picture with noise, so the file is big
 *
 * @return void
 */
function make_jpeg(string $path, int $width, int $height, int $orientation = 1, bool $noise = true): void
{
	$image = imagecreatetruecolor($width, $height);

	for ($i = 0; $i < ($noise ? 4000 : 0); $i++)
	{
		imagefilledrectangle($image, random_int(0, $width), random_int(0, $height), random_int(0, $width), random_int(0, $height), random_int(0, 0xFFFFFF));
	}

	imagefilledrectangle($image, 0, 0, 39, 39, 0xFF0000);
	ob_start();
	imagejpeg($image, null, 95);
	$data = ob_get_clean();

	if ($orientation !== 1)
	{
		$tiff = 'II' . pack('v', 42) . pack('V', 8) . pack('v', 1) . pack('v', 0x0112) . pack('v', 3) . pack('V', 1) . pack('v', $orientation) . pack('v', 0) . pack('V', 0);
		$exif = "Exif\0\0" . $tiff;
		$data = substr($data, 0, 2) . "\xFF\xE1" . pack('n', strlen($exif) + 2) . $exif . substr($data, 2);
	}

	file_put_contents($path, $data);
}

$compressor = new compressor();

// A big landscape photo is scaled to 1920 by 1200 at most.
make_jpeg("$dir/big.jpg", 4000, 3000);
$before = filesize("$dir/big.jpg");
$after = $compressor->compress("$dir/big.jpg");
[$w, $h] = getimagesize("$dir/big.jpg");
$check('a big photo is scaled down', $w === 1600 && $h === 1200, "$w x $h");
$check('and is smaller as a file', $after !== null && $after < $before && filesize("$dir/big.jpg") === $after, "$before -> $after");

// A photo stored on its side is turned upright, and the red corner moves with it.
make_jpeg("$dir/side.jpg", 3000, 2000, 6);
$compressor->compress("$dir/side.jpg");
[$w, $h] = getimagesize("$dir/side.jpg");
$check('a photo on its side becomes upright and portrait', $w === 1200 && $h === 1800, "$w x $h");
$image = imagecreatefromjpeg("$dir/side.jpg");
$corner = imagecolorsforindex($image, imagecolorat($image, $w - 5, 5));
$check('orientation 6: the top left corner went to the top right', $corner['red'] > 200 && $corner['green'] < 80, json_encode($corner));
$check('and the EXIF orientation is gone', compressor::jpeg_orientation("$dir/side.jpg") === 1);

// Each orientation puts the red corner in the right place.
$expected = [2 => 'tr', 3 => 'br', 4 => 'bl', 5 => 'tl', 6 => 'tr', 7 => 'br', 8 => 'bl'];

foreach ($expected as $orientation => $where)
{
	make_jpeg("$dir/o$orientation.jpg", 600, 400, $orientation, false);
	file_put_contents("$dir/o$orientation.jpg", file_get_contents("$dir/o$orientation.jpg"));
	// Small file: force the work by orientation alone.
	$compressor->compress("$dir/o$orientation.jpg");
	[$w, $h] = getimagesize("$dir/o$orientation.jpg");
	$image = imagecreatefromjpeg("$dir/o$orientation.jpg");
	$points = ['tl' => [8, 8], 'tr' => [$w - 9, 8], 'bl' => [8, $h - 9], 'br' => [$w - 9, $h - 9]];
	$found = null;

	foreach ($points as $name => [$x, $y])
	{
		$color = imagecolorsforindex($image, imagecolorat($image, $x, $y));

		if ($color['red'] > 200 && $color['green'] < 80)
		{
			$found = $name;
		}
	}

	$check("orientation $orientation puts the corner at $where", $found === $where, (string) $found);
}

// A small upright file is left alone.
make_jpeg("$dir/small.jpg", 800, 600, 1, false);
$before = md5_file("$dir/small.jpg");
$check('a small upright photo is not touched', $compressor->compress("$dir/small.jpg") === null && md5_file("$dir/small.jpg") === $before);

// A big PNG keeps its transparency.
$png = imagecreatetruecolor(3000, 2000);
imagealphablending($png, false);
imagesavealpha($png, true);
imagefill($png, 0, 0, imagecolorallocatealpha($png, 0, 0, 0, 127));
imagefilledrectangle($png, 1000, 500, 2000, 1500, imagecolorallocatealpha($png, 255, 0, 0, 0));

for ($i = 0; $i < 3000; $i++)
{
	imagefilledrectangle($png, random_int(1000, 2000), random_int(500, 1500), random_int(1000, 2000), random_int(500, 1500), imagecolorallocate($png, random_int(0, 255), random_int(0, 255), random_int(0, 255)));
}

imagepng($png, "$dir/big.png", 1);
$compressor->compress("$dir/big.png");
[$w, $h] = getimagesize("$dir/big.png");
$check('a big PNG is scaled down', $w === 1800 && $h === 1200, "$w x $h");
$image = imagecreatefrompng("$dir/big.png");
$check('and keeps its transparent corner', (imagecolorat($image, 2, 2) >> 24) > 100);

// Things that are not touched.
file_put_contents("$dir/notes.txt", 'hello');
$check('a text file is not touched', $compressor->compress("$dir/notes.txt") === null);
$check('a missing file is not touched', $compressor->compress("$dir/none.jpg") === null);
imagegif(imagecreatetruecolor(50, 50), "$dir/a.gif");
$check('a GIF is not touched', $compressor->compress("$dir/a.gif") === null);

// EXIF reading, both byte orders.
$tiff = 'MM' . pack('n', 42) . pack('N', 8) . pack('n', 1) . pack('n', 0x0112) . pack('n', 3) . pack('N', 1) . pack('n', 8) . pack('n', 0) . pack('N', 0);
$exif = "Exif\0\0" . $tiff;
file_put_contents("$dir/be.jpg", "\xFF\xD8\xFF\xE1" . pack('n', strlen($exif) + 2) . $exif . "\xFF\xD9");
$check('EXIF orientation is read in big endian files', compressor::jpeg_orientation("$dir/be.jpg") === 8);
file_put_contents("$dir/junk.jpg", 'not a jpeg');
$check('a file that is not a JPEG has orientation 1', compressor::jpeg_orientation("$dir/junk.jpg") === 1);

array_map('unlink', glob("$dir/*"));
rmdir($dir);
echo $failed === 0 ? "\nAll passed\n" : "\n$failed failed\n";
exit($failed === 0 ? 0 : 1);
