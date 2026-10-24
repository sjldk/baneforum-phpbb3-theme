<?php
/**
 * Baneforum YouTube thumbnails
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\ytthumb\event;

use phpbb\controller\helper;
use phpbb\template\template;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Tells every page where the thumbnails are (template variable U_BF_YTTHUMB, with a stand-in for the video id), so that the script of
 * the video cards can ask for them.
 */
class listener implements EventSubscriberInterface
{
	/** Replaced by the id of the video in the script of the page. Eleven characters, like a real id. */
	public const STAND_IN = 'AAAAAAAAAAA';

	/**
	 * Keeps the services that the page header needs.
	 *
	 * @param helper   $helper    Makes the address of the thumbnail route.
	 * @param template $template  The page template that gets the variable.
	 */
	public function __construct(protected helper $helper, protected template $template)
	{
	}

	/**
	 * The events this listener wants.
	 *
	 * @return array<string, string>  Event name and method name.
	 */
	public static function getSubscribedEvents(): array
	{
		return ['core.page_header' => 'add_address'];
	}

	/**
	 * Gives the page template the address of a thumbnail, with the stand-in where the video id goes.
	 *
	 * @param \phpbb\event\data $event  The core.page_header event.
	 *
	 * @return void
	 */
	public function add_address($event): void
	{
		$this->template->assign_var('U_BF_YTTHUMB', $this->helper->route('baneforum_ytthumb', ['id' => self::STAND_IN], false));
	}
}
