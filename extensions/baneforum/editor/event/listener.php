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
	/**
	 * Sets the services this listener needs.
	 *
	 * @param markdown_detector $detector  Tells whether a stored post holds Markdown.
	 * @param driver_interface $db  The database.
	 * @param request_interface $request  The request, to read the action and the message id.
	 * @param string $posts_table  The full name of the posts table.
	 * @param string $privmsgs_table  The full name of the private messages table.
	 */
	public function __construct(
		protected markdown_detector $detector,
		protected driver_interface $db,
		protected request_interface $request,
		protected string $posts_table,
		protected string $privmsgs_table
	)
	{
	}

	/**
	 * Tells phpBB which events this class listens to.
	 *
	 * @return array<string, string>  The event names, each with the method that handles it.
	 */
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

	/**
	 * Flags the posting page when the post that is edited or quoted holds Markdown.
	 *
	 * @param \phpbb\event\data $event  The core.posting_modify_template_vars event
	 *
	 * @return void
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
	 * @param \phpbb\event\data $event  The core.ucp_pm_compose_template event
	 *
	 * @return void
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

	/**
	 * Reads the stored text of one post or message and tells whether it holds Markdown.
	 * The column and table names come from this class, never from the request. Only the id comes from outside, and it is a number.
	 *
	 * @param string $table  The full table name
	 * @param string $id_column  The name of the id column
	 * @param string $text_column  The name of the text column
	 * @param int $id  The id of the row. Zero or less gives false.
	 *
	 * @return bool  True when the stored text holds Markdown
	 */
	private function stored_markdown(string $table, string $id_column, string $text_column, int $id): bool
	{
		if ($id <= 0)
		{
			return false;
		}

		$result = $this->db->sql_query("SELECT $text_column AS xml_text FROM $table WHERE $id_column = $id");
		$stored = $this->db->sql_fetchfield('xml_text');
		$this->db->sql_freeresult($result);

		return is_string($stored) && $this->detector->contains_markdown($stored);
	}
}
