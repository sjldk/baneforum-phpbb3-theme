<?php
/**
 * Baneforum Facebook data deletion, en
 *
 * @license GNU General Public License, version 2 (GPL-2.0-only)
 */

if (!defined('IN_PHPBB'))
{
	exit;
}

if (empty($lang) || !is_array($lang))
{
	$lang = [];
}

$lang = array_merge($lang, [
	'FBDELETION_TITLE'     => 'Delete your data',
	'FBDELETION_DONE'      => 'Your account is deleted. Your posts stay, but they now show as written by “Guest”. Your name is removed from them.',
	'FBDELETION_WAITING'   => 'We got your request, but the account is not deleted yet. An administrator will do it. Write to the Board Administrator if it takes long.',
	'FBDELETION_NOT_FOUND' => 'This page does not exist.',
]);
