<?php
/**
 * Baneforum latest posts, Danish
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
	'BF_LATEST_TITLE' => 'Seneste indlæg',
]);
