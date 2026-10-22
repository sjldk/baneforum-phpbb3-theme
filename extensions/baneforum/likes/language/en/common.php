<?php
/**
 * Baneforum likes, English
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
	'ACL_U_BANEFORUM_VOTE'      => 'Can like and dislike posts',

	'BF_VOTE_GROUP'             => 'Like or dislike this post',
	'BF_VOTE_LIKE'              => 'Like',
	'BF_VOTE_DISLIKE'           => 'Dislike',
	'BF_VOTE_HIDDEN'            => 'This post has many dislikes and is collapsed.',
	'BF_VOTE_SHOW'              => 'Show post',
	'BF_VOTE_HIDE'              => 'Hide post',
	'BF_VOTE_LOGIN'             => 'Log in to like or dislike posts.',
	'BF_VOTE_OWN'               => 'You cannot vote on your own post.',

	'BF_VOTE_ERROR_VALUE'       => 'The vote was not understood.',
	'BF_VOTE_ERROR_PERMISSION'  => 'You may not like or dislike posts.',
	'BF_VOTE_ERROR_HASH'        => 'The page is too old. Reload it and try again.',
	'BF_VOTE_ERROR_POST'        => 'This post cannot be voted on.',
	'BF_VOTE_ERROR_OWN'         => 'You cannot vote on your own post.',
]);
