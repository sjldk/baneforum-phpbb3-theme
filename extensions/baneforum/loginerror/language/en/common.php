<?php
/**
 * Baneforum login error, en
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

// phpBB has one text for each case. Both get the same words.
$lang = array_merge($lang, [
	'LOGIN_ERROR_PASSWORD' => 'The username or the password is incorrect. Please check both and try again. If you continue to have problems please contact the %sBoard Administrator%s.',
	'LOGIN_ERROR_USERNAME' => 'The username or the password is incorrect. Please check both and try again. If you continue to have problems please contact the %sBoard Administrator%s.',
]);
