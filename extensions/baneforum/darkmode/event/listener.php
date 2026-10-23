<?php
/**
 * Baneforum appearance switch
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\darkmode\event;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Loads the words for the switch. The switch itself is a template event and a small script.
 */
class listener implements EventSubscriberInterface
{
	public static function getSubscribedEvents(): array
	{
		return [
			'core.user_setup' => 'load_language',
		];
	}

	public function load_language($event): void
	{
		$lang_set_ext = $event['lang_set_ext'];
		$lang_set_ext[] = ['ext_name' => 'baneforum/darkmode', 'lang_set' => 'common'];
		$event['lang_set_ext'] = $lang_set_ext;
	}
}
