<?php
/**
 * Baneforum censor
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\censor\event;

use baneforum\censor\censor;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Takes phpBB's own censoring out of the text formatter and does it after the post is made into HTML,
 * where the extension can see which text is a URL. The words are still the ones from the ACP.
 */
class listener implements EventSubscriberInterface
{
	public function __construct(protected censor $censor)
	{
	}

	public static function getSubscribedEvents(): array
	{
		return [
			'core.text_formatter_s9e_configure_after' => 'remove_core_censor',
			'core.text_formatter_s9e_render_after' => 'censor_html',
		];
	}

	/**
	 * Same two lines as phpBB's factory uses when it takes the plugin out, so it never builds a censor helper.
	 *
	 * @param \phpbb\event\data $event
	 */
	public function remove_core_censor($event): void
	{
		$configurator = $event['configurator'];

		if (isset($configurator->Censor))
		{
			unset($configurator->Censor);
			unset($configurator->tags['censor:tag']);
		}
	}

	/**
	 * @param \phpbb\event\data $event
	 */
	public function censor_html($event): void
	{
		if ($event['renderer']->get_viewcensors())
		{
			$event['html'] = $this->censor->censor_html($event['html']);
		}
	}
}
