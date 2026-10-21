<?php
/**
 * Baneforum image compress
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\imagecompress;

/**
 * Makes one picture file smaller in place. JPEG and PNG only. Needs the GD extension.
 *
 * - A picture bigger than 1920 by 1200 (1200 by 1920 if it stands upright) is scaled down.
 * - A JPEG is saved again with quality 85. A PNG is saved with the best compression.
 * - A photo that the camera stored on its side (EXIF orientation) is turned upright first,
 *   because saving again drops the EXIF block. Without this phone photos would end up sideways.
 * - A small file that needs nothing is not touched.
 * - A picture that GD cannot hold in memory is left as it is.
 */
class compressor
{
	public const MAX_LONG = 1920;
	public const MAX_SHORT = 1200;
	public const JPEG_QUALITY = 85;
	/** Files smaller than this and not too big in pixels are kept as they are. */
	public const KEEP_BELOW = 300000;

	/**
	 * @param string $path File to make smaller
	 * @return int|null The new file size, or null if the file was not changed
	 */
	public function compress(string $path): ?int
	{
		if (!function_exists('imagecreatetruecolor') || !is_file($path))
		{
			return null;
		}

		$info = @getimagesize($path);

		if ($info === false || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG], true))
		{
			return null;
		}

		[$width, $height, $type] = $info;
		$orientation = $type === IMAGETYPE_JPEG ? self::jpeg_orientation($path) : 1;
		$sideways = $orientation >= 5;
		$shown_width = $sideways ? $height : $width;
		$shown_height = $sideways ? $width : $height;
		[$max_width, $max_height] = $shown_width >= $shown_height
			? [self::MAX_LONG, self::MAX_SHORT]
			: [self::MAX_SHORT, self::MAX_LONG];
		$scale = min(1, $max_width / $shown_width, $max_height / $shown_height);
		$original_size = filesize($path);

		if ($scale === 1 && $orientation === 1 && $original_size <= self::KEEP_BELOW)
		{
			return null;
		}

		if (!self::fits_in_memory($width, $height))
		{
			return null;
		}

		$image = $type === IMAGETYPE_JPEG ? @imagecreatefromjpeg($path) : @imagecreatefrompng($path);

		if ($image === false)
		{
			return null;
		}

		$image = self::turn_upright($image, $orientation);

		if ($scale < 1)
		{
			$scaled = imagescale($image, max(1, (int) round($shown_width * $scale)), max(1, (int) round($shown_height * $scale)), IMG_BICUBIC);

			if ($scaled !== false)
			{
				$image = $scaled;
			}
		}

		$temporary = $path . '.compress';

		if ($type === IMAGETYPE_JPEG)
		{
			imageinterlace($image, true);
			$saved = imagejpeg($image, $temporary, self::JPEG_QUALITY);
		}
		else
		{
			imagealphablending($image, false);
			imagesavealpha($image, true);
			$saved = imagepng($image, $temporary, 9);
		}

		if (!$saved)
		{
			@unlink($temporary);

			return null;
		}

		$new_size = filesize($temporary);

		// Keep the new file when it is smaller, or when the picture had to be turned or scaled.
		if ($new_size >= $original_size && $scale === 1 && $orientation === 1)
		{
			@unlink($temporary);

			return null;
		}

		if (!rename($temporary, $path))
		{
			@unlink($temporary);

			return null;
		}

		clearstatcache(true, $path);

		return filesize($path);
	}

	/**
	 * Turns a picture the way its EXIF orientation says (1 = already upright).
	 *
	 * @param \GdImage $image
	 * @param int $orientation 1 to 8
	 * @return \GdImage
	 */
	protected static function turn_upright($image, int $orientation)
	{
		switch ($orientation)
		{
			case 2:
				imageflip($image, IMG_FLIP_HORIZONTAL);
				break;
			case 3:
				$image = imagerotate($image, 180, 0);
				break;
			case 4:
				imageflip($image, IMG_FLIP_VERTICAL);
				break;
			case 5:
				imageflip($image, IMG_FLIP_HORIZONTAL);
				$image = imagerotate($image, 90, 0);
				break;
			case 6:
				$image = imagerotate($image, -90, 0);
				break;
			case 7:
				imageflip($image, IMG_FLIP_HORIZONTAL);
				$image = imagerotate($image, -90, 0);
				break;
			case 8:
				$image = imagerotate($image, 90, 0);
				break;
		}

		return $image;
	}

	/**
	 * The EXIF orientation of a JPEG, read without the exif extension. 1 if there is none.
	 */
	public static function jpeg_orientation(string $path): int
	{
		$head = @file_get_contents($path, false, null, 0, 65536);

		if ($head === false || strlen($head) < 4 || substr($head, 0, 2) !== "\xFF\xD8")
		{
			return 1;
		}

		$position = 2;
		$length = strlen($head);

		while ($position + 4 <= $length && $head[$position] === "\xFF")
		{
			$marker = ord($head[$position + 1]);
			$size = unpack('n', substr($head, $position + 2, 2))[1];

			if ($marker === 0xE1 && substr($head, $position + 4, 6) === "Exif\0\0")
			{
				return self::orientation_from_tiff(substr($head, $position + 10, $size - 8));
			}

			if ($marker === 0xDA)
			{
				break;
			}

			$position += 2 + $size;
		}

		return 1;
	}

	protected static function orientation_from_tiff(string $tiff): int
	{
		if (strlen($tiff) < 8)
		{
			return 1;
		}

		$little = substr($tiff, 0, 2) === 'II';
		$short = $little ? 'v' : 'n';
		$long = $little ? 'V' : 'N';
		$offset = unpack($long, substr($tiff, 4, 4))[1];

		if ($offset + 2 > strlen($tiff))
		{
			return 1;
		}

		$entries = unpack($short, substr($tiff, $offset, 2))[1];

		for ($i = 0; $i < $entries; $i++)
		{
			$entry = $offset + 2 + $i * 12;

			if ($entry + 12 > strlen($tiff))
			{
				break;
			}

			if (unpack($short, substr($tiff, $entry, 2))[1] === 0x0112)
			{
				$value = unpack($short, substr($tiff, $entry + 8, 2))[1];

				return $value >= 1 && $value <= 8 ? $value : 1;
			}
		}

		return 1;
	}

	/**
	 * GD holds about 4 bytes for every pixel, and the copy for turning needs the same again.
	 * Pictures that would not fit are left alone, because running out of memory ends the request.
	 */
	protected static function fits_in_memory(int $width, int $height): bool
	{
		$limit = self::bytes(ini_get('memory_limit'));

		if ($limit < 0)
		{
			return true;
		}

		return $width * $height * 9 + 8 * 1024 * 1024 < $limit - memory_get_usage(true);
	}

	protected static function bytes(string $setting): int
	{
		$number = (int) $setting;

		return match (strtolower(substr(trim($setting), -1)))
		{
			'g' => $number * 1024 ** 3,
			'm' => $number * 1024 ** 2,
			'k' => $number * 1024,
			default => $number,
		};
	}
}
