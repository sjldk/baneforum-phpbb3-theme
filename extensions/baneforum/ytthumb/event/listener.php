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

	public function __construct(protected helper $helper, protected template $template)
	{
	}

	public static function getSubscribedEvents(): array
	{
		return ['core.page_header' => 'add_address'];
	}

	public function add_address($event): void
	{
		$this->template->assign_var('U_BF_YTTHUMB', $this->helper->route('baneforum_ytthumb', ['id' => self::STAND_IN], false));
	}
}
