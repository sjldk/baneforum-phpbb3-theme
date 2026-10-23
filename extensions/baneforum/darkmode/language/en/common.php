<?php
/**
 * Baneforum dark theme switch, English
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
	'BF_DARK_THEME'         => 'Dark theme',
	'BF_DARK_THEME_EXPLAIN' => 'Switch the dark theme on or off. The choice is kept in this browser.',
]);
