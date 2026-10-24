<?php
/**
 * Baneforum YouTube thumbnails
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\ytthumb\event;

use baneforum\ytthumb\print_cards;
use phpbb\controller\helper;
use phpbb\request\request_interface;
use phpbb\template\template;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Tells every page where the thumbnails are (template variable U_BF_YTTHUMB, with a stand-in for the video id), so that the script of
 * the video cards can ask for them. In the print view of a topic or a private message (no JavaScript there) it puts our thumbnail and the
 * address of the video in the place of phpBB's embedded player.
 */
class listener implements EventSubscriberInterface
{
	/** Replaced by the id of the video in the script of the page. Eleven characters, like a real id. */
	public const STAND_IN = 'AAAAAAAAAAA';

	/**
	 * Keeps the services that the page header and the print view need.
	 *
	 * @param helper $helper Makes the address of the thumbnail route.
	 * @param template $template The page template that gets the variable.
	 * @param request_interface $request Tells whether the print view is asked for.
	 */
	public function __construct(protected helper $helper, protected template $template, protected request_interface $request)
	{
	}

	/**
	 * The events this listener wants.
	 *
	 * @return array<string, string>  Event name and method name.
	 */
	public static function getSubscribedEvents(): array
	{
		return [
			'core.page_header'               => 'add_address',
			'core.viewtopic_modify_post_row' => 'print_post',
			'core.ucp_pm_view_messsage'      => 'print_message',
		];
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

	/**
	 * In the print view of a topic, swaps the embedded players in a post for our thumbnail cards.
	 *
	 * @param \phpbb\event\data $event The core.viewtopic_modify_post_row event.
	 *
	 * @return void
	 */
	public function print_post($event): void
	{
		if ($this->printing())
		{
			$row = $event['post_row'];
			$row['MESSAGE'] = $this->cards($row['MESSAGE']);
			$event['post_row'] = $row;
		}
	}

	/**
	 * The same for a private message in the print view.
	 *
	 * @param \phpbb\event\data $event The core.ucp_pm_view_messsage event (the misspelling is phpBB's own).
	 *
	 * @return void
	 */
	public function print_message($event): void
	{
		if ($this->printing())
		{
			$data = $event['msg_data'];
			$data['MESSAGE'] = $this->cards($data['MESSAGE']);
			$event['msg_data'] = $data;
		}
	}

	/**
	 * Whether the page is the print view (view=print). There is no JavaScript there, so the cards cannot be made by the script.
	 *
	 * @return bool True in the print view.
	 */
	protected function printing(): bool
	{
		return $this->request->variable('view', '') === 'print';
	}

	/**
	 * Replaces the player frames in a rendered message with a thumbnail and a link to the video.
	 *
	 * @param string $message The rendered message.
	 *
	 * @return string The message with cards in place of players.
	 */
	protected function cards(string $message): string
	{
		return print_cards::replace($message, fn (string $id): string => $this->helper->route('baneforum_ytthumb', ['id' => $id]));
	}
}
