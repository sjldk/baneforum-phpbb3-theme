<?php
/**
 * Baneforum appearance switch, English
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
	'BF_APPEARANCE'         => 'Appearance',
	'BF_APPEARANCE_EXPLAIN' => 'Switch between the light and the dark theme. The choice is kept in this browser.',
]);
