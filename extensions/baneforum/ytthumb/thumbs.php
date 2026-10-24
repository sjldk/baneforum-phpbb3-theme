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

	public const MIN_BYTES = 1000;
	public const MAX_BYTES = 300000;

	/** Seconds before the board tries again with a video that failed. */
	public const RETRY_AFTER = 3600;

	/** The most fetches (and checks of the posts) a minute, for the whole board. */
	public const PER_MINUTE = 20;

	public function __construct(protected string $dir)
	{
	}

	public static function valid(string $id): bool
	{
		return preg_match(self::ID_PATTERN, $id) === 1;
	}

	/** A JPEG file of a sensible size. */
	public static function is_thumbnail(?string $bytes): bool
	{
		return $bytes !== null
			&& strlen($bytes) >= self::MIN_BYTES
			&& strlen($bytes) <= self::MAX_BYTES
			&& str_starts_with($bytes, "\xFF\xD8\xFF");
	}

	public function path(string $id): string
	{
		return $this->dir . $id . '.jpg';
	}

	/**
	 * @param callable(string): bool $known tells if a post of the board mentions the video
	 * @return string|null the path of the picture, or null if there is none (the card then has no picture)
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

	/** Makes the folder, and says if it can be written. */
	protected function ready(): bool
	{
		return is_dir($this->dir) || @mkdir($this->dir, 0755, true) || is_dir($this->dir);
	}

	/** Counts a fetch in the minute. False when the board has had enough for this minute. */
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

	/** The picture from YouTube: https only, a fixed address, no redirects, a few seconds at most. */
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
