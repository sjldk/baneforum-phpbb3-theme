<?php
/**
 * Baneforum appearance switch, Danish
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
	'BF_APPEARANCE'         => 'Udseende',
	'BF_APPEARANCE_EXPLAIN' => 'Skift mellem det lyse og det mørke tema. Valget huskes i denne browser.',
]);
