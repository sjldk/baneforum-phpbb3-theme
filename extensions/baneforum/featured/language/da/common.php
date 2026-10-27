<?php
/**
 * Baneforum featured posts, Danish
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
	'BF_FEATURED_TITLE' => 'Populære indlæg',
	'BF_FEATURED_ABOUT' => 'Indlæg med et billede. De mest likede og de nyeste kommer først.',
	'BF_FEATURED_HELP' => 'Hvordan vælges disse indlæg?',
	'BF_FEATURED_NEW' => 'Ny',
]);
