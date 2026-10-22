<?php
/**
 * Baneforum likes, Danish
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
	'ACL_U_BANEFORUM_VOTE'      => 'Kan synes godt om og ikke om indlæg',

	'BF_VOTE_GROUP'             => 'Synes godt om eller ikke om dette indlæg',
	'BF_VOTE_LIKE'              => 'Synes godt om',
	'BF_VOTE_DISLIKE'           => 'Synes ikke om',
	'BF_VOTE_LOGIN'             => 'Log ind for at stemme på indlæg.',
	'BF_VOTE_OWN'               => 'Du kan ikke stemme på dit eget indlæg.',

	'BF_VOTE_ERROR_VALUE'       => 'Stemmen blev ikke forstået.',
	'BF_VOTE_ERROR_PERMISSION'  => 'Du må ikke stemme på indlæg.',
	'BF_VOTE_ERROR_HASH'        => 'Siden er for gammel. Genindlæs den og prøv igen.',
	'BF_VOTE_ERROR_POST'        => 'Der kan ikke stemmes på dette indlæg.',
	'BF_VOTE_ERROR_OWN'         => 'Du kan ikke stemme på dit eget indlæg.',
]);
