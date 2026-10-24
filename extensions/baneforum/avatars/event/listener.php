<?php
/**
 * Baneforum letter avatars
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\avatars\event;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Gives a member without an avatar a round letter in a colour: the first letter of the name, in the colour that belongs to
 * that letter. The same letter always gets the same colour. It is HTML and CSS (a span), not an image. The colours are in
 * styles/all/theme/avatars.css, one class per number.
 */
class listener implements EventSubscriberInterface
{
	/** How many colours there are. The CSS has one class for each. */
	public const COLOURS = 12;

	/** The letters in order. Æ, Ø and Å come after Z, as in the Danish alphabet. */
	protected const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ';

	public static function getSubscribedEvents(): array
	{
		return [
			'core.viewtopic_modify_post_row' => 'add_to_post',
			'core.ucp_pm_view_messsage'      => 'add_to_message',
		];
	}

	/**
	 * The first letter of a name, in capitals. A name that does not start with a letter or a digit gets "?".
	 */
	public static function letter(string $name): string
	{
		$first = mb_strtoupper(mb_substr(trim(html_entity_decode($name, ENT_QUOTES, 'UTF-8')), 0, 1));

		return preg_match('/^[\p{L}\p{N}]$/u', $first) ? $first : '?';
	}

	/**
	 * The number of the colour of a letter: its place in the alphabet, round the colours. Any other character, such as a digit
	 * or a letter from another alphabet, goes by its code.
	 */
	public static function colour(string $letter): int
	{
		$place = mb_strpos(self::ALPHABET, $letter);

		return ($place === false ? mb_ord($letter) : $place) % self::COLOURS;
	}

	public static function html(string $name): string
	{
		$letter = self::letter($name);

		$name = htmlspecialchars(html_entity_decode($name, ENT_QUOTES, 'UTF-8'), ENT_QUOTES, 'UTF-8');

		return '<span class="bf-avatar bf-avatar--' . self::colour($letter) . '" role="img" aria-label="' . $name . '">' . htmlspecialchars($letter, ENT_QUOTES, 'UTF-8') . '</span>';
	}

	public function add_to_post($event): void
	{
		$row = $event['post_row'];

		if (($row['POSTER_AVATAR'] ?? '') === '')
		{
			$row['POSTER_AVATAR'] = self::html((string) ($row['POST_AUTHOR'] ?? ''));
			$event['post_row'] = $row;
		}
	}

	public function add_to_message($event): void
	{
		$data = $event['msg_data'];

		if (($data['AUTHOR_AVATAR'] ?? '') === '')
		{
			$data['AUTHOR_AVATAR'] = self::html((string) ($data['MESSAGE_AUTHOR'] ?? ''));
			$event['msg_data'] = $data;
		}
	}
}
