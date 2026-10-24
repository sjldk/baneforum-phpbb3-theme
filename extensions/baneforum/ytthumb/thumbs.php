<?php
/**
 * Baneforum YouTube thumbnails
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\ytthumb;

/**
 * Keeps a copy of the thumbnail of a YouTube video on the board, so that the video card can show it without the visitor contacting
 * Google. A picture is fetched once, from i.ytimg.com, and only for a video that a post of the board mentions. The fetching is limited:
 * a few a minute for the whole board, one try an hour for a video that failed.
 */
class thumbs
{
	/** The id of a YouTube video: 11 letters, digits, "-" and "_". */
	public const ID_PATTERN = '/^[A-Za-z0-9_-]{11}$/D';

	/** The picture of the video: 480 by 360. A 16:9 video has black bars above and below, that the card crops away. */
	public const FILE = 'hqdefault.jpg';

	/** A file smaller than this is not a picture. */
	public const MIN_BYTES = 1000;
	/** A file larger than this is refused, so a wrong answer cannot fill the disk. */
	public const MAX_BYTES = 300000;

	/** Seconds before the board tries again with a video that failed. */
	public const RETRY_AFTER = 3600;

	/** The most fetches (and checks of the posts) a minute, for the whole board. */
	public const PER_MINUTE = 20;

	/**
	 * Remembers the folder of the pictures.
	 *
	 * @param string $dir  The folder, with a slash at the end.
	 */
	public function __construct(protected string $dir)
	{
	}

	/**
	 * Tells if the text can be the id of a YouTube video. Checked before the id is used in a path or an address.
	 *
	 * @param string $id  The text to check.
	 *
	 * @return bool  True for an id of the right form.
	 */
	public static function valid(string $id): bool
	{
		return preg_match(self::ID_PATTERN, $id) === 1;
	}

	/**
	 * A JPEG file of a sensible size.
	 *
	 * @param string|null $bytes  The downloaded content, or null when the download failed.
	 *
	 * @return bool  True when the content looks like a JPEG picture.
	 */
	public static function is_thumbnail(?string $bytes): bool
	{
		return $bytes !== null
			&& strlen($bytes) >= self::MIN_BYTES
			&& strlen($bytes) <= self::MAX_BYTES
			&& str_starts_with($bytes, "\xFF\xD8\xFF");
	}

	/**
	 * Where the picture of a video is kept.
	 *
	 * @param string $id  The id of the video. It must be valid.
	 *
	 * @return string  The path of the file. The file may not exist.
	 */
	public function path(string $id): string
	{
		return $this->dir . $id . '.jpg';
	}

	/**
	 * Gives the path of the picture of a video, and fetches it first when the board has none and may fetch.
	 *
	 * @param string   $id     The id of the video.
	 * @param callable $known  Gets the id and tells if a post of the board mentions the video.
	 *
	 * @return string|null  The path of the picture, or null if there is none (the card then has no picture).
	 */
	public function find(string $id, callable $known): ?string
	{
		if (!self::valid($id))
		{
			return null;
		}

		$path = $this->path($id);

		if (is_file($path))
		{
			return $path;
		}

		$miss = $this->dir . $id . '.miss';

		if (is_file($miss) && time() - (int) filemtime($miss) < self::RETRY_AFTER)
		{
			return null;
		}

		if (!$this->allow() || !$known($id))
		{
			return null;
		}

		$bytes = $this->download($id);

		if (!self::is_thumbnail($bytes))
		{
			@touch($miss);

			return null;
		}

		$temporary = $path . '.' . getmypid() . '.tmp';

		if (@file_put_contents($temporary, $bytes) === false || !@rename($temporary, $path))
		{
			@unlink($temporary);

			return null;
		}

		return $path;
	}

	/**
	 * Makes the folder, and says if it can be written.
	 *
	 * @return bool  True when the folder is there.
	 */
	protected function ready(): bool
	{
		return is_dir($this->dir) || @mkdir($this->dir, 0755, true) || is_dir($this->dir);
	}

	/**
	 * Counts a fetch in the minute. The count is kept in a file with a lock, so parallel requests share it.
	 *
	 * @return bool  False when the board has had enough for this minute.
	 */
	protected function allow(): bool
	{
		if (!$this->ready() || ($handle = @fopen($this->dir . 'rate', 'c+')) === false)
		{
			return false;
		}

		flock($handle, LOCK_EX);

		$parts = explode(':', trim((string) stream_get_contents($handle)));
		$minute = intdiv(time(), 60);
		$count = (int) ($parts[0] ?? 0) === $minute ? (int) ($parts[1] ?? 0) : 0;
		$allowed = $count < self::PER_MINUTE;

		if ($allowed)
		{
			ftruncate($handle, 0);
			rewind($handle);
			fwrite($handle, $minute . ':' . ($count + 1));
		}

		flock($handle, LOCK_UN);
		fclose($handle);

		return $allowed;
	}

	/**
	 * The picture from YouTube: https only, a fixed address, no redirects, a few seconds at most.
	 *
	 * @param string $id  The id of the video. It must be valid.
	 *
	 * @return string|null  The content, or null when curl is missing or the fetch failed.
	 */
	protected function download(string $id): ?string
	{
		if (!function_exists('curl_init'))
		{
			return null;
		}

		$curl = curl_init('https://i.ytimg.com/vi/' . $id . '/' . self::FILE);
		curl_setopt_array($curl, [
			CURLOPT_RETURNTRANSFER => true,
			CURLOPT_CONNECTTIMEOUT => 3,
			CURLOPT_TIMEOUT        => 5,
			CURLOPT_FOLLOWLOCATION => false,
			CURLOPT_MAXFILESIZE    => self::MAX_BYTES,
			CURLOPT_FAILONERROR    => true,
		]);

		$body = curl_exec($curl);

		return is_string($body) ? $body : null;
	}
}
