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
	/**
	 * Sets the services this listener needs.
	 *
	 * @param compressor $compressor  Makes a stored picture smaller.
	 * @param config $config  The board settings, used for the upload folder.
	 * @param string $phpbb_root_path  The path to the phpBB root folder.
	 */
	public function __construct(
		protected compressor $compressor,
		protected config $config,
		protected string $phpbb_root_path
	)
	{
	}

	/**
	 * Tells phpBB which event this class listens to.
	 *
	 * @return array<string, string>  The event name, with the method that handles it.
	 */
	public static function getSubscribedEvents(): array
	{
		return ['core.modify_uploaded_file' => 'compress'];
	}

	/**
	 * Makes the stored picture smaller and passes the new size on, so the quota check sees the real size.
	 * Files that are not pictures are left alone.
	 *
	 * @param \phpbb\event\data $event  The core.modify_uploaded_file event. It holds the file data.
	 *
	 * @return void
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
