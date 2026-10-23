<?php
/**
 * Baneforum dark theme switch, Danish
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
	'BF_DARK_THEME'         => 'Mørkt tema',
	'BF_DARK_THEME_EXPLAIN' => 'Slå det mørke tema til eller fra. Valget huskes i denne browser.',
]);
