<?php
/**
 * Baneforum editor
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

namespace baneforum\editor\event;

use baneforum\editor\markdown_detector;
use phpbb\db\driver\driver_interface;
use phpbb\request\request_interface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Gives the posting page a flag, BF_MARKDOWN, when the post that is edited or quoted was written in Markdown.
 * The editor then reads the text as Markdown and saves it as BBCode. Also adds the [s] BBCode (strikethrough).
 */
class listener implements EventSubscriberInterface
{
	public function __construct(
		protected markdown_detector $detector,
		protected driver_interface $db,
		protected request_interface $request,
		protected string $posts_table,
		protected string $privmsgs_table
	) {
	}

	public static function getSubscribedEvents(): array
	{
		return [
			'core.text_formatter_s9e_configure_after' => 'add_bbcodes',
			'core.posting_modify_template_vars'       => 'flag_post',
			'core.ucp_pm_compose_template'            => 'flag_message',
		];
	}

	/** The table BBCodes. The text formatter library of phpBB has the definitions ready (its repository). phpBB does not switch them on. */
	public const TABLE_BBCODES = ['TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD'];

	/**
	 * The BBCodes that phpBB lacks and that the editor and the conversion of Markdown posts write: [s] for strikethrough, and [table], [tr],
	 * [th], [td] (with align=left|center|right, colspan and rowspan) for tables. A tag that the board does not know is shown as plain text.
	 *
	 * @param \phpbb\event\data $event
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

	/**
	 * @param \phpbb\event\data $event
	 */
	public function flag_post($event): void
	{
		if (!in_array($event['mode'], ['edit', 'quote'], true))
		{
			return;
		}

		$page_data = $event['page_data'];
		$page_data['BF_MARKDOWN'] = $this->stored_markdown($this->posts_table, 'post_id', 'post_text', (int) $event['post_id']);
		$event['page_data'] = $page_data;
	}

	/**
	 * A private message that is edited, quoted or forwarded, or a topic post that is quoted in one.
	 *
	 * @param \phpbb\event\data $event
	 */
	public function flag_message($event): void
	{
		$action = $this->request->variable('action', '');
		$id = $this->request->variable('p', 0);
		$template_ary = $event['template_ary'];

		if ($action === 'quotepost')
		{
			$template_ary['BF_MARKDOWN'] = $this->stored_markdown($this->posts_table, 'post_id', 'post_text', $id);
		}
		else if (in_array($action, ['edit', 'quote', 'forward', 'reply'], true))
		{
			$template_ary['BF_MARKDOWN'] = $this->stored_markdown($this->privmsgs_table, 'msg_id', 'message_text', $id);
		}

		$event['template_ary'] = $template_ary;
	}

	private function stored_markdown(string $table, string $id_column, string $text_column, int $id): bool
	{
		if ($id <= 0)
		{
			return false;
		}

		$result = $this->db->sql_query("SELECT $text_column AS stored FROM $table WHERE $id_column = $id");
		$stored = $this->db->sql_fetchfield('stored');
		$this->db->sql_freeresult($result);

		return is_string($stored) && $this->detector->contains_markdown($stored);
	}
}
