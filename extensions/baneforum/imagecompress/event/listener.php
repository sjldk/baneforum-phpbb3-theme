<?php
/**
 * Baneforum image compress
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\imagecompress\event;

use baneforum\imagecompress\compressor;
use phpbb\config\config;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Makes a picture smaller as soon as phpBB has stored it, before the thumbnail is made and
 * before the size is checked against the quota.
 */
class listener implements EventSubscriberInterface
{
	public function __construct(
		protected compressor $compressor,
		protected config $config,
		protected string $phpbb_root_path
	) {
	}

	public static function getSubscribedEvents(): array
	{
		return ['core.modify_uploaded_file' => 'compress'];
	}

	/**
	 * @param \phpbb\event\data $event
	 */
	public function compress($event): void
	{
		if (!$event['is_image'])
		{
			return;
		}

		$filedata = $event['filedata'];
		$path = $this->phpbb_root_path . $this->config['upload_path'] . '/' . $filedata['physical_filename'];
		$size = $this->compressor->compress($path);

		if ($size !== null)
		{
			$filedata['filesize'] = $size;
			$event['filedata'] = $filedata;
		}
	}
}
