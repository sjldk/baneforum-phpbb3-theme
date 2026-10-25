<?php
/**
 * Baneforum editor
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\editor\event;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Adds the BBCodes that the editor writes: [s] (strikethrough) and the table BBCodes.
 */
class listener implements EventSubscriberInterface
{
	/**
	 * Tells phpBB which events this class listens to.
	 *
	 * @return array<string, string>  The event names, each with the method that handles it.
	 */
	public static function getSubscribedEvents(): array
	{
		return [
			'core.text_formatter_s9e_configure_after' => 'add_bbcodes',
		];
	}

	/** The table BBCodes. The text formatter library of phpBB has the definitions ready (its repository). phpBB does not switch them on. */
	public const TABLE_BBCODES = ['TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD'];

	/**
	 * The BBCodes that phpBB lacks and that the editor writes: [s] for strikethrough, and [table], [tr],
	 * [th], [td] (with align=left|center|right, colspan and rowspan) for tables. A tag that the board does not know is shown as plain text.
	 *
	 * @param \phpbb\event\data $event  The core.text_formatter_s9e_configure_after event
	 *
	 * @return void
	 */
	public function add_bbcodes($event): void
	{
		$bbcodes = $event['configurator']->BBCodes;

		if (!isset($bbcodes['S']))
		{
			$bbcodes->addCustom('[s]{TEXT}[/s]', '<del>{TEXT}</del>');
		}

		foreach (self::TABLE_BBCODES as $name)
		{
			if (!isset($bbcodes[$name]))
			{
				$bbcodes->addFromRepository($name);
			}
		}
	}
}
