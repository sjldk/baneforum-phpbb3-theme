<?php
// Fills the test board with forums, users and topics in every status the theme styles.
// Run with docker/dummy-data.sh. It stops if the board was already filled.
define('IN_PHPBB', true);
$phpbb_root_path = '/var/www/html/';
$phpEx = 'php';
require $phpbb_root_path . 'common.php';
require $phpbb_root_path . 'includes/functions_posting.php';
require $phpbb_root_path . 'includes/functions_user.php';
require $phpbb_root_path . 'includes/functions_admin.php';
require $phpbb_root_path . 'includes/functions_display.php';

$request->enable_super_globals();
$user->session_begin();
$auth->acl($user->data);
$user->setup();

function one($sql)
{
	global $db;
	$result = $db->sql_query($sql);
	$row = $db->sql_fetchrow($result);
	$db->sql_freeresult($result);
	return $row;
}

function as_user($id)
{
	global $user, $auth;
	$row = one('SELECT * FROM ' . USERS_TABLE . ' WHERE user_id = ' . (int) $id);
	$user->data = array_merge($user->data, $row);
	$user->data['is_registered'] = true;
	$user->ip = '127.0.0.1';
	$auth->acl($user->data);
}

if (one("SELECT forum_id FROM " . FORUMS_TABLE . " WHERE forum_name = 'Dummy category'"))
{
	exit("Already filled.\n");
}

$admin = one("SELECT user_id FROM " . USERS_TABLE . " WHERE username_clean = 'admin'")['user_id'];
$registered = one("SELECT group_id FROM " . GROUPS_TABLE . " WHERE group_name = 'REGISTERED'")['group_id'];

$people = [];
foreach (['alice', 'bob', 'carol'] as $name)
{
	$known = one("SELECT user_id FROM " . USERS_TABLE . " WHERE username_clean = '" . $name . "'");
	$people[$name] = $known ? (int) $known['user_id'] : user_add([
		'username' => $name,
		'user_password' => phpbb_hash('adminadmin'),
		'user_email' => $name . '@example.invalid',
		'group_id' => $registered,
		'user_type' => USER_NORMAL,
		'user_regdate' => time(),
	]);
}
$alice = $people['alice'];
$bob = $people['bob'];
$carol = $people['carol'];

function forum($name, $parent, $type = FORUM_POST, $status = ITEM_UNLOCKED, $desc = '', $link = '')
{
	global $db;
	$db->sql_query('INSERT INTO ' . FORUMS_TABLE . ' ' . $db->sql_build_array('INSERT', [
		'forum_name' => $name,
		'parent_id' => $parent,
		'forum_type' => $type,
		'forum_status' => $status,
		'forum_desc' => $desc,
		'forum_link' => $link,
		'forum_parents' => '',
		'forum_rules' => '',
		'forum_rules_link' => '',
		'forum_last_poster_name' => '',
		'forum_last_poster_colour' => '',
		'forum_last_post_subject' => '',
	]));
	$id = (int) $db->sql_nextid();
	if ($type != FORUM_LINK)
	{
		$db->sql_query('INSERT INTO ' . ACL_GROUPS_TABLE . ' (group_id, forum_id, auth_option_id, auth_role_id, auth_setting)
			SELECT group_id, ' . $id . ', auth_option_id, auth_role_id, auth_setting FROM ' . ACL_GROUPS_TABLE . ' WHERE forum_id = 2');
	}
	return $id;
}

$cat = forum('Dummy category', 0, FORUM_CAT, ITEM_UNLOCKED, 'Forums for checking the theme.');
$news = forum('News and announcements', $cat, FORUM_POST, ITEM_UNLOCKED, 'Announcements, sticky topics and locked topics.');
$talk = forum('General talk', $cat, FORUM_POST, ITEM_UNLOCKED, 'Read, unread, hot topics and topics you posted in.');
$sub1 = forum('Sub forum one', $talk);
$sub2 = forum('Sub forum two', $talk);
$archive = forum('Locked archive', $cat, FORUM_POST, ITEM_LOCKED, 'Nothing can be posted here.');
forum('Link to example.org', $cat, FORUM_LINK, ITEM_UNLOCKED, 'A forum that is a link.', 'https://example.org');

// Renumber the forum tree
$rows = [];
$result = $db->sql_query('SELECT forum_id, parent_id FROM ' . FORUMS_TABLE . ' ORDER BY left_id, forum_id');
while ($row = $db->sql_fetchrow($result))
{
	$rows[(int) $row['parent_id']][] = (int) $row['forum_id'];
}
$db->sql_freeresult($result);
$counter = 0;
$number = function ($parent) use (&$number, &$counter, $rows, $db)
{
	foreach ($rows[$parent] ?? [] as $id)
	{
		$left = ++$counter;
		$number($id);
		$db->sql_query('UPDATE ' . FORUMS_TABLE . ' SET left_id = ' . $left . ', right_id = ' . (++$counter) . ' WHERE forum_id = ' . $id);
	}
};
$number(0);

function post($mode, $forum, $topic, $who, $title, $text, $type = POST_NORMAL)
{
	global $db;
	as_user($who);
	$uid = $bitfield = '';
	$options = 0;
	generate_text_for_storage($text, $uid, $bitfield, $options, true, true, true);
	$poll = [];
	$data = [
		'forum_id' => $forum,
		'topic_id' => $topic,
		'icon_id' => 0,
		'enable_bbcode' => true,
		'enable_smilies' => true,
		'enable_urls' => true,
		'enable_sig' => true,
		'message' => $text,
		'message_md5' => md5($text),
		'attachment_data' => [],
		'filename_data' => ['filename' => ''],
		'topic_title' => $title,
		'forum_name' => '',
		'notify' => false,
		'notify_set' => false,
		'post_edit_locked' => 0,
		'bbcode_bitfield' => $bitfield,
		'bbcode_uid' => $uid,
		'force_approved_state' => ITEM_APPROVED,
		'force_visibility' => ITEM_APPROVED,
		'topic_visibility' => ITEM_APPROVED,
		'topic_time_limit' => 0,
		'enable_markdown' => true,
		'enable_indexing' => true,
	];
	if ($mode == 'reply')
	{
		$t = one('SELECT * FROM ' . TOPICS_TABLE . ' WHERE topic_id = ' . (int) $topic);
		$data['topic_first_post_id'] = $t['topic_first_post_id'];
		$data['topic_last_post_id'] = $t['topic_last_post_id'];
		$data['topic_posts_approved'] = $t['topic_posts_approved'];
		$data['topic_title'] = $t['topic_title'];
	}
	submit_post($mode, $title, $user_name = '', $type, $poll, $data);
	return (int) $data['topic_id'];
}

function topic($forum, $who, $title, $text, $type = POST_NORMAL)
{
	return post('post', $forum, 0, $who, $title, $text, $type);
}

function reply($forum, $topic, $who, $text)
{
	post('reply', $forum, $topic, $who, 'Re: reply', $text);
}

$lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.\n\nUt enim ad minim veniam, quis nostrud exercitation ullamco laboris.";

// Announcements and sticky topics
$global = topic($news, $admin, 'Global announcement', $lorem, POST_GLOBAL);
topic($news, $admin, 'Announcement from the team', $lorem, POST_ANNOUNCE);
topic($news, $alice, 'Unread announcement', $lorem, POST_ANNOUNCE);
topic($news, $admin, 'Sticky: read the rules first', $lorem, POST_STICKY);
topic($news, $bob, 'Sticky: unread tips and tricks', $lorem, POST_STICKY);
$locked = topic($news, $admin, 'Locked topic, read', $lorem);
$lockedUnread = topic($news, $carol, 'Locked topic, unread', $lorem);
$db->sql_query('UPDATE ' . TOPICS_TABLE . ' SET topic_status = ' . ITEM_LOCKED . ' WHERE topic_id IN (' . $locked . ', ' . $lockedUnread . ')');

// General talk
topic($talk, $admin, 'Read topic, started by you', $lorem);
topic($talk, $alice, 'Unread topic', $lorem);
$mineRead = topic($talk, $alice, 'Read topic you posted in', $lorem);
reply($talk, $mineRead, $admin, 'My reply.');
$mineUnread = topic($talk, $bob, 'Unread topic you posted in', $lorem);
reply($talk, $mineUnread, $admin, 'My reply.');
reply($talk, $mineUnread, $bob, 'A newer answer you have not read.');

$hotRead = topic($talk, $admin, 'Hot topic, read', $lorem);
$hotUnread = topic($talk, $carol, 'Hot topic, unread', $lorem);
$hotMine = topic($talk, $alice, 'Hot topic, unread, you posted in', $lorem);
reply($talk, $hotMine, $admin, 'My reply.');
foreach ([$hotRead, $hotUnread, $hotMine] as $t)
{
	for ($i = 1; $i <= 26; $i++)
	{
		reply($talk, $t, [$alice, $bob, $carol][$i % 3], "Reply number $i.");
	}
}

$lockedMine = topic($talk, $bob, 'Locked, unread, you posted in', $lorem);
reply($talk, $lockedMine, $admin, 'My reply.');
reply($talk, $lockedMine, $bob, 'Last word.');
$db->sql_query('UPDATE ' . TOPICS_TABLE . ' SET topic_status = ' . ITEM_LOCKED . ' WHERE topic_id = ' . $lockedMine);

// A moved topic: a shadow topic in General talk that points to the original in News
$orig = one('SELECT * FROM ' . TOPICS_TABLE . ' WHERE topic_id = ' . $locked);
unset($orig['topic_id']);
$orig['forum_id'] = $talk;
$orig['topic_status'] = ITEM_MOVED;
$orig['topic_moved_id'] = $locked;
$orig['topic_title'] = 'Moved topic';
$db->sql_query('INSERT INTO ' . TOPICS_TABLE . ' ' . $db->sql_build_array('INSERT', $orig));

// Sub forums
topic($sub1, $alice, 'Topic in sub forum one', $lorem);
topic($sub2, $admin, 'Topic in sub forum two', $lorem);

// Locked forum
topic($archive, $admin, 'Old topic in a locked forum', $lorem);

// A post with links, a quote, code and a list
$text = "Plain text with a [url=https://example.org]link inside the text[/url] and a bare link https://example.org/page.\n\n"
	. "[quote=\"alice\"]A quoted line from someone else.[/quote]\n\n"
	. "[b]Bold[/b], [i]italic[/i], [u]underlined[/u].\n\n"
	. "[code]echo 'code block';[/code]\n\n"
	. "[list][*]First item[*]Second item[*]Third item[/list]\n\n"
	. "Smilies :) :D ;) :( and so on.";
$mixed = topic($talk, $admin, 'Typography: links, quote, code and list', $text);
reply($talk, $mixed, $alice, "Reply with a [url=https://example.org]second link[/url].\n\n[quote=\"admin\"]Quote of the first post.[/quote]");

// Tell the forums their counts and last posts
sync('forum', 'forum_id', [$news, $talk, $sub1, $sub2, $archive]);
$cache->purge();
echo "Done.\n";
