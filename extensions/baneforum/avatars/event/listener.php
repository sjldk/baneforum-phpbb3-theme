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

	/**
	 * Tells phpBB which events this class listens to.
	 *
	 * @return array<string, string>  The event names, each with the method that handles it.
	 */
	public static function getSubscribedEvents(): array
	{
		return [
			'core.viewtopic_modify_post_row' => 'add_to_post',
			'core.ucp_pm_view_messsage'      => 'add_to_message',
		];
	}

	/**
	 * The first letter of a name, in capitals. A name that does not start with a letter or a digit gets "?".
	 *
	 * @param string $name  The user name, as phpBB stores it. It can hold HTML entities.
	 *
	 * @return string  One character
	 */
	public static function letter(string $name): string
	{
		$first = mb_strtoupper(mb_substr(trim(html_entity_decode($name, ENT_QUOTES, 'UTF-8')), 0, 1));

		return preg_match('/^[\p{L}\p{N}]$/u', $first) ? $first : '?';
	}

	/**
	 * The number of the colour of a letter: its place in the alphabet, round the colours. Any other character, such as a digit
	 * or a letter from another alphabet, goes by its code.
	 *
	 * @param string $letter  One character, as letter() gives it
	 *
	 * @return int  A number from 0 to COLOURS minus 1
	 */
	public static function colour(string $letter): int
	{
		$place = mb_strpos(self::ALPHABET, $letter);

		return ($place === false ? mb_ord($letter) : $place) % self::COLOURS;
	}

	/**
	 * The HTML of the letter avatar: a span with the colour class and the name as its label for screen readers.
	 * The name is escaped here, because it ends in an HTML attribute.
	 *
	 * @param string $name  The user name, as phpBB stores it
	 *
	 * @return string  The HTML of the span
	 */
	public static function html(string $name): string
	{
		$letter = self::letter($name);

		$name = htmlspecialchars(html_entity_decode($name, ENT_QUOTES, 'UTF-8'), ENT_QUOTES, 'UTF-8');

		return '<span class="bf-avatar bf-avatar--' . self::colour($letter) . '" role="img" aria-label="' . $name . '">' . htmlspecialchars($letter, ENT_QUOTES, 'UTF-8') . '</span>';
	}

	/**
	 * Puts the letter avatar on a post of a member who has no avatar.
	 *
	 * @param \phpbb\event\data $event  The core.viewtopic_modify_post_row event
	 *
	 * @return void
	 */
	public function add_to_post($event): void
	{
		$row = $event['post_row'];

		if (($row['POSTER_AVATAR'] ?? '') === '')
		{
			$row['POSTER_AVATAR'] = self::html((string) ($row['POST_AUTHOR'] ?? ''));
			$event['post_row'] = $row;
		}
	}

	/**
	 * Puts the letter avatar on a private message from a member who has no avatar.
	 *
	 * @param \phpbb\event\data $event  The core.ucp_pm_view_messsage event. The three s in its name are phpBB's own spelling.
	 *
	 * @return void
	 */
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
